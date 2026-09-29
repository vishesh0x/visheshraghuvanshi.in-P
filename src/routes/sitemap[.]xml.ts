import { createFileRoute } from "@tanstack/react-router";

/** Conventional /sitemap.xml location - same document as /api/sitemap. */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { buildSitemapResponse } = await import("@/lib/sitemap.server");
        return buildSitemapResponse();
      },
    },
  },
});
