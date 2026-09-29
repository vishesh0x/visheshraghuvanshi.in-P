import { SITE_URL } from "@/lib/site-url";

const STATIC_ENTRIES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/projects", changefreq: "weekly", priority: "0.9" },
  { path: "/resume", changefreq: "monthly", priority: "0.6" },
  { path: "/now", changefreq: "weekly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/faq", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy", changefreq: "yearly", priority: "0.2" },
  { path: "/terms", changefreq: "yearly", priority: "0.2" },
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds the XML sitemap response. Shared by /api/sitemap and /sitemap.xml
 * (a Worker can't reliably fetch() its own hostname, so the second route calls
 * this directly instead of proxying the first).
 *
 * Static pages carry no <lastmod>: the real modification time isn't tracked,
 * and stamping "now" on every request tells crawlers everything changes hourly.
 */
export async function buildSitemapResponse(): Promise<Response> {
  let projectEntries: { path: string; updated_at: string }[] = [];
  try {
    const { listProjects } = await import("@/lib/cms/public.functions");
    const projects = await listProjects();
    projectEntries = projects.map((p) => ({
      path: `/projects/${p.slug}`,
      updated_at: p.updated_at,
    }));
  } catch (err) {
    console.warn("[sitemap] could not load projects, using static entries only", err);
  }

  const urls = [
    ...STATIC_ENTRIES.map(
      (entry) => `  <url>
    <loc>${xmlEscape(SITE_URL + entry.path)}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    ),
    ...projectEntries.map(
      (entry) => `  <url>
    <loc>${xmlEscape(SITE_URL + entry.path)}</loc>
    <lastmod>${xmlEscape(entry.updated_at.replace(" ", "T"))}</lastmod>
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
}
