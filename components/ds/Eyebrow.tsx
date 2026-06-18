import type { CSSProperties, ElementType, ReactNode } from "react";

type EyebrowColor = "blue" | "orange" | "positive" | "slate" | "inherit";

interface EyebrowProps {
  children: ReactNode;
  color?: EyebrowColor;
  as?: ElementType;
  style?: CSSProperties;
  className?: string;
}

const colorMap: Record<EyebrowColor, string> = {
  blue: "var(--bow-blue)",
  orange: "var(--bow-orange)",
  positive: "var(--bow-positive)",
  slate: "var(--bow-slate)",
  inherit: "currentColor",
};

/** Eyebrow — the category / section kicker. Display voice, uppercase, tracked. */
export default function Eyebrow({ children, color = "blue", as: Tag = "div", style, className }: EyebrowProps) {
  return (
    <Tag
      className={className}
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: "var(--type-eyebrow)",
        lineHeight: "var(--lh-eyebrow)",
        letterSpacing: "var(--track-eyebrow)",
        textTransform: "uppercase",
        color: colorMap[color] || colorMap.blue,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
