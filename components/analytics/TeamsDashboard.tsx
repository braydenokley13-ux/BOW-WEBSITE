"use client";

import { useMemo } from "react";
import { DataStrip } from "@/components/ds";
import SliderPanel from "@/components/analytics/SliderPanel";
import TeamValueTable from "@/components/analytics/TeamValueTable";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import { fmtMillions, fmtSignedMillions, type AnalyticsPlayer } from "@/lib/aasv";
import { teamName } from "@/lib/nba-teams";
import { aggregateTeams } from "@/lib/team-aasv";

/**
 * The /analytics/teams dashboard body. Same shape as AnalyticsDashboard:
 * raw player rows come from the server, every roll-up is computed HERE
 * from the live slider values, so the strip and table update together
 * with no round-trips. Assumptions are the SAME session-persisted knobs
 * as the player dashboard — flip a slider on either page and both agree.
 */
export default function TeamsDashboard({ players }: { players: AnalyticsPlayer[] }) {
  const [assumptions, setAssumptions, resetAssumptions] = useAssumptions();

  const rollups = useMemo(() => aggregateTeams(players, assumptions), [players, assumptions]);

  const summary = useMemo(() => {
    if (rollups.length === 0) return null;
    const trackedCap = rollups.reduce((s, r) => s + r.totalCap, 0);
    const best = rollups.reduce((a, b) => (b.totalAasv > a.totalAasv ? b : a), rollups[0]);
    const worst = rollups.reduce((a, b) => (b.totalAasv < a.totalAasv ? b : a), rollups[0]);
    return { trackedCap, best, worst };
  }, [rollups]);

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
          { label: `Biggest surplus · ${teamName(summary.best.team)}`, value: fmtSignedMillions(summary.best.totalAasv), tone: "positive" },
          { label: `Biggest deficit · ${teamName(summary.worst.team)}`, value: fmtSignedMillions(summary.worst.totalAasv), tone: "negative" },
        ]}
      />

      {/* honesty disclosure — this is a curated slice of the league, not full rosters */}
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
        Team totals only include BOW&rsquo;s ~40 curated tracked contracts, not full 15-man rosters — read every
        number here as &ldquo;value across the players we model,&rdquo; not a team&rsquo;s entire cap sheet.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)", gap: "clamp(16px,2vw,24px)", alignItems: "start" }} className="bow-analytics-grid">
        <SliderPanel assumptions={assumptions} onChange={setAssumptions} onReset={resetAssumptions} />
        <TeamValueTable rollups={rollups} />
      </div>

      {/* stacking for narrow screens without a CSS file change */}
      <style>{`@media (max-width: 900px) { .bow-analytics-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
