import { RISK_COLORS, RISK_LABELS, type RiskLevel } from "@/lib/intelligence-types";

interface RiskPillProps {
  label: string;
  level: RiskLevel;
  note?: string;
}

/**
 * RiskPill — a named risk with a level chip (color dot + text, never color
 * alone). With `note`, renders the full label + chip + explanation row used
 * for RiskFactor lists in player memos.
 */
export default function RiskPill({ label, level, note }: RiskPillProps) {
  const color = RISK_COLORS[level];
  const chip = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-data)",
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--bow-ink)",
        border: "1px solid var(--border-rule)",
        background: "var(--bow-white)",
        padding: "3px 9px",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      {RISK_LABELS[level]}
    </span>
  );

  if (!note) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, fontWeight: 600, color: "var(--bow-ink)" }}>{label}</span>
        {chip}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", padding: "10px 0", borderTop: "1px solid var(--border-rule)" }}>
      <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, fontWeight: 600, color: "var(--bow-ink)", flex: "0 0 140px" }}>{label}</span>
      {chip}
      <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: "var(--bow-slate)", flex: "1 1 220px" }}>{note}</span>
    </div>
  );
}
