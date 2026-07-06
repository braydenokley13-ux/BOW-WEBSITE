import SliderPanel from "@/components/analytics/SliderPanel";
import TrendLine from "@/components/analytics/TrendLine";
import ApronBadge from "@/components/analytics/ApronBadge";
import { RISK_LABELS, type RiskLevel } from "@/lib/intelligence-types";
import {
  APRON_LABELS,
  POSSESSIONS_PER_MINUTE,
  fmtMillions,
  fmtSignedMillions,
  fmtWins,
  type AnalyticsPlayer,
  type Assumptions,
  type Valuation,
} from "@/lib/aasv";
import type { SeasonStat } from "@/lib/nba";

const num = (v: number, digits = 1) =>
  v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Copy only — metricUsed's "EPM" value marks which column the number came from (unchanged
// identifier), but the epm column actually holds the league's estimated net rating, so the
// on-screen label reads "Est. Impact" instead of claiming real estimated plus-minus.
const METRIC_DISPLAY: Record<"EPM" | "BPM", string> = {
  EPM: "Est. Impact",
  BPM: "BPM",
};

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

/** Impact history is oldest-season-first; latest−earliest impact (EPM else BPM), or null if <2 usable seasons. Mirrors lib/intelligence's aging proxy so the tie-in sentence below never disagrees with the verdict above it. */
function impactTrend(history?: SeasonStat[]): number | null {
  if (!history || history.length < 2) return null;
  const vals = history.map((h) => h.epm ?? h.bpm).filter((x): x is number => x != null);
  if (vals.length < 2) return null;
  return vals[vals.length - 1] - vals[0];
}

/** One sentence tying the season-over-season trend to the memo's aging-risk read — never a bare chart. */
function trendVerdictSentence(playerName: string, trend: number | null, agingRisk: RiskLevel): string | null {
  if (trend == null) return null;
  const riskWord = RISK_LABELS[agingRisk].toLowerCase();
  const magnitude = `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}`;
  if (trend >= 0.3) {
    return `${playerName}'s impact is trending up (${magnitude} across tracked seasons) — that upward line is why the aging-risk read stays at ${riskWord} rather than climbing.`;
  }
  if (trend <= -0.3) {
    return `${playerName}'s impact is trending down (${magnitude} across tracked seasons) — that decline is a direct input into the ${riskWord} aging-risk grade on the years still owed.`;
  }
  return `${playerName}'s impact has held flat across tracked seasons (${magnitude}) — the ${riskWord} aging-risk grade here is driven by forward money exposure, not a trend line.`;
}

/**
 * The transparent-math view: every intermediate number between the raw
 * inputs and the final AASV figure, driven by the assumptions the parent
 * memo container owns (so this section and the verdict above it never
 * disagree). No black box — if a reader disagrees with the answer, the
 * step they disagree with is visible and adjustable via the shared
 * slider panel.
 */
export default function PlayerBreakdown({
  player,
  history,
  assumptions,
  onChange,
  onReset,
  valuation,
  agingRisk,
}: {
  player: AnalyticsPlayer;
  history?: SeasonStat[];
  assumptions: Assumptions;
  onChange: (a: Assumptions) => void;
  onReset: () => void;
  valuation: Valuation;
  agingRisk: RiskLevel;
}) {
  const v = valuation;
  const noStats = v.metricUsed == null;
  const trend = impactTrend(history);
  const trendSentence = trendVerdictSentence(player.name, trend, agingRisk);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)", gap: "clamp(16px,2.4vw,28px)", alignItems: "start" }} className="bow-analytics-grid">
      <SliderPanel assumptions={assumptions} onChange={onChange} onReset={onReset} />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              <>League estimated net rating (per 100 poss. vs. an average player), cached from stats.nba.com{player.statSource === "snapshot" ? " (seed snapshot)" : ""}.</>
            )}
            {v.metricUsed === "BPM" && <>No est. impact metric on file — falling back to Box Plus/Minus from the editable snapshot.</>}
            {v.metricUsed == null && <>No advanced metric available for this season.</>}
          </p>
          <p style={formula}>
            {v.metricUsed ? METRIC_DISPLAY[v.metricUsed] : "impact"} = <strong>{v.metricUsed ? num(v.impact) : "—"}</strong>
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

        {/* Step 6 — season-over-season trend (only when history was fetched), tied into the verdict's aging-risk read */}
        {history != null && history.length >= 2 && (
          <div style={stepCard}>
            <span style={stepKicker}>Step 6 · Season-over-season impact</span>
            <div style={{ marginTop: 10 }}>
              <TrendLine history={history} title={`${player.name} — est. impact trend`} note={trendSentence ?? undefined} />
            </div>
          </div>
        )}

        {history != null && history.length <= 1 && (
          <div style={{ ...stepCard, borderLeft: "4px solid var(--bow-warning)" }}>
            <span style={stepKicker}>Step 6 · Season-over-season impact</span>
            <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)" }}>
              First season on file — the trend view, and its tie-in to aging risk, unlocks once another season lands.
            </p>
          </div>
        )}

        <style>{`@media (max-width: 900px) { .bow-analytics-grid { grid-template-columns: 1fr !important; } }`}</style>
      </div>
    </div>
  );
}
