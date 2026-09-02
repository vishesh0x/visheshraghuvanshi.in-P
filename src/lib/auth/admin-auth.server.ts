/**
 * SERVER-ONLY: Admin authentication implementation.
 *
 * This file is loaded dynamically inside createServerFn handlers and must
 * never be statically imported from client-side code.
 *
 * Exports:
 *   - requireAdmin           → plain async guard, call directly inside a
 *                               createServerFn handler; throws if unauthenticated
 *   - getAdminAuthSessionImpl / signInAdminActionImpl / signOutAdminActionImpl
 *     → raw async functions called by admin-auth.ts server-fn handlers
 */
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { getCloudflareEnv, getD1Database } from "@/lib/db/d1.server";
import { hashPassword, verifyPassword } from "./admin-auth";

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Sign a session token using Web Crypto HMAC-SHA256 */
export async function createSessionToken(userId: string): Promise<string> {
  const env = getCloudflareEnv();
  const secretStr = env["ADMIN_SESSION_SECRET"] || process.env["ADMIN_SESSION_SECRET"];

  if (!secretStr) {
    throw new Error("ADMIN_SESSION_SECRET is not configured.");
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const payload = JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 86400 * 7 });
  const base64Payload = btoa(payload);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(base64Payload));
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${base64Payload}.${signature}`;
}

/** Verify session token */
export async function verifySessionToken(token: string): Promise<{ userId: string } | null> {
  try {
    const [base64Payload, signature] = token.split(".");
    if (!base64Payload || !signature) return null;

    const env = getCloudflareEnv();
    const secretStr = env["ADMIN_SESSION_SECRET"] || process.env["ADMIN_SESSION_SECRET"];
    if (!secretStr) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretStr),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(base64Payload),
    );

    if (!isValid) return null;

    const payload = JSON.parse(atob(base64Payload)) as { sub?: string; exp?: number };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.sub) return null;

    return { userId: payload.sub };
  } catch {
    return null;
  }
}

/** Get session token from request Cookie or Authorization header */
export function getSessionTokenFromRequest(request?: Request): string | null {
  if (!request?.headers) return null;

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(/;\s*/)) {
      const separator = part.indexOf("=");
      if (separator === -1) continue;

      const key = part.slice(0, separator);
      const value = part.slice(separator + 1);

      if (key === "admin_session") {
        return value;
      }
    }
  }

  return null;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

/**
 * Plain async guard - call this directly, at the top of every protected
 * createServerFn handler: `const { userId } = await requireAdmin();`
 *
 * This throws on a missing or invalid session, so the server function call
 * itself rejects. Do NOT wrap this in a `typeof x === "function"` check and
 * silently skip verification if it isn't - that pattern previously made
 * this check a no-op for every request, authenticated or not.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const request = getRequest();
  const token = getSessionTokenFromRequest(request);

  if (!token) {
    throw new Error("Unauthorized: No session token provided");
  }

  const session = await verifySessionToken(token);
  if (!session) {
    throw new Error("Unauthorized: Invalid or expired session");
  }

  return { userId: session.userId };
}

// ─── Cookie helper ────────────────────────────────────────────────────────────

function setAdminCookie(token: string, maxAge: number) {
  setResponseHeader(
    "Set-Cookie",
    [
      `admin_session=${token}`,
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Path=/",
      `Max-Age=${maxAge}`,
    ].join("; "),
  );
}

// ─── Implementation functions (called by admin-auth.ts server-fn handlers) ───

export async function getAdminAuthSessionImpl(): Promise<{ authenticated: boolean; userId?: string }> {
  try {
    const request = getRequest();
    const token = getSessionTokenFromRequest(request);
    if (!token) return { authenticated: false };

    const session = await verifySessionToken(token);
    if (!session) return { authenticated: false };

    return { authenticated: true, userId: session.userId };
  } catch {
    return { authenticated: false };
  }
}

export async function signInAdminActionImpl(data: {
  email: string;
  password: string;
  isSignUp?: boolean | undefined;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const db = getD1Database();
  const email = data.email.toLowerCase();

  // Basic brute-force throttle: block further attempts against this email
  // after 8 failures in a 15-minute window. Checked before touching
  // password hashes so a lockout doesn't itself leak timing information.
  const recentFailures = await db
    .prepare(
      "SELECT COUNT(*) as count FROM login_attempts WHERE email = ? AND success = 0 AND created_at > datetime('now', '-15 minutes')",
    )
    .bind(email)
    .first<{ count: number }>()
    .catch(() => null);
  if (recentFailures && recentFailures.count >= 8) {
    return {
      ok: false,
      error: "Too many failed attempts. Please wait 15 minutes and try again.",
    };
  }

  async function recordAttempt(success: boolean) {
    try {
      await db
        .prepare(
          "INSERT INTO login_attempts (id, email, success, created_at) VALUES (?, ?, ?, datetime('now'))",
        )
        .bind(crypto.randomUUID(), email, success ? 1 : 0)
        .run();
    } catch {
      // Login must still succeed/fail correctly even if attempt logging fails
      // (e.g. the login_attempts table doesn't exist yet on an older schema).
    }
  }

  const existingUsers = await db
    .prepare("SELECT COUNT(*) as count FROM admin_users")
    .first<{ count: number }>();
  const noAdminsYet = existingUsers?.count === 0 || !existingUsers;

  // Only an explicit "Register" submission may create the first account.
  // Plain sign-in attempts against an empty admin_users table used to
  // silently register whoever tried first - meaning a stranger who reached
  // /auth before the real owner finished setup could permanently claim the
  // admin account. Set up your operator account immediately after deploying.
  if (data.isSignUp && noAdminsYet) {
    const hashed = await hashPassword(data.password);
    const userId = crypto.randomUUID();
    await db
      .prepare("INSERT INTO admin_users (id, email, password_hash, created_at) VALUES (?, ?, ?, datetime('now'))")
      .bind(userId, email, hashed)
      .run();

    const token = await createSessionToken(userId);
    setAdminCookie(token, 604800);
    await recordAttempt(true);
    return { ok: true, message: "Operator account created successfully." };
  }

  const user = await db
    .prepare("SELECT * FROM admin_users WHERE email = ? LIMIT 1")
    .bind(email)
    .first<{ id: string; email: string; password_hash: string }>();

  if (!user) {
    await recordAttempt(false);
    if (noAdminsYet) {
      return { ok: false, error: "No operator account yet - use Register to create the first one." };
    }
    return { ok: false, error: "Invalid email or password." };
  }

  const valid = await verifyPassword(data.password, user.password_hash);
  if (!valid) {
    await recordAttempt(false);
    return { ok: false, error: "Invalid email or password." };
  }

  const token = await createSessionToken(user.id);
  setAdminCookie(token, 604800);
  await recordAttempt(true);
  return { ok: true, message: "Signed in successfully." };
}

export async function signOutAdminActionImpl(): Promise<{ ok: boolean }> {
  setAdminCookie("", 0);
  return { ok: true };
}
