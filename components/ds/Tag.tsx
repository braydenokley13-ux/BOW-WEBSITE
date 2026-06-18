import type { CSSProperties, ReactNode } from "react";

type Tone = "outline" | "solid" | "blue" | "orange";

interface TagProps {
  children: ReactNode;
  tone?: Tone;
  active?: boolean;
  style?: CSSProperties;
  className?: string;
}

const tones: Record<Tone, CSSProperties> = {
  outline: { background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-rule)" },
  solid: { background: "var(--bow-ink)", color: "var(--bow-white)", border: "1px solid var(--bow-ink)" },
  blue: { background: "var(--bow-blue-tint)", color: "var(--bow-blue)", border: "1px solid transparent" },
  orange: { background: "var(--bow-orange-tint)", color: "var(--bow-orange)", border: "1px solid transparent" },
};

const activeStyle: CSSProperties = {
  background: "var(--bow-blue)",
  color: "var(--bow-white)",
  border: "1px solid var(--bow-blue)",
};

/** Tag — a pill-shaped label (the one place pill shapes are allowed). */
export default function Tag({ children, tone = "outline", active = false, style, className }: TagProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-interface)",
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: "0.02em",
        padding: "5px 12px",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
        ...(active ? activeStyle : tones[tone]),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
