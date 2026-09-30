import type { SVGProps } from "react";

/**
 * VR symbol from the Vishesh Raghuvanshi logo kit: V and R share one stroke
 * (the V's right arm is the R's stem), leaning at 15 degrees. Single path, so it
 * follows the surrounding text colour via currentColor (light/dark safe).
 *
 * `size="small"` is the kit's small-size cut (slightly larger R counter so it
 * stays open); the guidelines call for it below 32px tall. `size="full"` is the
 * master. Path data is copied verbatim from vr-symbol.svg / vr-symbol-small.svg.
 */
type Props = Omit<SVGProps<SVGSVGElement>, "viewBox" | "children"> & {
  size?: "small" | "full";
  /** Accessible name; pass "" when the mark is purely decorative next to a text label. */
  title?: string;
};

const VIEWBOX = "18.5 32 219 192";
const PATHS = {
  full: "M18.5 32 L66.5 32 L93.9 134.4 L121.4 32 L169.4 32 L117.9 224 L69.9 224 Z M169.4 32 H177.4 A56 56 0 0 1 177.4 144 L139.3 144 Z M125.5 120 L177.5 120 L237.5 224 L185.5 224 Z M159.2 70 L149.5 106 H177.4 A18 18 0 0 0 177.4 70 Z",
  small: "M18.5 32 L66.5 32 L93.9 134.4 L121.4 32 L169.4 32 L117.9 224 L69.9 224 Z M169.4 32 H177.4 A56 56 0 0 1 177.4 144 L139.3 144 Z M125.5 120 L177.5 120 L237.5 224 L185.5 224 Z M160.2 66 L148.5 110 H177.4 A22 22 0 0 0 177.4 66 Z",
} as const;

export function LogoMark({ size = "small", title = "Vishesh Raghuvanshi", ...props }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={VIEWBOX}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" d={PATHS[size]} />
    </svg>
  );
}
