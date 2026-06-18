import type { CSSProperties, ReactNode } from "react";

type Status = "positive" | "warning" | "negative" | "info" | "neutral" | "locked";

interface BadgeProps {
  children: ReactNode;
  status?: Status;
  solid?: boolean;
  style?: CSSProperties;
  className?: string;
}

const map: Record<Status, { c: string; t: string }> = {
  positive: { c: "var(--bow-positive)", t: "var(--bow-positive-tint)" },
  warning: { c: "var(--bow-warning)", t: "var(--bow-warning-tint)" },
  negative: { c: "var(--bow-negative)", t: "var(--bow-negative-tint)" },
  info: { c: "var(--bow-blue)", t: "var(--bow-blue-tint)" },
  neutral: { c: "var(--bow-slate)", t: "#ecebe6" },
  locked: { c: "var(--bow-inactive)", t: "#ecedef" },
};

/** Badge — a compact status signal communicating MEANING, not decoration. */
export default function Badge({ children, status = "info", solid = false, style, className }: BadgeProps) {
  const { c, t } = map[status];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-data)",
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "4px 9px",
        borderRadius: "var(--radius-control)",
        color: solid ? "var(--bow-white)" : c,
        background: solid ? c : t,
        border: solid ? `1px solid ${c}` : "1px solid transparent",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
