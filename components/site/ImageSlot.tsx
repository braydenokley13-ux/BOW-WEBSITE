import type { CSSProperties } from "react";

interface ImageSlotProps {
  /** When provided, the slot renders the image; otherwise a styled placeholder. */
  src?: string;
  alt?: string;
  placeholder?: string;
  fit?: "cover" | "contain" | "fill";
  position?: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * ImageSlot — stand-in for the design tool's <image-slot>. The handoff ships no
 * raster imagery, so an unfilled slot renders as an intentional abstract
 * treatment (a subtle diagonal hatch) — never internal design-instruction text
 * that would leak onto a public page. The `placeholder` string is used only as
 * the accessible label. Drop a real `src` (e.g. an athlete cutout) to fill it.
 */
export default function ImageSlot({
  src,
  alt = "",
  placeholder = "Image",
  fit = "cover",
  position = "50% 50%",
  style,
  className,
}: ImageSlotProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        style={{ objectFit: fit, objectPosition: position, ...style }}
      />
    );
  }
  return (
    <div
      className={className}
      role="img"
      aria-label={placeholder}
      style={{
        background: "repeating-linear-gradient(135deg, rgba(127,127,140,0.10) 0 2px, transparent 2px 12px)",
        ...style,
      }}
    />
  );
}
