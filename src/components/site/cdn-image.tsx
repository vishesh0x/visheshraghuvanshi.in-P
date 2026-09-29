import { useState, type ImgHTMLAttributes } from "react";

import { cdnImage, cdnImageEnabled, cdnImageSrcSet, type CdnSrcSetOptions } from "@/lib/site-image";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "width" | "height"> & {
  /** Stored image path/URL (e.g. project.cover_url). */
  src: string;
  alt: string;
  /** Candidate widths in device pixels, ascending. */
  widths: readonly number[];
  /** `sizes` attribute: how wide the image really renders (e.g. "(min-width: 1024px) 33vw, 100vw"). */
  sizes: string;
  /**
   * Set ONLY when the surrounding CSS box crops on purpose (cards, thumbnails).
   * The same ratio is sent to Cloudflare so the server-side crop matches the
   * CSS crop at every pixel ratio. Omit it to show the whole picture.
   */
  aspect?: number;
  quality?: number;
  /** Above-the-fold image: load eagerly with high fetch priority. */
  priority?: boolean;
};

/** Original, untransformed file URL for a stored path. */
function plainUrl(src: string): string {
  return /^https?:\/\//i.test(src) || src.startsWith("/") ? src : `/api/media/${src}`;
}

/**
 * <img> backed by Cloudflare Image Resizing, with two safety nets:
 *  - if the transformed URL errors (resizing not enabled for the zone,
 *    unsupported format, ...) it falls back to the original file instead of
 *    showing a broken image;
 *  - it NEVER crops unless `aspect` is provided.
 */
export function CdnImage({
  src,
  alt,
  widths,
  sizes,
  aspect,
  quality,
  priority = false,
  ...rest
}: Props) {
  const [failed, setFailed] = useState(false);
  const useCdn = cdnImageEnabled && !failed;

  const setOptions: CdnSrcSetOptions = {
    widths,
    ...(aspect ? { aspect, gravity: "auto" as const } : {}),
    ...(quality !== undefined ? { quality } : {}),
  };

  // `src` is the fallback for browsers that ignore srcset: use a mid-size candidate.
  const fallbackWidth = widths[Math.min(1, widths.length - 1)] ?? 800;

  return (
    <img
      src={
        useCdn
          ? cdnImage(src, {
              width: fallbackWidth,
              ...(aspect ? { height: Math.round(fallbackWidth / aspect), gravity: "auto" as const } : {}),
              ...(quality !== undefined ? { quality } : {}),
            })
          : plainUrl(src)
      }
      {...(useCdn ? { srcSet: cdnImageSrcSet(src, setOptions), sizes } : {})}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
