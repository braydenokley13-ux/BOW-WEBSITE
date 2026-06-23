import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { getLeaderboard, getLeaderboardCohorts } from "@/lib/scoring";
import LeaderboardFilters from "@/components/leaderboard/LeaderboardFilters";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";

const DAY = 24 * 60 * 60 * 1000;

type SP = Promise<{ range?: string; cohort?: string }>;

export default async function LeaderboardPage({ searchParams }: { searchParams: SP }) {
  const me = await requireUser();
  const sp = await searchParams;
  const range = sp.range === "month" || sp.range === "week" ? sp.range : "all";
  const cohortId = sp.cohort ?? "";

  const now = Date.now();
  const sinceTs = range === "week" ? now - 7 * DAY : range === "month" ? now - 30 * DAY : 0;

  const board = getLeaderboard({ sinceTs, cohortId: cohortId || null });
  const cohorts = getLeaderboardCohorts();

  const top = board.slice(0, 25);
  const myRow = me.role === "student" ? board.find((r) => r.studentId === me.id) ?? null : null;
  const myInTop = !!myRow && (myRow.position ?? 0) <= 25;

  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Leaderboard
          </span>
          <Link href={me.role === "student" ? "/dashboard" : "/instructor"} style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6f8bff", textDecoration: "none" }}>
            ← Back
          </Link>
        </div>
        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          The board.
        </h1>
        <p style={{ margin: "0 0 24px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#9a9da6", maxWidth: 560 }}>
          Ranked by BOW Score: modules completed, Econ Quiz answers, BOW Daily responses, reflections, the certificate, and the Simulation Room. Climb by making more decisions.
        </p>

        <LeaderboardFilters cohorts={cohorts} range={range} cohortId={cohortId} />

        <LeaderboardTable rows={top} highlightId={myRow ? me.id : null} ownRow={myRow && !myInTop ? myRow : null} />
      </div>
    </div>
  );
}
