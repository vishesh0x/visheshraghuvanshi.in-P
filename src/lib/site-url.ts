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

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
