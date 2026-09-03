import type { D1Database } from "@cloudflare/workers-types";

/**
 * Lightweight fixed-window rate limiting for public, unauthenticated
 * endpoints - no new Cloudflare bindings required.
 *
 * Cloudflare's native Workers Rate Limiting binding only supports fixed
 * windows of 10 or 60 seconds, which doesn't cover a "5 per 10 minutes"
 * policy directly, and Workers KV would mean provisioning + wiring up a new
 * binding for something this app's actual traffic doesn't need yet. D1 is
 * already bound, already stores every contact submission with a hashed IP,
 * and a COUNT(*) over the last N seconds is one indexed query - simplest
 * thing that is actually correct for this endpoint's real scale.
 *
 * If this ever needs to run in front of the D1 write itself (e.g. to shed
 * load before touching the database at all), swap this for the Workers
 * Rate Limiting binding - the call shape below is deliberately similar to
 * `env.RATE_LIMITER.limit({ key })` so that swap is a small diff, not a
 * rewrite.
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Requests still available in the current window. */
  remaining: number;
  /** Seconds until the caller should retry. */
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  db: D1Database,
  table: string,
  keyColumn: string,
  key: string,
  { max, windowSeconds }: { max: number; windowSeconds: number },
): Promise<RateLimitResult> {
  // table/keyColumn are only ever passed as hardcoded literals from our own
  // call sites below, never derived from request input, so interpolating
  // them here doesn't open a SQL-injection path - only `key` is
  // request-derived, and that's passed through a parameterized bind().
  const row = await db
    .prepare(
      `SELECT COUNT(*) as count FROM ${table} WHERE ${keyColumn} = ? AND created_at > datetime('now', ?)`,
    )
    .bind(key, `-${windowSeconds} seconds`)
    .first<{ count: number }>();

  const count = row?.count ?? 0;
  return {
    allowed: count < max,
    remaining: Math.max(0, max - count),
    retryAfterSeconds: windowSeconds,
  };
}

export const CONTACT_RATE_LIMIT = { max: 5, windowSeconds: 10 * 60 };

export const RATE_LIMIT_MESSAGE = "Too many requests. Please try again later.";
