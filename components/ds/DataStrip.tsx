import type { CSSProperties } from "react";

export interface DataItem {
  label: string;
  value: string;
  tone?: "positive" | "warning" | "negative" | "info";
}

interface DataStripProps {
  items: DataItem[];
  dark?: boolean;
  dense?: boolean;
  style?: CSSProperties;
  className?: string;
}

const toneColor: Record<NonNullable<DataItem["tone"]>, string> = {
  positive: "var(--bow-positive)",
  warning: "var(--bow-warning)",
  negative: "var(--bow-negative)",
  info: "var(--bow-blue)",
};

/** DataStrip — compact horizontal information instead of dashboard tiles. */
export default function DataStrip({ items, dark = false, dense = false, style, className }: DataStripProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "stretch",
        border: dark ? "1px solid var(--bow-dark-border)" : "1px solid var(--border-rule)",
        background: dark ? "var(--bow-dark-surface)" : "var(--bow-white)",
        ...style,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: dense ? 3 : 6,
            padding: dense ? "12px 16px" : "16px 22px",
            flex: "1 1 auto",
            minWidth: 120,
            borderLeft: i === 0 ? "none" : dark ? "1px solid var(--bow-dark-border)" : "1px solid var(--border-rule)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: dark ? "#9a9da6" : "var(--bow-slate)",
            }}
          >
            {it.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontWeight: 600,
              fontSize: dense ? 18 : 22,
              letterSpacing: "0.01em",
              fontVariantNumeric: "tabular-nums",
              color: it.tone ? toneColor[it.tone] : dark ? "var(--bow-white)" : "var(--bow-ink)",
            }}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}
