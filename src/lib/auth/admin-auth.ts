/**
 * Admin authentication - isomorphic entry point.
 *
 * This file is imported by both client and server code. It must NOT contain
 * any top-level imports from @tanstack/react-start/server or any other
 * server-only module. All server logic lives in admin-auth.server.ts and is
 * loaded lazily inside the server-fn handler callbacks.
 *
 * Client route components (admin.tsx, auth.tsx) call these server fns as
 * normal async functions - TanStack Start's RPC bridge handles the HTTP hop.
 *
 * Server-only consumers (admin.functions.ts middleware) should import
 * requireAdminAuth directly from ./admin-auth.server instead.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ─── Pure helpers (no server-only deps, safe on client) ──────────────────────

// Cloudflare Workers' WebCrypto implementation caps PBKDF2 at 100,000
// iterations (higher values throw at runtime), so that's the ceiling here -
// still a large improvement over the single-round SHA-256 this replaced.
const PBKDF2_ITERATIONS = 100_000;

/**
 * Hash a plain password using PBKDF2-HMAC-SHA256 with a random per-user salt.
 *
 * Stored format: "pbkdf2:<iterations>:<salt-hex>:<hash-hex>" so the work
 * factor and salt travel with the hash and can be verified without any other
 * lookup, and so the format can be upgraded again later without invalidating
 * everything at once.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashBytes = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(hashBytes)}`;
}

/**
 * Verify a password against a stored hash.
 *
 * Accepts both the current PBKDF2 format and the legacy single-round,
 * fixed-salt SHA-256 format used by earlier versions of this file, so
 * existing accounts are not locked out. Legacy hashes verify successfully
 * but are not re-hashed automatically here - if you have real accounts on
 * the legacy format, prompt a password reset to move them to PBKDF2.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith("pbkdf2:")) {
    const parts = storedHash.split(":");
    const iterations = Number(parts[1]);
    const saltHex = parts[2];
    const hashHex = parts[3];
    if (!iterations || !saltHex || !hashHex) return false;
    const salt = fromHex(saltHex);
    const computed = await pbkdf2(password, salt, iterations);
    return timingSafeEqualHex(toHex(computed), hashHex);
  }

  // Legacy format: SHA-256("salt_portfolio_os_" + password), no per-user salt.
  const encoder = new TextEncoder();
  const data = encoder.encode(`salt_portfolio_os_${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const legacyHex = toHex(new Uint8Array(hashBuffer));
  return timingSafeEqualHex(legacyHex, storedHash);
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Constant-time comparison of two equal-length hex strings. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Server functions (safe to import from client code) ───────────────────────
// createServerFn compiles these to isomorphic stubs; the .handler() callbacks
// only ever run on the server. Dynamic imports inside handlers keep server-only
// code (@tanstack/react-start/server, h3) out of the client bundle entirely.

export const getAdminAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminAuthSessionImpl } = await import("./admin-auth.server");
  return getAdminAuthSessionImpl();
});

export const signInAdminAction = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        isSignUp: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { signInAdminActionImpl } = await import("./admin-auth.server");
    return signInAdminActionImpl(data);
  });

export const signOutAdminAction = createServerFn({ method: "POST" }).handler(async () => {
  const { signOutAdminActionImpl } = await import("./admin-auth.server");
  return signOutAdminActionImpl();
});