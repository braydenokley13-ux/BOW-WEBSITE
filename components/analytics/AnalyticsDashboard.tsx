"use client";

import { useMemo } from "react";
import { DataStrip } from "@/components/ds";
import { DecisionModule } from "@/components/intelligence";
import SliderPanel from "@/components/analytics/SliderPanel";
import ValueScatter from "@/components/analytics/ValueScatter";
import ValueTable from "@/components/analytics/ValueTable";
import TradeMachine from "@/components/analytics/TradeMachine";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import { fmtMillions, fmtSignedMillions, valuate, type AnalyticsPlayer } from "@/lib/aasv";
import { buildContractVerdict, buildLeagueContext } from "@/lib/intelligence";

/**
 * The /analytics dashboard body. Raw player rows come from the server;
 * every valuation and verdict is computed HERE, client-side, from the
 * live slider values — so the table, chart, and summary all update
 * together with no round-trips. Assumptions persist per browser session.
 */
export default function AnalyticsDashboard({ players }: { players: AnalyticsPlayer[] }) {
  const [assumptions, setAssumptions, resetAssumptions] = useAssumptions();

  const summary = useMemo(() => {
    const ctx = buildLeagueContext(players, assumptions);
    const valued = players.map((p) => {
      const v = valuate(p, assumptions);
      return { p, v, verdict: buildContractVerdict(p, v, assumptions, ctx) };
    });
    const totalCap = valued.reduce((s, x) => s + x.p.capHit, 0);
    const best = valued.reduce((a, b) => (b.v.aasv > a.v.aasv ? b : a), valued[0]);
    const worst = valued.reduce((a, b) => (b.v.aasv < a.v.aasv ? b : a), valued[0]);
    const albatrossCount = valued.filter((x) => x.verdict.tier === "albatross").length;
    // The synthesized house view: one sentence off the extremes of the
    // current-assumption valuations, not a hardcoded take — it moves the
    // instant a slider does.
    const houseView = `${best.p.name} is the standout at ${fmtSignedMillions(best.v.aasv)} of tracked surplus; ${
      worst.p.name
    } is the biggest hole at ${fmtSignedMillions(worst.v.aasv)} under water; and ${albatrossCount} of ${
      players.length
    } tracked deal${players.length === 1 ? "" : "s"} grade${albatrossCount === 1 ? "s" : ""} as albatross risk under these assumptions.`;
    return { totalCap, best, worst, albatrossCount, houseView };
  }, [players, assumptions]);

  if (players.length === 0) {
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
          { label: "Players tracked", value: String(players.length) },
          { label: "Combined cap hits", value: fmtMillions(summary.totalCap) },
          { label: "Tracked albatross deals", value: String(summary.albatrossCount), tone: summary.albatrossCount > 0 ? "negative" : undefined },
        ]}
      />

      <DecisionModule eyebrow="House View" title="Today's read on the tracked slate" body={summary.houseView} tone="watch" />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)", gap: "clamp(16px,2vw,24px)", alignItems: "start" }} className="bow-analytics-grid">
        <SliderPanel assumptions={assumptions} onChange={setAssumptions} onReset={resetAssumptions} />
        <ValueScatter players={players} assumptions={assumptions} />
      </div>

      <ValueTable players={players} assumptions={assumptions} />

      <TradeMachine players={players} />

      {/* stacking for narrow screens without a CSS file change */}
      <style>{`@media (max-width: 900px) { .bow-analytics-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
