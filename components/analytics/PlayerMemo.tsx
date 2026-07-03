"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CapLine, Eyebrow } from "@/components/ds";
import { ExecutiveSummary, VerdictBadge, RiskPill, ScenarioRange, MemoSection } from "@/components/intelligence";
import PlayerBreakdown from "@/components/analytics/PlayerBreakdown";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import { buildPlayerMemo, buildLeagueContext, buildContractVerdict } from "@/lib/intelligence";
import { ACTION_LABELS, VERDICT_LABELS } from "@/lib/intelligence-types";
import { fmtMillions, fmtSignedMillions, type AnalyticsPlayer } from "@/lib/aasv";
import type { SeasonStat } from "@/lib/nba";

/** "1st" / "2nd" / "3rd" / "4th" ... */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const deckSection: React.CSSProperties = {
  background: "var(--bow-paper)",
  padding: "0 clamp(18px,4vw,40px) clamp(20px,3vw,28px)",
};

const section: React.CSSProperties = {
  background: "var(--bow-white)",
  padding: "clamp(24px,3.4vw,44px) clamp(18px,4vw,40px)",
  borderBottom: "1px solid var(--border-rule)",
};

const modelSection: React.CSSProperties = {
  background: "var(--bow-paper)",
  padding: "clamp(24px,3.4vw,44px) clamp(18px,4vw,40px)",
  borderBottom: "1px solid var(--border-rule)",
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "clamp(14px,2vw,20px)",
};

const caseCard: React.CSSProperties = {
  background: "var(--bow-white)",
  border: "1px solid var(--border-rule)",
  padding: "clamp(16px,2vw,22px)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const caseLabel: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const bodyText: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-interface)",
  fontSize: 15,
  lineHeight: 1.6,
  color: "var(--bow-ink)",
  textWrap: "pretty",
};

const compRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: 14,
  padding: "14px 0",
  borderTop: "1px solid var(--border-rule)",
};

/**
 * PLAYER MEMO — the single "use client" container for the player page's
 * decision content. Owns the assumption sliders and recomputes the FULL
 * memo (verdict, thesis, upside/downside, risk, scenario band,
 * comparables, recommendation) live on every drag, via
 * lib/intelligence.buildPlayerMemo. Presentational pieces (the verdict
 * deck, the memo, and the transparent-math audit trail in
 * PlayerBreakdown) are all fed from this one computed `memo` object so
 * nothing on the page can disagree with anything else.
 */
