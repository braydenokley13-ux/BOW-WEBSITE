import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { getLeaderboard, getLeaderboardCohorts, rangeSince, type LeaderboardRange } from "@/lib/scoring";
import {
  getStreakLeaderboard,
  getXPLeaderboard,
  getStudentRank,
  getStudentLeaderboardRow,
  type LeaderboardType,
} from "@/lib/leaderboard";
import LeaderboardFilters from "@/components/leaderboard/LeaderboardFilters";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import RetentionBoard from "@/components/leaderboard/RetentionBoard";

const GOLD = "#C9A84C";

type Tab = "streak" | "xp" | "score";
type SP = Promise<{ tab?: string; range?: string; cohort?: string }>;

const TABS: { key: Tab; label: string }[] = [
  { key: "streak", label: "Streak" },
  { key: "xp", label: "XP" },
  { key: "score", label: "BOW Score" },
];

const SUBTITLE: Record<Tab, string> = {
  streak: "Longest active streaks. Answer the Daily Question every day to climb — ties are broken by your longest-ever streak.",
  xp: "All-time XP earned from daily questions, streak bonuses, and badges. No resets — just keep stacking.",
  score: "Ranked by BOW Score: modules, Econ Quiz, BOW Daily, reflections, the certificate, and the Simulation Room.",
};

export default async function LeaderboardPage({ searchParams }: { searchParams: SP }) {
  const me = await requireUser();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "xp" ? "xp" : sp.tab === "score" ? "score" : "streak";
  const meId = me.role === "student" ? me.id : null;
  const orgScope = me.role === "admin" ? null : me.orgId;

  // BOW Score tab inputs (only used when that tab is active).
  const range: LeaderboardRange = sp.range === "month" || sp.range === "week" ? sp.range : "all";
  const cohortId = sp.cohort ?? "";

  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Leaderboard
          </span>
          <Link href={me.role === "student" ? "/dashboard" : me.role === "admin" ? "/admin" : "/instructor"} style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6f8bff", textDecoration: "none" }}>
            ← Back
          </Link>
        </div>
        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          The board.
        </h1>
        <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#9a9da6", maxWidth: 580 }}>
          {SUBTITLE[tab]}
        </p>

        {/* Tab switcher */}
        <div role="tablist" aria-label="Leaderboard tabs" style={{ display: "flex", gap: 22, borderBottom: "1px solid var(--bow-dark-border)", marginBottom: 24 }}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                role="tab"
                aria-selected={active}
                href={`/leaderboard?tab=${t.key}`}
                style={{
                  fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, textTransform: "uppercase", letterSpacing: "0.02em",
                  color: active ? "#fff" : "#9a9da6", textDecoration: "none", padding: "0 0 12px",
                  borderBottom: `2px solid ${active ? GOLD : "transparent"}`, marginBottom: -1,
                }}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {tab === "streak" && (
          <RetentionBoard
            type="streak"
            rows={(await getStreakLeaderboard(orgScope))}
            currentUserId={meId}
            myRow={(await outsideTop(meId, "streak", orgScope))}
            note="Resets Monday"
          />
        )}

        {tab === "xp" && (
          <RetentionBoard
            type="xp"
            rows={(await getXPLeaderboard(orgScope))}
            currentUserId={meId}
            myRow={(await outsideTop(meId, "xp", orgScope))}
            note="All-time"
          />
        )}

        {tab === "score" && (
          <ScoreTab range={range} cohortId={cohortId} meId={meId} orgId={orgScope} />
        )}
      </div>
    </div>
  );
}

/** The viewer's own row, but only when they rank outside the visible top 25. */
async function outsideTop(meId: string | null, type: LeaderboardType, orgId: string | null) {
  if (!meId) return null;
  const rank = (await getStudentRank(meId, type, orgId));
  return rank > 25 ? (await getStudentLeaderboardRow(meId, type, orgId)) : null;
}

/** The original BOW Score board (cohort + time-window filters), preserved as a tab. */
async function ScoreTab({ range, cohortId, meId, orgId }: { range: LeaderboardRange; cohortId: string; meId: string | null; orgId: string | null }) {
  const board = (await getLeaderboard({ sinceTs: rangeSince(range), cohortId: cohortId || null, orgId }));
  const cohorts = (await getLeaderboardCohorts(orgId));
  const top = board.slice(0, 25);
  const myRow = meId ? board.find((r) => r.studentId === meId) ?? null : null;
  const myInTop = !!myRow && (myRow.position ?? 0) <= 25;

  return (
    <>
      <LeaderboardFilters cohorts={cohorts} range={range} cohortId={cohortId} />
      <LeaderboardTable rows={top} highlightId={meId} ownRow={myRow && !myInTop ? myRow : null} />
    </>
  );
}
