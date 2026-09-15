/**
 * Builds a Cloudflare Image Resizing URL that transforms an image on the
 * fly - resized, recompressed, format-negotiated (WebP/AVIF where the
 * visitor's browser supports it) - without storing anything beyond the
 * single original file already sitting in R2.
 *
 * How this differs from the "Cloudflare Images" product: that's a separate
 * paid storage+delivery service you'd upload a *copy* of each file into.
 * This is "Image Resizing" (also billed as "Transform via URL"/"Transform
 * via Workers" in Cloudflare's docs) - it fetches an existing origin URL
 * (here, our own /api/media/<path> route, which already streams the
 * original straight from R2) and resizes/recompresses the response at
 * Cloudflare's edge, caching the transformed variant there. The R2 object
 * itself is never touched, copied, or duplicated.
 *
 * REQUIRES: "Image Resizing" enabled for this zone in the Cloudflare
 * dashboard (Speed -> Optimization -> Image Resizing, or the Images tab,
 * depending on current dashboard layout - Cloudflare's plan/pricing
 * boundaries for this feature have shifted over time, so check what's
 * currently included in your plan rather than trusting a fixed claim here).
 * This is OFF by default (see VITE_CF_IMAGE_RESIZING in .env.sample) -
 * until both that env var is set to "true" AND the dashboard setting is
 * confirmed on, every image call here just serves the plain, untransformed
 * /api/media URL, so nothing breaks in the meantime.
 */

export type ImageFit = "cover" | "contain" | "scale-down";

export interface CdnImageOptions {
  /** Target width in CSS pixels the image will actually render at. */
  width: number;
  /** Only needed when fit is "cover"/"contain" and you want a fixed aspect box. */
  height?: number;
  fit?: ImageFit;
  /** 1-100. 75 is a good default - visually lossless for photos at typical sizes. */
  quality?: number;
}

const RESIZING_ENABLED =
  (import.meta.env.VITE_CF_IMAGE_RESIZING ?? "false").toString().toLowerCase() === "true";

export function cdnImage(originPath: string, opts: CdnImageOptions): string {
  const source = originPath.startsWith("/") ? originPath : `/api/media/${originPath}`;

  if (!RESIZING_ENABLED) return source;

  const params = [
    `width=${opts.width}`,
    opts.height ? `height=${opts.height}` : null,
    `fit=${opts.fit ?? "cover"}`,
    `quality=${opts.quality ?? 75}`,
    "format=auto",
  ]
    .filter(Boolean)
    .join(",");

  // Cloudflare intercepts this exact path prefix at the edge - it's not a
  // route this app's own Worker code handles or needs to know about.
  return `/cdn-cgi/image/${params}${source}`;
}

/** Builds a `srcSet` covering common device pixel ratios for a given render width. */
export function cdnImageSrcSet(originPath: string, opts: CdnImageOptions): string {
  return [1, 1.5, 2]
    .map((scale) => {
      const width = Math.round(opts.width * scale);
      return `${cdnImage(originPath, { ...opts, width })} ${scale}x`;
    })
    .join(", ");
}