export default function PlayerMemo({
  player,
  allPlayers,
  history,
}: {
  player: AnalyticsPlayer;
  allPlayers: AnalyticsPlayer[];
  history?: SeasonStat[];
}) {
  const [assumptions, setAssumptions, resetAssumptions] = useAssumptions();

  const memo = useMemo(
    () => buildPlayerMemo(player, allPlayers, assumptions, history),
    [player, allPlayers, assumptions, history],
  );

  const leagueCtx = useMemo(() => buildLeagueContext(allPlayers, assumptions), [allPlayers, assumptions]);
  const rank = leagueCtx.rankBySurplus.get(player.slug);

  // Bear/bull tiers for a concrete sensitivity sentence — same classifier the verdict badge uses,
  // so "this call changes under bear assumptions" is never a vibe, it's a computed fact.
  const bearVerdict = useMemo(
    () => buildContractVerdict(player, memo.sensitivity.bear, assumptions, leagueCtx),
    [player, memo.sensitivity.bear, assumptions, leagueCtx],
  );
  const bullVerdict = useMemo(
    () => buildContractVerdict(player, memo.sensitivity.bull, assumptions, leagueCtx),
    [player, memo.sensitivity.bull, assumptions, leagueCtx],
  );

  const { verdict } = memo;

  return (
    <>
      {/* verdict deck — sits directly under the header, first thing a reader sees */}
      <div style={deckSection}>
        <div className="bow-container-wide" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <VerdictBadge tier={verdict.tier} size="lg" />
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.5, color: "var(--bow-ink)" }}>
            {verdict.headline}
          </p>
        </div>
      </div>

      {/* executive summary — the hero of the page */}
      <div style={section}>
        <div className="bow-container-wide">
          <ExecutiveSummary
            eyebrow="Investment Memo"
            headline={verdict.narrative[0] ?? verdict.headline}
            verdict={verdict}
            recommendation={{ action: ACTION_LABELS[memo.recommendation.action], rationale: memo.recommendation.rationale }}
            stats={[
              { label: "AASV (surplus)", value: fmtSignedMillions(memo.valuation.aasv), tone: memo.valuation.aasv >= 0 ? "positive" : "negative" },
              { label: "Production value", value: fmtMillions(memo.valuation.productionValue) },
              { label: "True cost", value: fmtMillions(memo.valuation.trueCost) },
              { label: "Surplus vs. cost", value: `${verdict.surplusPct >= 0 ? "+" : "−"}${Math.abs(Math.round(verdict.surplusPct * 100))}%`, tone: verdict.surplusPct >= 0 ? "positive" : "negative" },
              {
                label: "Rank, tracked deals",
                value: rank != null ? `${ordinal(rank)} of ${leagueCtx.trackedCount}` : "—",
              },
            ]}
          />
        </div>
      </div>

      {/* the memo */}
      <div style={section}>
        <div className="bow-container-wide" style={{ display: "flex", flexDirection: "column", gap: "clamp(28px,3.6vw,40px)" }}>
          <Eyebrow color="orange">The Memo</Eyebrow>

          <MemoSection label="Value thesis">
            <p style={bodyText}>{memo.thesis}</p>
          </MemoSection>

          <MemoSection label="Upside case / Downside case">
            <div style={twoCol}>
              <div style={{ ...caseCard, borderLeft: "4px solid var(--bow-positive)" }}>
                <span style={{ ...caseLabel, color: "var(--bow-positive)" }}>Upside case</span>
                <p style={bodyText}>{memo.upsideCase}</p>
              </div>
              <div style={{ ...caseCard, borderLeft: "4px solid var(--bow-negative)" }}>
                <span style={{ ...caseLabel, color: "var(--bow-negative)" }}>Downside case</span>
                <p style={bodyText}>{memo.downsideCase}</p>
              </div>
            </div>
          </MemoSection>

          <MemoSection label="Risk factors">
            <div>
              {memo.riskFactors.map((r) => (
                <RiskPill key={r.label} label={r.label} level={r.level} note={r.note} />
              ))}
            </div>
          </MemoSection>

          <MemoSection label="Assumption sensitivity">
            <ScenarioRange band={memo.sensitivity} label={`${player.name} — AASV under bear / base / bull assumptions`} />
            {memo.sensitivity.verdictFlips && (
              <p style={{ ...bodyText, fontSize: 14, color: "var(--bow-slate)" }}>
                This call changes under bear assumptions: {player.name} grades{" "}
                <strong style={{ color: "var(--bow-ink)" }}>{VERDICT_LABELS[bearVerdict.tier]}</strong> in the bear
                case but <strong style={{ color: "var(--bow-ink)" }}>{VERDICT_LABELS[bullVerdict.tier]}</strong> in
                the bull case — treat the verdict above as a live read of today&rsquo;s sliders, not a settled fact.
              </p>
            )}
          </MemoSection>

          {memo.comparables.length > 0 && (
            <MemoSection label="Comparable contracts">
              <div>
                {memo.comparables.map((c) => (
                  <div key={c.slug} style={compRow}>
                    <div style={{ flex: "0 0 200px" }}>
                      <Link href={`/analytics/players/${c.slug}`} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--bow-blue)", textDecoration: "none" }}>
                        {c.name}
                      </Link>
                      <div style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-slate)", marginTop: 2 }}>
                        {c.team}
                      </div>
                    </div>
                    <p style={{ ...bodyText, fontSize: 13.5, flex: "1 1 320px", color: "var(--bow-slate)" }}>{c.reason}</p>
                    <div
                      style={{
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        fontSize: 16,
                        fontVariantNumeric: "tabular-nums",
                        color: c.aasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)",
                        flex: "0 0 auto",
                      }}
                    >
                      {fmtSignedMillions(c.aasv)}
                    </div>
                  </div>
                ))}
              </div>
            </MemoSection>
          )}
        </div>
      </div>

      {/* the model — the transparent-math audit trail backing the memo above */}
      <div style={modelSection}>
        <div className="bow-container-wide" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <Eyebrow color="slate">The Model</Eyebrow>
            <h2 style={{ margin: "10px 0 6px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(22px,2.8vw,32px)", lineHeight: 1.15 }}>
              How the model gets there.
            </h2>
            <CapLine weight={3} step={10} stepAt={0.3} width="140px" />
            <p style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 720 }}>
              The audit trail behind every figure in the memo above — six steps from raw on-court impact to the
              final surplus verdict, using the same sliders. Drag any assumption and the memo above updates with it.
            </p>
          </div>
          <PlayerBreakdown
            player={player}
            history={history}
            assumptions={assumptions}
            onChange={setAssumptions}
            onReset={resetAssumptions}
            valuation={memo.valuation}
            agingRisk={verdict.agingRisk}
          />
        </div>
      </div>
    </>
  );
}
