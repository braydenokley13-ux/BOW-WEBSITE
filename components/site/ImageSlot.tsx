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
 * raster imagery, so unfilled slots render an intentional editorial placeholder.
 * Drop a real `src` (e.g. an athlete cutout) to fill it.
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "repeating-linear-gradient(135deg, rgba(127,127,140,0.10) 0 2px, transparent 2px 12px)",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          mixBlendMode: "difference",
          padding: "4px 10px",
          textAlign: "center",
        }}
      >
        {placeholder}
      </span>
    </div>
  );
}
