"use client";

import { useMemo } from "react";
import { DataStrip } from "@/components/ds";
import SliderPanel from "@/components/analytics/SliderPanel";
import ValueScatter from "@/components/analytics/ValueScatter";
import ValueTable from "@/components/analytics/ValueTable";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import { fmtMillions, fmtSignedMillions, valuate, type AnalyticsPlayer } from "@/lib/aasv";

/**
 * The /analytics dashboard body. Raw player rows come from the server;
 * every valuation is computed HERE, client-side, from the live slider
 * values — so the table, chart, and summary strip all update together
 * with no round-trips. Assumptions persist per browser session.
 */
export default function AnalyticsDashboard({ players }: { players: AnalyticsPlayer[] }) {
  const [assumptions, setAssumptions, resetAssumptions] = useAssumptions();

  const summary = useMemo(() => {
    const valued = players.map((p) => ({ p, v: valuate(p, assumptions) }));
    const totalCap = valued.reduce((s, x) => s + x.p.capHit, 0);
    const best = valued.reduce((a, b) => (b.v.aasv > a.v.aasv ? b : a), valued[0]);
    const worst = valued.reduce((a, b) => (b.v.aasv < a.v.aasv ? b : a), valued[0]);
    return { totalCap, best, worst };
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
          { label: `Best value · ${summary.best.p.name}`, value: fmtSignedMillions(summary.best.v.aasv), tone: "positive" },
          { label: `Biggest hole · ${summary.worst.p.name}`, value: fmtSignedMillions(summary.worst.v.aasv), tone: "negative" },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)", gap: "clamp(16px,2vw,24px)", alignItems: "start" }} className="bow-analytics-grid">
        <SliderPanel assumptions={assumptions} onChange={setAssumptions} onReset={resetAssumptions} />
        <ValueScatter players={players} assumptions={assumptions} />
      </div>

      <ValueTable players={players} assumptions={assumptions} />

      {/* stacking for narrow screens without a CSS file change */}
      <style>{`@media (max-width: 900px) { .bow-analytics-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
