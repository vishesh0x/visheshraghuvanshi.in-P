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
import { hashPassword, isLegacyHash, verifyPassword } from "./admin-auth";

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Sign a session token using Web Crypto HMAC-SHA256 */
export async function createSessionToken(userId: string, version = 0): Promise<string> {
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

  const payload = JSON.stringify({
    sub: userId,
    v: version,
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
  });
  const base64Payload = btoa(payload);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(base64Payload));
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${base64Payload}.${signature}`;
}

/** Verify session token */
export async function verifySessionToken(
  token: string,
): Promise<{ userId: string; version: number } | null> {
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

    const payload = JSON.parse(atob(base64Payload)) as { sub?: string; exp?: number; v?: number };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.sub) return null;

    return { userId: payload.sub, version: typeof payload.v === "number" ? payload.v : 0 };
  } catch {
    return null;
  }
}

const isMissingColumn = (err: unknown) => /no such column|has no column/i.test(String(err));

/**
 * A signed token is only honoured while (a) the admin still exists and (b) its
 * session_version still matches the database. Signing out bumps the version,
 * which revokes every cookie issued before it.
 * Falls back to the existence check alone until migration 006 is applied.
 */
async function isSessionCurrent(session: { userId: string; version: number }): Promise<boolean> {
  const db = getD1Database();
  try {
    const row = await db
      .prepare("SELECT session_version AS v FROM admin_users WHERE id = ? LIMIT 1")
      .bind(session.userId)
      .first<{ v: number | null }>();
    return !!row && (row.v ?? 0) === session.version;
  } catch (err) {
    if (!isMissingColumn(err)) throw err;
    const row = await db
      .prepare("SELECT 1 AS ok FROM admin_users WHERE id = ? LIMIT 1")
      .bind(session.userId)
      .first<{ ok: number }>();
    return !!row;
  }
}

async function currentSessionVersion(userId: string): Promise<number> {
  try {
    const row = await getD1Database()
      .prepare("SELECT session_version AS v FROM admin_users WHERE id = ? LIMIT 1")
      .bind(userId)
      .first<{ v: number | null }>();
    return row?.v ?? 0;
  } catch (err) {
    if (isMissingColumn(err)) return 0;
    throw err;
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

  if (!(await isSessionCurrent(session))) {
    throw new Error("Unauthorized: Session has been revoked or the account no longer exists");
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
    if (!(await isSessionCurrent(session))) return { authenticated: false };

    return { authenticated: true, userId: session.userId };
  } catch {
    return { authenticated: false };
  }
}

const MIN_NEW_PASSWORD_LENGTH = 12;

/**
 * Optional server-side pepper. Cloudflare Workers cap PBKDF2 at 100,000
 * iterations (below current guidance) and that limit can't be raised, so when
 * ADMIN_PASSWORD_PEPPER is configured the password is first run through
 * HMAC-SHA256 keyed with it. A stolen database alone is then not enough to
 * mount an offline guessing attack: the attacker also needs a secret that lives
 * only in the Worker's environment.
 *
 * It is deliberately a SEPARATE secret from ADMIN_SESSION_SECRET so rotating
 * the session key (the normal response to a suspected leak) can never lock the
 * owner out. Peppered hashes are stored with a "v2$" prefix; unpeppered ones
 * keep working and are upgraded on the next successful login.
 */
function getPepper(): string | null {
  const env = getCloudflareEnv();
  const v = env["ADMIN_PASSWORD_PEPPER"] || process.env["ADMIN_PASSWORD_PEPPER"];
  return typeof v === "string" && v.length >= 16 ? v : null;
}

async function pepperPassword(password: string, pepper: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(password));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashForStorage(password: string): Promise<string> {
  const pepper = getPepper();
  return pepper
    ? `v2$${await hashPassword(await pepperPassword(password, pepper))}`
    : hashPassword(password);
}

async function checkStoredPassword(
  password: string,
  stored: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
  const pepper = getPepper();
  if (stored.startsWith("v2$")) {
    if (!pepper) {
      console.error("[auth] account uses a peppered hash but ADMIN_PASSWORD_PEPPER is not set");
      return { valid: false, needsUpgrade: false };
    }
    const valid = await verifyPassword(await pepperPassword(password, pepper), stored.slice(3));
    return { valid, needsUpgrade: false };
  }
  const valid = await verifyPassword(password, stored);
  // Upgrade if the stored hash is the legacy SHA-256 format OR a pepper is now configured.
  return { valid, needsUpgrade: valid && (isLegacyHash(stored) || pepper !== null) };
}

/** Constant-time string comparison (length is not secret here). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signInAdminActionImpl(data: {
  email: string;
  password: string;
  isSignUp?: boolean | undefined;
  setupToken?: string | undefined;
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const db = getD1Database();
  const email = data.email.toLowerCase();

  // ── Brute-force throttle ──────────────────────────────────────────────────
  // Failures are counted per IP and per (email + IP) pair - NOT per email alone.
  // An email-only counter lets any stranger who types the owner's address 8
  // times lock the owner out of their own site; keyed on the IP, the attacker
  // only ever locks out themselves. Checked before any password hashing so a
  // lockout doesn't leak timing information. IPs are stored as keyed hashes.
  const { getRequest: getReq } = await import("@tanstack/react-start/server");
  const { keyedHash } = await import("@/lib/security.server");
  const headers = getReq()?.headers;
  const rawIp = headers?.get("cf-connecting-ip") ?? headers?.get("x-forwarded-for") ?? "unknown";
  const ipHash = await keyedHash("login-ip", rawIp);

  let hasIpColumn = true;
  try {
    const perIp = await db
      .prepare(
        "SELECT COUNT(*) as count FROM login_attempts WHERE ip_hash = ? AND success = 0 AND created_at > datetime('now', '-15 minutes')",
      )
      .bind(ipHash)
      .first<{ count: number }>();
    const perPair = await db
      .prepare(
        "SELECT COUNT(*) as count FROM login_attempts WHERE email = ? AND ip_hash = ? AND success = 0 AND created_at > datetime('now', '-15 minutes')",
      )
      .bind(email, ipHash)
      .first<{ count: number }>();
    if ((perIp?.count ?? 0) >= 10 || (perPair?.count ?? 0) >= 6) {
      return {
        ok: false,
        error: "Too many failed attempts from this connection. Please wait 15 minutes and try again.",
      };
    }
  } catch (err) {
    if (!isMissingColumn(err)) throw err;
    // Migration 006 not applied yet: fall back to the legacy per-email limit.
    hasIpColumn = false;
    const legacy = await db
      .prepare(
        "SELECT COUNT(*) as count FROM login_attempts WHERE email = ? AND success = 0 AND created_at > datetime('now', '-15 minutes')",
      )
      .bind(email)
      .first<{ count: number }>()
      .catch(() => null);
    if (legacy && legacy.count >= 8) {
      return { ok: false, error: "Too many failed attempts. Please wait 15 minutes and try again." };
    }
  }

  async function recordAttempt(success: boolean) {
    try {
      if (hasIpColumn) {
        await db
          .prepare(
            "INSERT INTO login_attempts (id, email, success, ip_hash, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
          )
          .bind(crypto.randomUUID(), email, success ? 1 : 0, ipHash)
          .run();
      } else {
        await db
          .prepare(
            "INSERT INTO login_attempts (id, email, success, created_at) VALUES (?, ?, ?, datetime('now'))",
          )
          .bind(crypto.randomUUID(), email, success ? 1 : 0)
          .run();
      }
      if (success) {
        // Keep the table small: nothing older than a day is ever consulted.
        await db
          .prepare("DELETE FROM login_attempts WHERE created_at < datetime('now', '-1 day')")
          .run();
      }
    } catch {
      // Login must still succeed/fail correctly even if attempt logging fails.
    }
  }

  const existingUsers = await db
    .prepare("SELECT COUNT(*) as count FROM admin_users")
    .first<{ count: number }>();
  const noAdminsYet = existingUsers?.count === 0 || !existingUsers;

  // ── First-run registration ────────────────────────────────────────────────
  // /auth is public, so "the first person to submit the form becomes the
  // administrator" means anyone who finds a fresh deployment before the owner
  // does can take it over. Registration therefore also needs a one-time setup
  // secret that only the owner has (`wrangler secret put ADMIN_SETUP_TOKEN`),
  // and fails closed if that secret was never configured.
  if (data.isSignUp) {
    if (!noAdminsYet) {
      return { ok: false, error: "An operator account already exists. Please sign in." };
    }

    const env = getCloudflareEnv();
    const expectedToken = (env["ADMIN_SETUP_TOKEN"] || process.env["ADMIN_SETUP_TOKEN"]) as
      | string
      | undefined;
    if (!expectedToken) {
      return {
        ok: false,
        error:
          "Registration is disabled until ADMIN_SETUP_TOKEN is configured on the server (see README).",
      };
    }
    if (!safeEqual(data.setupToken ?? "", expectedToken)) {
      await recordAttempt(false);
      return { ok: false, error: "Invalid setup token." };
    }
    if (data.password.length < MIN_NEW_PASSWORD_LENGTH) {
      return {
        ok: false,
        error: `Use at least ${MIN_NEW_PASSWORD_LENGTH} characters for the operator password.`,
      };
    }

    const hashed = await hashForStorage(data.password);
    const userId = crypto.randomUUID();
    // Atomic: the row is only inserted if the table is STILL empty at write
    // time, so two simultaneous registrations can't both become admin.
    const result = await db
      .prepare(
        "INSERT INTO admin_users (id, email, password_hash, created_at) SELECT ?, ?, ?, datetime('now') WHERE NOT EXISTS (SELECT 1 FROM admin_users)",
      )
      .bind(userId, email, hashed)
      .run();
    if (!result.meta?.changes) {
      return { ok: false, error: "An operator account already exists. Please sign in." };
    }

    const token = await createSessionToken(userId, 0);
    setAdminCookie(token, 604800);
    await recordAttempt(true);
    return { ok: true, message: "Operator account created successfully." };
  }

  const user = await db
    .prepare("SELECT * FROM admin_users WHERE email = ? LIMIT 1")
    .bind(email)
    .first<{ id: string; email: string; password_hash: string }>();

  if (!user) {
    // Burn the same PBKDF2 work a real check would, so response time doesn't
    // reveal which email addresses have accounts.
    await verifyPassword(data.password, "pbkdf2:100000:00000000000000000000000000000000:00");
    await recordAttempt(false);
    if (noAdminsYet) {
      return { ok: false, error: "No operator account yet - use Register to create the first one." };
    }
    return { ok: false, error: "Invalid email or password." };
  }

  const { valid, needsUpgrade } = await checkStoredPassword(data.password, user.password_hash);
  if (!valid) {
    await recordAttempt(false);
    return { ok: false, error: "Invalid email or password." };
  }

  // Transparently upgrade accounts still on the legacy single-round SHA-256
  // format (or unpeppered accounts, once a pepper is configured) now that we
  // hold the plaintext.
  if (needsUpgrade) {
    try {
      await db
        .prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?")
        .bind(await hashForStorage(data.password), user.id)
        .run();
    } catch (err) {
      console.warn("[auth] password hash upgrade failed", err);
    }
  }

  const token = await createSessionToken(user.id, await currentSessionVersion(user.id));
  setAdminCookie(token, 604800);
  await recordAttempt(true);
  return { ok: true, message: "Signed in successfully." };
}

export async function signOutAdminActionImpl(): Promise<{ ok: boolean }> {
  // Clearing the cookie only logs THIS browser out; a copied token would stay
  // valid for the rest of its 7 days. Bumping session_version revokes it
  // everywhere, immediately.
  try {
    const token = getSessionTokenFromRequest(getRequest());
    const session = token ? await verifySessionToken(token) : null;
    if (session) {
      await getD1Database()
        .prepare("UPDATE admin_users SET session_version = session_version + 1 WHERE id = ?")
        .bind(session.userId)
        .run();
    }
  } catch (err) {
    if (!isMissingColumn(err)) console.warn("[auth] session revocation failed", err);
  }
  setAdminCookie("", 0);
  return { ok: true };
}
