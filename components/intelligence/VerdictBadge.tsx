import { VERDICT_COLORS, VERDICT_LABELS, type VerdictTier } from "@/lib/intelligence-types";

interface VerdictBadgeProps {
  tier: VerdictTier;
  size?: "sm" | "lg";
}

/**
 * VerdictBadge — the contract-verdict chip. Sibling of components/analytics/ApronBadge:
 * a color dot plus an always-present text label, so the verdict never rides on color alone.
 *
 * The `lg` size is reserved for headline verdict spots (executive summaries, contract-verdict
 * embeds) — those get a quiet "under these assumptions" caption so the tier never reads as
 * settled fact. `sm` badges (table rows, asset cards) stay caption-free; repeating the
 * reminder on every row would just be noise.
 */
export default function VerdictBadge({ tier, size = "sm" }: VerdictBadgeProps) {
  const color = VERDICT_COLORS[tier];
  const lg = size === "lg";
  const pill = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: lg ? 8 : 6,
        fontFamily: "var(--font-data)",
        fontWeight: 600,
        fontSize: lg ? 13 : 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--bow-ink)",
        border: "1px solid var(--border-rule)",
        background: "var(--bow-white)",
        padding: lg ? "6px 13px" : "3px 9px",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true" style={{ width: lg ? 9 : 8, height: lg ? 9 : 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      {VERDICT_LABELS[tier]}
    </span>
  );

  if (!lg) return pill;

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
      {pill}
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
        }}
      >
        under these assumptions
      </span>
    </span>
  );
}
