import type { StudentScore } from "@/lib/scoring";
import { rankColor } from "@/components/profile/RankBadge";

/**
 * A leaderboard row. `display` is the privacy-safe name (first + last initial)
 * unless `fullName` is set (instructor viewing their own cohort).
 */
function Row({ row, highlight, fullName }: { row: StudentScore; highlight: boolean; fullName?: boolean }) {
  const accent = rankColor(row.rank.key);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 6,
        border: highlight ? "1px solid var(--bow-orange)" : "1px solid var(--bow-dark-border)",
        background: highlight ? "rgba(255,90,54,0.12)" : "var(--bow-dark-surface)",
      }}
    >
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, color: highlight ? "var(--bow-orange)" : "#9a9da6" }}>
        {row.position}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, textTransform: "uppercase", letterSpacing: "0.01em", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {fullName ? row.name : row.publicName}{highlight ? " · You" : ""}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: accent }}>{row.rank.name}</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, color: "#6d7078" }}>{row.cohortName}</span>
        </span>
      </span>
      <span style={{ textAlign: "right" }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, color: "#fff" }}>{row.bowScore}</span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>BOW Score</span>
      </span>
    </div>
  );
}

interface Props {
  rows: StudentScore[];
  highlightId?: string | null;
  /** Show full names instead of first + last initial (instructor's own cohort). */
  fullName?: boolean;
  /** Appended below the top list when the viewer ranks outside it. */
  ownRow?: StudentScore | null;
}

/** The ranked leaderboard list, with the viewer's row highlighted. */
export default function LeaderboardTable({ rows, highlightId, fullName, ownRow }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => (
        <Row key={r.studentId} row={r} highlight={r.studentId === highlightId} fullName={fullName} />
      ))}
      {ownRow && (
        <>
          <div style={{ textAlign: "center", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078", padding: "6px 0" }}>
            ··· You are ranked #{ownRow.position} ···
          </div>
          <Row row={ownRow} highlight fullName={fullName} />
        </>
      )}
      {rows.length === 0 && (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "#9a9da6", padding: "20px 0" }}>
          No students on the board yet for this filter. Complete modules, answer BOW Daily, and run the Simulation Room to climb.
        </p>
      )}
    </div>
  );
}
