import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/site-url";

/**
 * robots.txt generated from SITE_URL so the Sitemap line can never point at a
 * placeholder domain again.
 *
 * `/api/media/` is explicitly allowed: it serves every project cover and Now
 * image, and a blanket `Disallow: /api/` stops Google Images and preview bots
 * from ever indexing them.
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          "User-agent: *",
          "Allow: /",
          "Allow: /api/media/",
          "Allow: /cdn-cgi/image/",
          "Disallow: /admin",
          "Disallow: /auth",
          "Disallow: /api/",
          "Disallow: /_serverFn/",
          "",
          `Sitemap: ${SITE_URL}/sitemap.xml`,
          "",
        ].join("\n");
        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
