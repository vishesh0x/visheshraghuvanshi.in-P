/**
 * Client-safe Cloudflare D1 / R2 type exports.
 * This file must NOT import from @tanstack/react-start/server - it is
 * imported by client-side route components (e.g. admin.tsx).
 *
 * All runtime access to Cloudflare bindings lives in d1.server.ts.
 */

export interface CloudflareEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  ADMIN_SESSION_SECRET?: string;
  ADMIN_PASSWORD_HASH?: string;
  TURNSTILE_SECRET_KEY?: string;
}
