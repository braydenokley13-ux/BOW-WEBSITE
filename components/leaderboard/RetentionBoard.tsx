import type { LeaderboardRow, LeaderboardType } from "@/lib/leaderboard";

const GOLD = "#C9A84C";

const th: React.CSSProperties = {
  fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "#9a9da6", textAlign: "left", padding: "10px 14px", borderBottom: "1px solid var(--bow-dark-border)",
};
const td: React.CSSProperties = {
  fontFamily: "var(--font-interface)", fontSize: 14.5, color: "#e9eaee", padding: "12px 14px",
  borderBottom: "1px solid var(--bow-dark-border)",
};

function TrackPill({ track }: { track: string }) {
  const is201 = track === "201";
  return (
    <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", borderRadius: 999, padding: "3px 9px", color: is201 ? "#ff8a5a" : "#7da2ff", background: is201 ? "rgba(255,90,54,0.14)" : "rgba(49,87,255,0.16)" }}>
      {track}
    </span>
  );
}

function Cells({ type, row }: { type: LeaderboardType; row: LeaderboardRow }) {
  if (type === "streak") {
    return (
      <>
        <td style={{ ...td, color: GOLD, fontFamily: "var(--font-data)", fontWeight: 700 }}>
          🔥 {row.currentStreak} {row.currentStreak === 1 ? "day" : "days"}
        </td>
        <td style={{ ...td, textAlign: "right" }}><TrackPill track={row.track} /></td>
      </>
    );
  }
  return (
    <>
      <td style={{ ...td, color: GOLD, fontFamily: "var(--font-data)", fontWeight: 700 }}>{row.xp.toLocaleString()}</td>
      <td style={td}>{row.badgeCount}</td>
      <td style={{ ...td, textAlign: "right", fontSize: 18 }} aria-label="Top badge">{row.topBadgeIcon ?? "—"}</td>
    </>
  );
}

function Tr({ type, row, highlight }: { type: LeaderboardType; row: LeaderboardRow; highlight: boolean }) {
  return (
    <tr style={{ background: highlight ? "rgba(201,168,76,0.14)" : "transparent" }}>
      <td style={{ ...td, width: 56, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, color: highlight ? GOLD : "#9a9da6" }}>
        {row.position}
      </td>
      <td style={{ ...td, fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.01em", color: "#fff" }}>
        {row.displayName}{highlight ? " · You" : ""}
      </td>
      <Cells type={type} row={row} />
    </tr>
  );
}

interface Props {
  type: LeaderboardType;
  rows: LeaderboardRow[];
  currentUserId: string | null;
  /** The viewer's own row, shown below the table when they rank outside the top 25. */
  myRow?: LeaderboardRow | null;
  /** Optional note under the header (e.g. "Resets Monday"). */
  note?: string;
}

/** A streak or XP leaderboard table with zebra striping and the viewer highlighted. */
export default function RetentionBoard({ type, rows, currentUserId, myRow, note }: Props) {
  const headers =
    type === "streak"
      ? ["Rank", "Name", "Streak", "Track"]
      : ["Rank", "Name", "XP", "Badges", "Top"];

  return (
    <div>
      {note && (
        <p style={{ margin: "0 0 12px", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: GOLD }}>
          {note}
        </p>
      )}
      <div style={{ border: "1px solid var(--bow-dark-border)", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bow-dark-surface)" }}>
              {headers.map((h, i) => (
                <th key={h} style={{ ...th, textAlign: i === headers.length - 1 ? "right" : "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.studentId} style={{ background: r.studentId === currentUserId ? "rgba(201,168,76,0.14)" : i % 2 === 1 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                <td style={{ ...td, width: 56, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, color: r.studentId === currentUserId ? GOLD : "#9a9da6" }}>
                  {r.position}
                </td>
                <td style={{ ...td, fontFamily: "var(--font-display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.01em", color: "#fff" }}>
                  {r.displayName}{r.studentId === currentUserId ? " · You" : ""}
                </td>
                <Cells type={type} row={r} />
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} style={{ ...td, color: "#9a9da6", textAlign: "center", padding: "26px 14px" }}>
                  No students on this board yet. Answer the Daily Question to get on it.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {myRow && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>
            Your rank
          </p>
          <div style={{ border: `1px solid ${GOLD}`, borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <Tr type={type} row={myRow} highlight />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
