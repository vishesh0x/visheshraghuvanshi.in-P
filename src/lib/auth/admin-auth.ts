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

/** Hash a plain password using Web Crypto SHA-256 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`salt_portfolio_os_${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify password against stored hash */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const computedHash = await hashPassword(password);
  return computedHash === storedHash;
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