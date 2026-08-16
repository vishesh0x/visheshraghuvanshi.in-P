import { createFileRoute } from "@tanstack/react-router";
import { getR2Bucket } from "@/lib/db/d1.server";

/**
 * Media proxy for Cloudflare R2 object storage.
 * Publicly streams assets from the R2 bucket via /api/media/<path>.
 */
export const Route = createFileRoute("/api/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const r2 = getR2Bucket();
        if (!r2) {
          return new Response("R2 storage unavailable", { status: 503 });
        }

        const object = await r2.get(path);
        if (!object) {
          return new Response("Not found", { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("cache-control", "public, max-age=31536000, immutable");

        return new Response(object.body, { headers });
      },
    },
  },
});
