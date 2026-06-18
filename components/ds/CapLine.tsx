import type { CSSProperties } from "react";

interface CapLineProps {
  color?: string;
  weight?: number;
  width?: string | number;
  step?: number;
  stepAt?: number;
  style?: CSSProperties;
  className?: string;
}

/**
 * CapLine — BOW's signature graphic device. A thick horizontal rule with one
 * sharp step: the cap threshold, a decision point, a change in value.
 */
export default function CapLine({
  color = "var(--bow-blue)",
  weight = 6,
  width = "100%",
  step = 18,
  stepAt = 0.62,
  style,
  className,
}: CapLineProps) {
  return (
    <svg
      width={width}
      height={weight + step}
      viewBox={`0 0 100 ${weight + step}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible", ...style }}
      className={className}
      aria-hidden="true"
    >
      <rect x="0" y="0" width={stepAt * 100} height={weight} fill={color} />
      <rect x={stepAt * 100 - weight / 2} y="0" width={weight / 2} height={step + weight} fill={color} />
      <rect x={stepAt * 100 - weight / 2} y={step} width={100 - (stepAt * 100 - weight / 2)} height={weight} fill={color} />
    </svg>
  );
}
