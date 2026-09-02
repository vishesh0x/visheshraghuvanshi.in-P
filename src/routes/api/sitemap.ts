import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "@/lib/site-url";

/**
 * Dynamic XML sitemap. Combines static routes with every published project so
 * new case studies are picked up automatically without a redeploy.
 *
 * Exposed at /api/sitemap and linked from public/robots.txt via the
 * `Sitemap:` directive - the sitemap protocol does not require the file to
 * live at exactly "/sitemap.xml".
 */
export const Route = createFileRoute("/api/sitemap")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString();

        const staticEntries: { path: string; changefreq: string; priority: string }[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/projects", changefreq: "weekly", priority: "0.9" },
          { path: "/resume", changefreq: "monthly", priority: "0.6" },
          { path: "/now", changefreq: "weekly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.5" },
          { path: "/faq", changefreq: "monthly", priority: "0.4" },
          { path: "/privacy", changefreq: "yearly", priority: "0.2" },
          { path: "/terms", changefreq: "yearly", priority: "0.2" },
        ];

        let projectEntries: { path: string; updated_at: string }[] = [];
        try {
          const { listProjects } = await import("@/lib/cms/public.functions");
          const projects = await listProjects();
          projectEntries = projects.map((p) => ({
            path: `/projects/${p.slug}`,
            updated_at: p.updated_at,
          }));
        } catch (err) {
          console.warn("[api/sitemap] could not load projects, using static entries only", err);
        }

        const urls = [
          ...staticEntries.map(
            (entry) => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
          ),
          ...projectEntries.map(
            (entry) => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.updated_at}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`,
          ),
        ].join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
