/**
 * Canonical site origin, used for <link rel="canonical">, absolute Open Graph
 * image URLs, JSON-LD, and the sitemap.
 *
 * IMPORTANT: replace the fallback below with your real production domain
 * (no trailing slash), or set VITE_SITE_URL in your environment / .env file.
 * The same domain should also be used in the `Sitemap:` line of
 * public/robots.txt.
 */
export const SITE_URL: string = (
  (import.meta.env["VITE_SITE_URL"] as string | undefined) || "https://example.com"
).replace(/\/+$/, "");

if (import.meta.env.PROD && SITE_URL === "https://example.com") {
  // Canonical tags, Open Graph URLs, JSON-LD, robots.txt and the sitemap all
  // derive from this. Left at the fallback, search engines are told your site
  // lives at example.com.
  console.warn(
    "[site-url] VITE_SITE_URL is not set - canonical/OG/sitemap URLs point at https://example.com. " +
      "Set VITE_SITE_URL to your real origin at BUILD time.",
  );
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
