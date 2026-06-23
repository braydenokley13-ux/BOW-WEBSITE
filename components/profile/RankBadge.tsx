import type { BowRank } from "@/lib/scoring";

/** Accent color for a BOW rank (directive-free so it works server- or client-side). */
export function rankColor(key: BowRank["key"]): string {
  switch (key) {
    case "front-office":
      return "var(--bow-orange)";
    case "analyst":
      return "var(--bow-warning)";
    case "scout":
      return "var(--bow-blue)";
    default:
      return "var(--bow-slate)";
  }
}

/**
 * The BOW Rank achievement badge — rank name + one-line description, with a
 * rank-colored accent. Used on the dashboard, profile, and public profile.
 */
export default function RankBadge({ rank, dark = false }: { rank: BowRank; dark?: boolean }) {
  const accent = rankColor(rank.key);
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 4,
        border: `1px solid ${accent}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: 6,
        padding: "12px 16px",
        background: dark ? "rgba(255,255,255,0.04)" : "var(--bow-white)",
        maxWidth: 360,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: accent }} />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "0.01em", textTransform: "uppercase", color: dark ? "#fff" : "var(--bow-ink)" }}>
          {rank.name}
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: accent }}>
          BOW Rank
        </span>
      </span>
      <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: dark ? "#b9bcc4" : "var(--bow-slate)" }}>
        {rank.description}
      </span>
    </div>
  );
}
