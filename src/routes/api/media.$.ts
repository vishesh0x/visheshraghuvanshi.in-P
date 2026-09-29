import { createFileRoute } from "@tanstack/react-router";
import { getR2Bucket } from "@/lib/db/d1.server";

/**
 * Media proxy for Cloudflare R2 object storage.
 * Publicly streams assets from the R2 bucket via /api/media/<path>.
 *
 * These files are served from the SAME origin as the admin dashboard, so they
 * are locked down: no MIME sniffing, and a sandboxing CSP so that even if a
 * hostile file ever reached the bucket it could not execute script here.
 */
export const Route = createFileRoute("/api/media/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        let path = params._splat ?? "";
        try {
          path = decodeURIComponent(path);
        } catch {
          return new Response("Not found", { status: 404 });
        }
        if (
          !path ||
          path.length > 300 ||
          path.startsWith("/") ||
          path.includes("..") ||
          path.includes("\\") ||
          path.includes("\0")
        ) {
          return new Response("Not found", { status: 404 });
        }

        let object;
        try {
          object = await getR2Bucket().get(path);
        } catch (err) {
          console.error("[api/media] R2 unavailable", err);
          return new Response("R2 storage unavailable", { status: 503 });
        }
        if (!object) {
          return new Response("Not found", { status: 404 });
        }

        const etag = object.httpEtag;
        const baseHeaders: Record<string, string> = {
          etag,
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          "cross-origin-resource-policy": "cross-origin",
        };

        // Conditional request: skip re-sending the body when the browser already has it.
        if (request.headers.get("if-none-match") === etag) {
          return new Response(null, { status: 304, headers: baseHeaders });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers as never);
        for (const [key, value] of Object.entries(baseHeaders)) headers.set(key, value);
        // Only ever render known-safe types inline; everything else downloads.
        const type = headers.get("content-type") ?? "";
        if (!/^(image\/(png|jpeg|webp|gif|avif|x-icon|vnd\.microsoft\.icon)|application\/pdf)$/i.test(type)) {
          headers.set("content-disposition", "attachment");
        }

        return new Response(object.body as unknown as BodyInit, { headers });
      },
    },
  },
});
