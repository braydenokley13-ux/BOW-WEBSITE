"use client";

import { useMemo } from "react";
import { DataStrip, Eyebrow } from "@/components/ds";
import FranchiseIndexBoard from "@/components/analytics/FranchiseIndexBoard";
import SliderPanel from "@/components/analytics/SliderPanel";
import TeamValueTable from "@/components/analytics/TeamValueTable";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import { fmtMillions, type AnalyticsPlayer } from "@/lib/aasv";
import { buildTeamBrief } from "@/lib/intelligence";
import { teamName } from "@/lib/nba-teams";
import { aggregateTeams } from "@/lib/team-aasv";

/**
 * The /analytics/teams dashboard body. Raw player rows come from the
 * server; every roll-up, Franchise Index, and GM brief is computed HERE
 * from the live slider values, so the leaderboard re-ranks the instant an
 * assumption moves. Assumptions are the SAME session-persisted knobs as
 * the player dashboard — flip a slider on either page and both agree.
 */
export default function TeamsDashboard({ players }: { players: AnalyticsPlayer[] }) {
  const [assumptions, setAssumptions, resetAssumptions] = useAssumptions();

  const rollups = useMemo(() => aggregateTeams(players, assumptions), [players, assumptions]);

  // The Franchise Strategy Index leaderboard: one brief per tracked team,
  // ranked by overall FSI score. buildTeamBrief already calls
  // buildFranchiseIndex internally, so this is the single pass that
  // produces both the ranking and the window/driver copy per row.
  const briefs = useMemo(
    () => rollups.map((r) => buildTeamBrief(r, rollups, assumptions, players)).sort((a, b) => b.index.overall.score - a.index.overall.score),
    [rollups, assumptions, players],
  );

  const summary = useMemo(() => {
    if (briefs.length === 0) return null;
    const trackedCap = rollups.reduce((s, r) => s + r.totalCap, 0);
    return { trackedCap, top: briefs[0], bottom: briefs[briefs.length - 1] };
  }, [briefs, rollups]);

  if (players.length === 0 || summary == null) {
    return (
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
        No players loaded yet — seed data-seeds/contracts.csv and restart.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(18px,2.4vw,28px)" }}>
      <DataStrip
        dense
        items={[
          { label: "Teams tracked", value: String(rollups.length) },
          { label: "Tracked cap committed", value: fmtMillions(summary.trackedCap) },
          {
            label: `Top FSI · ${teamName(summary.top.rollup.team)}`,
            value: `${summary.top.index.overall.grade} · ${summary.top.index.overall.score}/100`,
            tone: "positive",
          },
          {
            label: `Lowest FSI · ${teamName(summary.bottom.rollup.team)}`,
            value: `${summary.bottom.index.overall.grade} · ${summary.bottom.index.overall.score}/100`,
            tone: "negative",
          },
        ]}
      />

      {/* honesty disclosure — this is a curated slice of the league, not full rosters */}
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
        Team totals and Franchise Index scores only cover BOW&rsquo;s ~40 curated tracked contracts, not full 15-man
        rosters — read every number here as &ldquo;value across the players we model,&rdquo; not a team&rsquo;s
        entire cap sheet.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)", gap: "clamp(16px,2vw,24px)", alignItems: "start" }} className="bow-analytics-grid">
        <SliderPanel assumptions={assumptions} onChange={setAssumptions} onReset={resetAssumptions} />
        <FranchiseIndexBoard briefs={briefs} />
      </div>

      {/* audit trail — the raw dollar figures behind the index, below the ranking that leads */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Eyebrow color="slate">Tracked cap sheet by team</Eyebrow>
        <TeamValueTable rollups={rollups} />
      </div>

      {/* stacking for narrow screens without a CSS file change */}
      <style>{`@media (max-width: 900px) { .bow-analytics-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
