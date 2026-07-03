import { APRON_COLORS, APRON_LABELS, type ApronStatus } from "@/lib/aasv";

/**
 * Apron-tier chip — the status encoding used across the analytics
 * section (table, cards, chart legend). Color + text label together,
 * never color alone.
 */
export default function ApronBadge({ status, compact = false }: { status: ApronStatus; compact?: boolean }) {
  const color = APRON_COLORS[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-data)",
        fontSize: compact ? 10 : 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--bow-ink)",
        border: "1px solid var(--border-rule)",
        background: "var(--bow-white)",
        padding: compact ? "2px 7px" : "3px 9px",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      {APRON_LABELS[status]}
    </span>
  );
}
