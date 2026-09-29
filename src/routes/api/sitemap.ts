import { createFileRoute } from "@tanstack/react-router";

/**
 * Dynamic XML sitemap. Combines static routes with every published project so
 * new case studies are picked up automatically without a redeploy.
 * Also exposed at the conventional /sitemap.xml.
 */
export const Route = createFileRoute("/api/sitemap")({
  server: {
    handlers: {
      GET: async () => {
        const { buildSitemapResponse } = await import("@/lib/sitemap.server");
        return buildSitemapResponse();
      },
    },
  },
});
