import { createFileRoute } from "@tanstack/react-router";

/**
 * Dynamic PWA manifest. Static /manifest.json ignored a custom favicon
 * uploaded from the admin dashboard the same way the <link rel="icon"> tags
 * used to - the "Add to Home Screen" icon would silently keep using the
 * bundled default. This regenerates it from the current site config.
 */
export const Route = createFileRoute("/api/manifest")({
  server: {
    handlers: {
      GET: async () => {
        let siteTitle = "Portfolio OS";
        let faviconUrl: string | null = null;

        try {
          const { getSiteConfig } = await import("@/lib/cms/public.functions");
          const config = await getSiteConfig();
          siteTitle = config.site_title || siteTitle;
          faviconUrl = config.favicon_url;
        } catch (err) {
          console.warn("[api/manifest] could not load site config, using defaults", err);
        }

        const icons = faviconUrl
          ? [{ src: faviconUrl, sizes: "512x512", type: "image/png", purpose: "any" }]
          : [
              { src: "/favicon-32.png", sizes: "32x32", type: "image/png", purpose: "any" },
              { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
              { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
              // Full-bleed artwork inside the 80% safe zone, so Android's adaptive
              // icon masks (circle, squircle...) never clip the monogram.
              { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            ];

        const manifest = {
          name: siteTitle,
          short_name: siteTitle,
          description: "A self-hosted portfolio and content management system.",
          start_url: "/",
          display: "standalone",
          background_color: "#14171F",
          theme_color: "#14171F",
          icons,
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
