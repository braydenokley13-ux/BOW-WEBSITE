"use client";

import { DataStrip } from "@/components/ds";
import ApronBadge from "@/components/analytics/ApronBadge";
import SliderPanel from "@/components/analytics/SliderPanel";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import {
  APRON_LABELS,
  POSSESSIONS_PER_MINUTE,
  fmtMillions,
  fmtSignedMillions,
  fmtWins,
  valuate,
  type AnalyticsPlayer,
} from "@/lib/aasv";

const num = (v: number, digits = 1) =>
  v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * The transparent-math view: every intermediate number between the raw
 * inputs and the final AASV figure, recomputed live from the same
 * session-persisted sliders the dashboard uses. No black box — if a
 * reader disagrees with the answer, the step they disagree with is
 * visible and adjustable.
 */
export default function PlayerBreakdown({ player }: { player: AnalyticsPlayer }) {
  const [assumptions, setAssumptions, resetAssumptions] = useAssumptions();
  const v = valuate(player, assumptions);
  const noStats = v.metricUsed == null;

  const stepCard: React.CSSProperties = {
    background: "var(--bow-white)",
    border: "1px solid var(--border-rule)",
    padding: "clamp(16px,2vw,22px)",
  };
  const stepKicker: React.CSSProperties = {
    fontFamily: "var(--font-data)",
    fontSize: 10.5,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--bow-slate)",
  };
  const formula: React.CSSProperties = {
    fontFamily: "var(--font-data)",
    fontSize: 13.5,
    lineHeight: 1.7,
    color: "var(--bow-ink)",
    fontVariantNumeric: "tabular-nums",
    margin: "8px 0 0",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)", gap: "clamp(16px,2.4vw,28px)", alignItems: "start" }} className="bow-analytics-grid">
      <SliderPanel assumptions={assumptions} onChange={setAssumptions} onReset={resetAssumptions} />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <DataStrip
          dense
          items={[
            { label: "Production value", value: fmtMillions(v.productionValue) },
            { label: "True cost", value: fmtMillions(v.trueCost) },
            {
              label: "AASV (surplus)",
              value: fmtSignedMillions(v.aasv),
              tone: v.aasv >= 0 ? "positive" : "negative",
            },
          ]}
        />

        {noStats && (
          <div style={{ ...stepCard, borderLeft: "4px solid var(--bow-warning)" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)" }}>
              No impact metric is on file for {player.name} this season (
              {player.games === 0 ? "hasn’t played" : "awaiting data"}), so his production value is $0 and AASV is
              simply the negative of his true contract cost — what a lost season actually costs the cap sheet.
            </p>
          </div>
        )}

        {/* Step 1 — impact input */}
        <div style={stepCard}>
          <span style={stepKicker}>Step 1 · On-court impact</span>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            {v.metricUsed === "EPM" && (
              <>Estimated plus-minus impact (net points per 100 possessions vs. an average player), cached from stats.nba.com{player.statSource === "snapshot" ? " (seed snapshot)" : ""}.</>
            )}
            {v.metricUsed === "BPM" && <>No EPM on file — falling back to Box Plus/Minus from the editable snapshot.</>}
            {v.metricUsed == null && <>No advanced metric available for this season.</>}
          </p>
          <p style={formula}>
            {v.metricUsed ?? "impact"} = <strong>{v.metricUsed ? num(v.impact) : "—"}</strong>
            {"   ·   "}
            {player.season || "no season"} · {player.games} games · {num(player.minutes, 0)} minutes
          </p>
        </div>

        {/* Step 2 — impact → wins */}
        <div style={stepCard}>
          <span style={stepKicker}>Step 2 · Impact → marginal wins</span>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            Impact is credited above replacement level ({num(assumptions.replacementLevel)}), scaled by the possessions
            he actually played (minutes × {num(POSSESSIONS_PER_MINUTE, 2)}/min), then converted at{" "}
            {num(assumptions.pointsPerWin)} net points per win.
          </p>
          <p style={formula}>
            ({num(v.impact)} − ({num(assumptions.replacementLevel)})) × {num(v.possessions, 0)} poss ÷ 100 ={" "}
            <strong>{num(v.netPointsAdded, 0)} net pts</strong>
            <br />
            {num(v.netPointsAdded, 0)} ÷ {num(assumptions.pointsPerWin)} = <strong>{fmtWins(v.marginalWins)} wins</strong>
          </p>
        </div>

        {/* Step 3 — wins → dollars */}
        <div style={stepCard}>
          <span style={stepKicker}>Step 3 · Wins → production value</span>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            Wins are priced at your $/win setting ({fmtMillions(assumptions.dollarsPerWin)} per win).
          </p>
          <p style={formula}>
            {fmtWins(v.marginalWins)} wins × {fmtMillions(assumptions.dollarsPerWin)} ={" "}
            <strong>{fmtMillions(v.productionValue)}</strong>
          </p>
        </div>

        {/* Step 4 — true cost */}
        <div style={stepCard}>
          <span style={stepKicker}>Step 4 · What the contract truly costs</span>
          <div style={{ margin: "10px 0 4px" }}>
            <ApronBadge status={player.apronStatus} />
          </div>
          <p style={{ margin: "6px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            {player.team} is a {APRON_LABELS[player.apronStatus].toLowerCase()} team, so every {player.name} dollar is
            charged at {num(v.apronMultiplier, 2)}× — your setting for what that tier’s tax and roster restrictions
            really cost. Contract: {player.yearsRemaining} yr{player.yearsRemaining === 1 ? "" : "s"} ·{" "}
            {fmtMillions(player.totalRemaining)} remaining.
          </p>
          <p style={formula}>
            {fmtMillions(player.capHit)} cap hit × {num(v.apronMultiplier, 2)} = <strong>{fmtMillions(v.trueCost)}</strong>
          </p>
        </div>

        {/* Step 5 — verdict */}
        <div style={{ ...stepCard, borderLeft: `4px solid ${v.aasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)"}` }}>
          <span style={stepKicker}>Step 5 · Apron-Adjusted Surplus Value</span>
          <p style={formula}>
            {fmtMillions(v.productionValue)} − {fmtMillions(v.trueCost)} ={" "}
            <strong style={{ fontSize: 17, color: v.aasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)" }}>
              {fmtSignedMillions(v.aasv)}
            </strong>
          </p>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)" }}>
            {v.aasv >= 0
              ? `${player.name} out-produces his true cost under these assumptions — a surplus asset.`
              : `${player.name} costs more than he produces under these assumptions — the contract eats value.`}
          </p>
        </div>

        <style>{`@media (max-width: 900px) { .bow-analytics-grid { grid-template-columns: 1fr !important; } }`}</style>
      </div>
    </div>
  );
}
