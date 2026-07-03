import { VERDICT_COLORS, VERDICT_LABELS, type VerdictTier } from "@/lib/intelligence-types";

interface VerdictBadgeProps {
  tier: VerdictTier;
  size?: "sm" | "lg";
}

/**
 * VerdictBadge — the contract-verdict chip. Sibling of components/analytics/ApronBadge:
 * a color dot plus an always-present text label, so the verdict never rides on color alone.
 */
export default function VerdictBadge({ tier, size = "sm" }: VerdictBadgeProps) {
  const color = VERDICT_COLORS[tier];
  const lg = size === "lg";
  return (
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
}
