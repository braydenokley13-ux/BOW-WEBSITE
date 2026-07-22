import Link from "next/link";
import type { LeaderboardRow } from "@/lib/leaderboard";

/* ============================================================
 * LeaderboardTile — Stage 9 scoped leaderboard on StudentHome.
 *
 * Compact by design (top 5 + your-rank row) — competition stays a small,
 * clean surface on the main career home rather than a full board; the full
 * XP leaderboard (org-scoped) lives at /leaderboard?tab=xp, which this tile
 * links to. Reuses lib/leaderboard.ts's existing XP board (already reflects
 * learn-lesson XP and rule-based achievement XP, since both bank into
 * users.xp) rather than standing up a parallel ranking system.
 * ============================================================ */

export interface LeaderboardTileProps {
  top5: LeaderboardRow[];
  myRank: number;
  myRow: LeaderboardRow | null;
}

function Row({ row, highlight }: { row: LeaderboardRow; highlight?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderTop: "1px solid var(--bow-dark-border, rgba(255,255,255,0.1))",
        fontFamily: "var(--font-interface)",
        fontSize: 13,
        color: highlight ? "var(--bow-orange)" : "inherit",
        fontWeight: highlight ? 700 : 400,
      }}
    >
      <span style={{ width: 22, fontFamily: "var(--font-data)", fontSize: 12, opacity: 0.7, flexShrink: 0 }}>
        #{row.position}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.displayName}
      </span>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 12, opacity: 0.85, flexShrink: 0 }}>
        {row.xp.toLocaleString()} XP
      </span>
    </div>
  );
}

export default function LeaderboardTile({ top5, myRank, myRow }: LeaderboardTileProps) {
  return (
    <div
      style={{
        background: "var(--bow-paper-alt, #fff)",
        border: "1px solid var(--bow-border, #e5e3dd)",
        borderRadius: 16,
        padding: "clamp(16px,3vw,22px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Leaderboard
        </h2>
        <Link
          href="/leaderboard?tab=xp"
          style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-orange)", textDecoration: "none" }}
        >
          Full board →
        </Link>
      </div>

      {top5.length === 0 ? (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
          No ranked students yet.
        </p>
      ) : (
        <div style={{ color: "var(--bow-ink)" }}>
          {top5.map((row) => (
            <Row key={row.studentId} row={row} />
          ))}
          {myRow && (
            <>
              <div style={{ height: 6 }} aria-hidden />
              <Row row={myRow} highlight />
            </>
          )}
          {!myRow && myRank > 0 && myRank <= 5 && (
            <p style={{ margin: "8px 0 0", fontFamily: "var(--font-data)", fontSize: 11, opacity: 0.7 }}>You&apos;re on the board.</p>
          )}
        </div>
      )}
    </div>
  );
}
