/**
 * Cloudflare Image Resizing helpers ("Transform via URL").
 *
 * Builds `/cdn-cgi/image/<options>/<origin>` URLs that resize, recompress and
 * format-negotiate (WebP/AVIF) an image at Cloudflare's edge. The R2 object
 * itself is never copied or modified.
 *
 * Off by default: set VITE_CF_IMAGE_RESIZING="true" at build time AND enable
 * Image Resizing for the zone in the Cloudflare dashboard. Until then every
 * helper returns the plain, untransformed /api/media URL.
 *
 * ── Why images used to crop ───────────────────────────────────────────────
 * 1. `cdnImageSrcSet` scaled the WIDTH for each pixel ratio but reused the
 *    same fixed HEIGHT, so at 1.5x/2x Cloudflare was asked for e.g.
 *    1400x394 with fit=cover - a 3.5:1 strip cut out of the middle.
 * 2. `sizes` was passed alongside `1x/1.5x/2x` descriptors, where browsers
 *    ignore it (it only applies to `w` descriptors).
 * 3. The project page then forced 16:9 + object-cover on 4:3 artwork.
 *
 * The rules below make that class of bug impossible:
 *   - A responsive set is built from an ASPECT RATIO, so height always
 *     follows width and every candidate is the same crop.
 *   - No aspect ratio => no height => the image is only ever scaled
 *     (fit=scale-down: never upscaled, never cropped).
 *   - Sets use `w` descriptors, so `sizes` actually works.
 */

export type ImageFit = "cover" | "contain" | "scale-down";

export interface CdnImageOptions {
  /** Target width in CSS pixels. */
  width: number;
  /** Only meaningful with fit "cover"/"contain". Omit to preserve aspect ratio. */
  height?: number;
  fit?: ImageFit;
  /** 1-100. 75 is visually lossless for photos at typical sizes. */
  quality?: number;
  /** Where to keep the subject when cropping with fit "cover". */
  gravity?: "auto" | "center" | "top" | "bottom" | "left" | "right";
}

export interface CdnSrcSetOptions {
  /** Candidate widths in device pixels, ascending. */
  widths: readonly number[];
  /**
   * width / height of the box the image is displayed in (e.g. 4 / 3).
   * Provide it ONLY when the box crops the image on purpose (cards, thumbnails).
   * Omit it to show the whole image, uncropped.
   */
  aspect?: number;
  fit?: ImageFit;
  quality?: number;
  gravity?: CdnImageOptions["gravity"];
}

const RESIZING_ENABLED =
  String(import.meta.env["VITE_CF_IMAGE_RESIZING"] ?? "false").toLowerCase() === "true";

export const cdnImageEnabled = RESIZING_ENABLED;

/** Resolve a stored value (`/api/media/x.jpg`, `2026/x.jpg` or an https URL) to a fetchable source. */
function resolveSource(originPath: string): string {
  if (/^https?:\/\//i.test(originPath)) return originPath;
  return originPath.startsWith("/") ? originPath : `/api/media/${originPath}`;
}

/** Only same-origin sources and http(s) URLs can be transformed. */
function canTransform(source: string): boolean {
  return source.startsWith("/api/media/") || /^https?:\/\//i.test(source);
}

export function cdnImage(originPath: string, opts: CdnImageOptions): string {
  const source = resolveSource(originPath);
  if (!RESIZING_ENABLED || !canTransform(source)) return source;

  const cropping = opts.height !== undefined;
  // Never crop unless the caller asked for a box; never upscale a small original.
  const fit = opts.fit ?? (cropping ? "cover" : "scale-down");

  const params = [
    `width=${Math.round(opts.width)}`,
    cropping ? `height=${Math.round(opts.height as number)}` : null,
    `fit=${fit}`,
    fit === "cover" && opts.gravity ? `gravity=${opts.gravity}` : null,
    `quality=${opts.quality ?? 75}`,
    "format=auto",
    "metadata=none",
  ]
    .filter(Boolean)
    .join(",");

  // Cloudflare handles this prefix at the edge; the app's Worker never sees it.
  return `/cdn-cgi/image/${params}${source.startsWith("/") ? source : `/${source}`}`;
}

/**
 * `srcset` using width descriptors. Height is derived from `aspect` for EVERY
 * candidate, so all of them are the same crop of the same picture.
 */
export function cdnImageSrcSet(originPath: string, opts: CdnSrcSetOptions): string {
  return opts.widths
    .map((width) => {
      const url = cdnImage(originPath, {
        width,
        ...(opts.aspect ? { height: Math.round(width / opts.aspect) } : {}),
        ...(opts.fit ? { fit: opts.fit } : {}),
        ...(opts.quality !== undefined ? { quality: opts.quality } : {}),
        ...(opts.gravity ? { gravity: opts.gravity } : {}),
      });
      return `${url} ${width}w`;
    })
    .join(", ");
}
