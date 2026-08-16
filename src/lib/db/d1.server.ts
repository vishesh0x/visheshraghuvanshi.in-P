import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export interface CloudflareEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  ASSETS?: Fetcher;
  [key: string]: unknown;
}

function getRuntimeEnv(): CloudflareEnv {
  const g = globalThis as typeof globalThis & {
    __env__?: CloudflareEnv;
  };

  return g.__env__ ?? {};
}

export function getCloudflareEnv(): CloudflareEnv {
  return getRuntimeEnv();
}

export function getD1Database(): D1Database {
  const env = getCloudflareEnv();

  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding (DB) is not available. Check your Wrangler D1 binding configuration."
    );
  }

  return env.DB;
}

export function getR2Bucket(): R2Bucket {
  const env = getCloudflareEnv();

  if (!env.MEDIA) {
    throw new Error(
      "Cloudflare R2 binding (MEDIA) is not available. Check your Wrangler R2 binding configuration."
    );
  }

  return env.MEDIA;
}