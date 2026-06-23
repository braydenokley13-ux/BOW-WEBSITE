import type { AuthorRank } from "@/lib/discussion";

/** Accent color for a BOW rank chip (rookie=slate, scout=blue, analyst=orange, front-office=positive). */
function chipColor(key: AuthorRank["key"]): string {
  switch (key) {
    case "front-office":
      return "var(--bow-positive)";
    case "analyst":
      return "var(--bow-orange)";
    case "scout":
      return "var(--bow-blue)";
    default:
      return "var(--bow-slate)";
  }
}

/**
 * A tiny pill showing a BOW rank name, colored by rank key. Directive-free so
 * it works in server- or client-rendered trees.
 */
export default function RankChip({ rank }: { rank: AuthorRank }) {
  const accent = chipColor(rank.key);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: accent,
        border: `1px solid ${accent}`,
        borderRadius: 999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: accent }} />
      {rank.name}
    </span>
  );
}
