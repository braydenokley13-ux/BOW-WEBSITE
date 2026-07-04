import Link from "next/link";
import ApronBadge from "@/components/analytics/ApronBadge";
import ValueScatter from "@/components/analytics/ValueScatter";
import CapStackBar from "@/components/analytics/CapStackBar";
import TrendLine from "@/components/analytics/TrendLine";
import {
  DEFAULT_ASSUMPTIONS,
  fmtMillions,
  fmtSignedMillions,
  fmtWins,
  valuate,
  type AnalyticsPlayer,
  type Assumptions,
} from "@/lib/aasv";
import { teamName, teamSlug } from "@/lib/nba-teams";
import { aggregateTeam, aggregateTeams } from "@/lib/team-aasv";
import type { SeasonStat } from "@/lib/nba";
import { buildContractVerdict, buildLeagueContext, buildScenarioBand, buildTeamBrief, buildTradeAnalysis } from "@/lib/intelligence";
import {
  LIQUIDITY_LABELS,
  WINDOW_LABELS,
  TRADE_SIDE_LABELS,
  TRADE_SIDE_COLORS,
  type IndexScore,
  type RiskLevel,
  type TradeLiquidity,
  type TradeAnalysis,
  type TradeSide,
} from "@/lib/intelligence-types";
import { DecisionModule, RiskPill, ScenarioRange, VerdictBadge } from "@/components/intelligence";

/* ============================================================
 * Article data embeds — the presentational halves of the
 * <PlayerCard/>, <AASVChart/>, <AASVTable/>, <TeamCapSheet/>,
 * <TrendChart/>, <ContractVerdict/>, <TeamFlex/>, and <ScenarioBand/>
 * shortcodes.
 *
 * They receive already-fetched player rows (the article page and the
 * editor preview both prefetch via collectEmbedSlugs / collectEmbedTeams),
 * compute values with lib/aasv, lib/team-aasv, or lib/intelligence, and
 * reuse the same visual language as /analytics — so a number quoted in a
 * story is ALWAYS the model's current number under the assumptions handed
 * in. No directives: rendered by server pages and the client editor
 * alike. lib/nba.ts is server-only, so this file never imports its
 * functions — only the SeasonStat TYPE, with history handed in as a prop.
 *
 * ASSUMPTION-AWARENESS: every component here is prop-driven — it takes an
 * `assumptions` prop and defaults it to DEFAULT_ASSUMPTIONS, so it stays
 * server-safe and works standalone. The reader's tuned assumptions are
 * threaded in from components/analytics/embeds/LiveAssumptions.tsx, a
 * "use client" wrapper that reads useAssumptions() and passes the live
 * values down — these components never read that hook themselves.
 * ============================================================ */

/** True when `a` matches the model's stock defaults (deep-equal by value). */
function isDefaultAssumptions(a: Assumptions): boolean {
  return JSON.stringify(a) === JSON.stringify(DEFAULT_ASSUMPTIONS);
}

/** Provenance caption text — honest about whether a reader's tuned sliders are driving this render. */
function provenanceText(assumptions: Assumptions): string {
  return isDefaultAssumptions(assumptions)
    ? "Computed under model defaults"
    : "Computed under your assumptions — tuned on the analytics desk";
}

const captionStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontFamily: "var(--font-data)",
  fontSize: 10.5,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
};

export function EmbedMissing({ slugs }: { slugs: string[] }) {
  return (
    <div
      style={{
        border: "1px dashed var(--bow-negative)",
        background: "var(--bow-negative-tint)",
        padding: "12px 16px",
        fontFamily: "var(--font-data)",
        fontSize: 13,
        color: "var(--bow-negative)",
        margin: "22px 0",
      }}
    >
      Unknown player{slugs.length > 1 ? "s" : ""} in embed: {slugs.join(", ")} — check the slug against the
      curated list on /analytics.
    </div>
  );
}

export function PlayerCardEmbed({ player, assumptions = DEFAULT_ASSUMPTIONS }: { player: AnalyticsPlayer; assumptions?: Assumptions }) {
  const v = valuate(player, assumptions);
  const positive = v.aasv >= 0;
  return (
    <aside
      className="bow-front-office"
      style={{ background: "var(--bow-ink)", color: "#fff", border: "1px solid var(--bow-dark-border)", margin: "26px 0", padding: 0 }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Live model card · {player.season || "—"}
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>
          {v.metricUsed ? `${v.metricUsed} ${v.impact > 0 ? "+" : ""}${v.impact.toFixed(1)}` : "no metric on file"} · {fmtWins(v.marginalWins)} wins
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "clamp(16px,3vw,32px)", padding: "18px 18px 16px" }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <Link
            href={`/analytics/players/${player.slug}`}
            style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,2.6vw,30px)", lineHeight: 0.95, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#fff", textDecoration: "none" }}
          >
            {player.name} →
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a9da6" }}>{player.team}</span>
            <ApronBadge status={player.apronStatus} compact />
          </div>
        </div>
        {[
          { label: "Cap hit", value: fmtMillions(player.capHit) },
          { label: `True cost (${v.apronMultiplier.toFixed(2)}×)`, value: fmtMillions(v.trueCost) },
          { label: "Production", value: fmtMillions(v.productionValue) },
        ].map((it) => (
          <div key={it.label}>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>{it.label}</div>
            <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 20, color: "#fff", marginTop: 3 }}>{it.value}</div>
          </div>
        ))}
        <div style={{ borderLeft: "1px solid var(--bow-dark-border)", paddingLeft: "clamp(16px,2vw,28px)" }}>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>AASV</div>
          <div style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 30, marginTop: 2, color: positive ? "#3ddc97" : "#ff7a6e" }}>
            {fmtSignedMillions(v.aasv)}
          </div>
        </div>
      </div>
      <p style={{ margin: 0, padding: "8px 18px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6d7078", borderTop: "1px solid var(--bow-dark-border)" }}>
        {provenanceText(assumptions)}
      </p>
    </aside>
  );
}

export function AASVTableEmbed({ players, assumptions = DEFAULT_ASSUMPTIONS }: { players: AnalyticsPlayer[]; assumptions?: Assumptions }) {
  const rows = players.map((p) => ({ p, v: valuate(p, assumptions) }));
  const th: React.CSSProperties = {
    padding: "8px 12px",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 11.5,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--bow-ink)",
    background: "var(--bow-paper)",
    borderBottom: "1px solid var(--border-rule)",
    textAlign: "right",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "9px 12px",
    fontFamily: "var(--font-data)",
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    whiteSpace: "nowrap",
  };
  return (
    <div style={{ margin: "26px 0", border: "1px solid var(--border-rule)", background: "var(--bow-white)", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Player</th>
            <th style={{ ...th, textAlign: "left" }}>Apron</th>
            <th style={th}>Cap hit</th>
            <th style={th}>True cost</th>
            <th style={th}>Production</th>
            <th style={th}>AASV</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, v }) => (
            <tr key={p.slug} style={{ borderTop: "1px solid var(--border-rule)" }}>
              <td style={{ ...td, textAlign: "left", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, textTransform: "uppercase" }}>
                <Link href={`/analytics/players/${p.slug}`} className="bow-link" style={{ color: "var(--bow-ink)", textDecoration: "none" }}>
                  {p.name}
                </Link>
              </td>
              <td style={{ ...td, textAlign: "left" }}>
                <ApronBadge status={p.apronStatus} compact />
              </td>
              <td style={td}>{fmtMillions(p.capHit)}</td>
              <td style={td}>{fmtMillions(v.trueCost)}</td>
              <td style={td}>{fmtMillions(v.productionValue)}</td>
              <td style={{ ...td, fontWeight: 700, color: v.aasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)" }}>{fmtSignedMillions(v.aasv)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: 0, padding: "8px 12px", fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-slate)", borderTop: "1px solid var(--border-rule)" }}>
        {provenanceText(assumptions)} · adjust them on the <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>dashboard</Link>
      </p>
    </div>
  );
}

export function AASVChartEmbed({ players, assumptions = DEFAULT_ASSUMPTIONS }: { players: AnalyticsPlayer[]; assumptions?: Assumptions }) {
  return (
    <div style={{ margin: "26px 0" }}>
      <ValueScatter players={players} assumptions={assumptions} height={400} labelCount={players.length <= 6 ? players.length : 3} title="Live from the model" />
      <p style={captionStyle}>
        {provenanceText(assumptions)} · same chart, all players, on the <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>dashboard</Link>
      </p>
    </div>
  );
}

/** Team-label variant of EmbedMissing — a team with no tracked contracts on file. */
function TeamEmbedMissing({ team }: { team: string }) {
  return (
    <div
      style={{
        border: "1px dashed var(--bow-negative)",
        background: "var(--bow-negative-tint)",
        padding: "12px 16px",
        fontFamily: "var(--font-data)",
        fontSize: 13,
        color: "var(--bow-negative)",
        margin: "22px 0",
      }}
    >
      No tracked contracts for {team ? teamName(team) : "(no team attribute)"} — check the abbreviation against the
      curated list on /analytics.
    </div>
  );
}

export function TeamCapSheetEmbed({ team, players, assumptions = DEFAULT_ASSUMPTIONS }: { team: string; players: AnalyticsPlayer[]; assumptions?: Assumptions }) {
  const rollup = aggregateTeam(players, team, assumptions);
  if (rollup == null) return <TeamEmbedMissing team={team} />;

  const segments = rollup.contracts.map((c) => ({
    slug: c.player.slug,
    label: c.player.name,
    value: c.player.capHit,
    color: c.valuation.aasv >= 0 ? "#158a55" /* --bow-positive */ : "#d63b3b" /* --bow-negative */,
  }));

  return (
    <div style={{ margin: "26px 0", border: "1px solid var(--border-rule)", background: "var(--bow-white)", padding: "18px 20px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <Link
          href={`/analytics/teams/${teamSlug(team)}`}
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)", textDecoration: "none" }}
        >
          {teamName(team)} · Cap Sheet →
        </Link>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", border: "1px solid var(--border-rule)", padding: "3px 9px" }}>
          {rollup.trackedCount} contract{rollup.trackedCount === 1 ? "" : "s"} tracked
        </span>
      </div>
      <div style={{ marginTop: 16 }}>
        <CapStackBar segments={segments} />
      </div>
      <p style={{ margin: "14px 0 0", fontFamily: "var(--font-data)", fontSize: 15, fontWeight: 700, color: rollup.totalAasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)" }}>
        {fmtSignedMillions(rollup.totalAasv)} total AASV
      </p>
      <p style={captionStyle}>
        {provenanceText(assumptions)} · full sheet on{" "}
        <Link href={`/analytics/teams/${teamSlug(team)}`} style={{ color: "var(--bow-blue)" }}>
          the team page
        </Link>
      </p>
    </div>
  );
}

export function TrendChartEmbed({ player, history }: { player: AnalyticsPlayer; history: SeasonStat[] }) {
  if (history.length <= 1) {
    return (
      <div style={{ margin: "26px 0", border: "1px solid var(--border-rule)", borderLeft: "4px solid var(--bow-warning)", background: "var(--bow-white)", padding: "14px 18px" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          Season-over-season impact
        </span>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)" }}>
          First season on file for {player.name} — the trend view unlocks once another season lands.
        </p>
      </div>
    );
  }
  return (
    <div style={{ margin: "26px 0", border: "1px solid var(--border-rule)", background: "var(--bow-white)", padding: "18px 20px" }}>
      <TrendLine history={history} title={`${player.name} — season-over-season impact`} />
    </div>
  );
}

/* ============================================================
 * Decision modules — the intelligence-engine embeds. Same
 * server-safe, prop-driven contract as the five above: they take
 * already-fetched player rows plus `assumptions` (defaulted to
 * DEFAULT_ASSUMPTIONS) and run lib/intelligence's pure builders, never
 * lib/nba.ts.
 * ============================================================ */

/** Trade liquidity has no native risk level (it's its own enum) — map it onto one so it reads as a RiskPill. */
const LIQUIDITY_RISK: Record<TradeLiquidity, RiskLevel> = {
  "positive-asset": "low",
  movable: "moderate",
  "needs-sweetener": "elevated",
  immovable: "severe",
};

const GRADE_COLOR: Record<IndexScore["grade"], string> = {
  A: "var(--bow-positive)",
  B: "var(--bow-blue)",
  C: "var(--bow-warning-text)",
  D: "var(--bow-orange)",
  F: "var(--bow-negative)",
};

/** Compact single-dimension score bar for <TeamFlex/> — a lighter-weight cousin of IndexScorecard's bar, sized for two dimensions instead of seven. */
function FlexScoreBar({ label, score }: { label: string; score: IndexScore }) {
  const color = GRADE_COLOR[score.grade];
  const pct = Math.max(0, Math.min(100, score.score));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 200px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          {label}
        </span>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--bow-slate)" }}>{score.score}/100</span>
          <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 14, color }}>{score.grade}</span>
        </span>
      </div>
      <div role="img" aria-label={`${label}: ${score.score} out of 100, grade ${score.grade}`} style={{ height: 8, background: "var(--bow-border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color }} />
      </div>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>{score.driver}</p>
    </div>
  );
}

/**
 * <ContractVerdict player="slug" /> — "is this deal good?" The engine's full
 * ContractVerdict: a lg VerdictBadge, headline, narrative sentences, an
 * aging/commitment/liquidity RiskPill stack, and the bear/base/bull
 * ScenarioRange so the verdict's assumption-sensitivity is visible in the
 * same breath as the call itself.
 */
export function ContractVerdictEmbed({
  player,
  allPlayers,
  assumptions = DEFAULT_ASSUMPTIONS,
}: {
  player: AnalyticsPlayer;
  allPlayers: AnalyticsPlayer[];
  assumptions?: Assumptions;
}) {
  const valuation = valuate(player, assumptions);
  const ctx = buildLeagueContext(allPlayers, assumptions);
  const verdict = buildContractVerdict(player, valuation, assumptions, ctx);
  const band = buildScenarioBand(player, assumptions);

  return (
    <div style={{ margin: "26px 0", border: "1px solid var(--border-rule)", background: "var(--bow-white)", padding: "clamp(18px,2.4vw,26px)", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link
          href={`/analytics/players/${player.slug}`}
          style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)", textDecoration: "none" }}
        >
          {player.name} · Contract Verdict →
        </Link>
        <VerdictBadge tier={verdict.tier} size="lg" />
      </div>

      <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(18px,2vw,22px)", lineHeight: 1.3, color: "var(--bow-ink)", textWrap: "pretty" }}>
        {verdict.headline}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {verdict.narrative.map((s, i) => (
          <p key={i} style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-ink)" }}>
            {s}
          </p>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <RiskPill
          label="Aging risk"
          level={verdict.agingRisk}
          note="Proxy read on impact trend and forward exposure — there are no ages in the data."
        />
        <RiskPill
          label="Commitment"
          level={verdict.commitmentRisk}
          note={`${fmtMillions(player.totalRemaining)} still owed over ${player.yearsRemaining} year${player.yearsRemaining === 1 ? "" : "s"}.`}
        />
        <RiskPill label="Trade liquidity" level={LIQUIDITY_RISK[verdict.tradeLiquidity]} note={LIQUIDITY_LABELS[verdict.tradeLiquidity]} />
      </div>

      <ScenarioRange band={band} />

      <p style={captionStyle}>{provenanceText(assumptions)}</p>
    </div>
  );
}

/**
 * <TeamFlex team="XXX" /> — "is this team flexible or trapped?" The window
 * label, the cap-flexibility and optionality slices of the franchise index
 * as compact score bars, the apron-risk read, and the single next decision
 * as a DecisionModule.
 */
export function TeamFlexEmbed({
  team,
  allPlayers,
  assumptions = DEFAULT_ASSUMPTIONS,
}: {
  team: string;
  allPlayers: AnalyticsPlayer[];
  assumptions?: Assumptions;
}) {
  const rollup = aggregateTeam(allPlayers, team, assumptions);
  if (rollup == null) return <TeamEmbedMissing team={team} />;

  const allRollups = aggregateTeams(allPlayers, assumptions);
  const brief = buildTeamBrief(rollup, allRollups, assumptions, allPlayers);

  return (
    <div style={{ margin: "26px 0", border: "1px solid var(--border-rule)", background: "var(--bow-white)", padding: "clamp(18px,2.4vw,26px)", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <Link
          href={`/analytics/teams/${teamSlug(team)}`}
          style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)", textDecoration: "none" }}
        >
          {teamName(team)} · Flexibility Read →
        </Link>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", border: "1px solid var(--border-rule)", padding: "3px 9px" }}>
          {WINDOW_LABELS[brief.window]}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        <FlexScoreBar label="Cap flexibility" score={brief.index.capFlexibility} />
        <FlexScoreBar label="Optionality" score={brief.index.optionality} />
      </div>

      <RiskPill label="Apron risk" level={brief.apronRisk.level} note={brief.apronRisk.note} />

      <DecisionModule title={brief.nextDecision.title} body={brief.nextDecision.body} />

      <p style={captionStyle}>{provenanceText(assumptions)}</p>
    </div>
  );
}

/**
 * <ScenarioBand player="slug" /> — "what if assumptions change?" Just the
 * bear/base/bull ScenarioRange (which already carries its own verdict-flip
 * caution) with a short frame so it reads standalone in an article.
 */
export function ScenarioBandEmbed({ player, assumptions = DEFAULT_ASSUMPTIONS }: { player: AnalyticsPlayer; assumptions?: Assumptions }) {
  const band = buildScenarioBand(player, assumptions);
  return (
    <div style={{ margin: "26px 0", border: "1px solid var(--border-rule)", background: "var(--bow-white)", padding: "clamp(18px,2.4vw,26px)", display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
        {player.name} · Under Different Assumptions
      </span>
      <ScenarioRange band={band} />
      <p style={captionStyle}>{provenanceText(assumptions)}</p>
    </div>
  );
}

/* ============================================================
 * Trade analysis — the apron era's defining trick, made interactive.
 * TradeAnalysisView is the pure presentational half, shared by the
 * <TradeAnalysis/> article embed AND the live TradeMachine dashboard tool
 * so a trade quoted in a story and one built on the desk look identical.
 * ============================================================ */

/** One team's column in the trade view — sends → receives, cap delta, and the value swing. */
function TradeSideCard({ side }: { side: TradeSide }) {
  const color = TRADE_SIDE_COLORS[side.verdict];
  const takesOn = side.capDelta >= 0;
  return (
    <div style={{ flex: "1 1 240px", minWidth: 0, border: "1px solid var(--border-rule)", background: "var(--bow-paper)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          href={`/analytics/teams/${teamSlug(side.team)}`}
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--bow-ink)", textDecoration: "none" }}
        >
          {teamName(side.team)}
        </Link>
        <ApronBadge status={side.apronStatus} compact />
      </div>
      <div style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-ink)" }}>
        <span style={{ color: "var(--bow-negative)" }}>▼ Sends</span>{" "}
        <Link href={`/analytics/players/${side.sends.slug}`} className="bow-link" style={{ color: "var(--bow-ink)", fontWeight: 600, textDecoration: "none" }}>
          {side.sends.name}
        </Link>{" "}
        <span style={{ fontFamily: "var(--font-data)", color: "var(--bow-slate)" }}>({fmtMillions(side.capOut)})</span>
        <br />
        <span style={{ color: "var(--bow-positive)" }}>▲ Gets</span>{" "}
        <Link href={`/analytics/players/${side.receives.slug}`} className="bow-link" style={{ color: "var(--bow-ink)", fontWeight: 600, textDecoration: "none" }}>
          {side.receives.name}
        </Link>{" "}
        <span style={{ fontFamily: "var(--font-data)", color: "var(--bow-slate)" }}>({fmtMillions(side.capIn)})</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--bow-slate)" }}>
        <span>Cap {takesOn ? "+" : "−"}{fmtMillions(Math.abs(side.capDelta)).replace("−", "")}</span>
        <span>Incoming true cost {fmtMillions(side.incomingTrueCost)} ({side.multiplier.toFixed(2)}×)</span>
      </div>
      <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--border-rule)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color }}>{TRADE_SIDE_LABELS[side.verdict]}</span>
        <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 22, fontVariantNumeric: "tabular-nums", color }}>{fmtSignedMillions(side.netAasvChange)}</span>
      </div>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 12.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>{side.note}</p>
    </div>
  );
}

export function TradeAnalysisView({ analysis, assumptions = DEFAULT_ASSUMPTIONS, standalone = true }: { analysis: TradeAnalysis; assumptions?: Assumptions; standalone?: boolean }) {
  const created = analysis.valueCreated;
  const createdColor = created > 1_000_000 ? "var(--bow-positive)" : created < -1_000_000 ? "var(--bow-negative)" : "var(--bow-slate)";
  return (
    <div style={standalone ? { margin: "26px 0", border: "1px solid var(--border-rule)", background: "var(--bow-white)", padding: "clamp(18px,2.4vw,26px)", display: "flex", flexDirection: "column", gap: 16 } : { display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Trade Analysis · Apron Repricing
        </span>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Value created</span>
          <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 22, fontVariantNumeric: "tabular-nums", color: createdColor }}>{fmtSignedMillions(created)}</span>
        </span>
      </div>

      <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(18px,2vw,22px)", lineHeight: 1.3, color: "var(--bow-ink)", textWrap: "pretty" }}>
        {analysis.headline}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
        <TradeSideCard side={analysis.a} />
        <TradeSideCard side={analysis.b} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {analysis.narrative.map((s, i) => (
          <p key={i} style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-ink)" }}>
            {s}
          </p>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border-rule)", paddingTop: 12 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
          <strong style={{ color: "var(--bow-ink)" }}>Legality read:</strong> {analysis.legalityNote}
        </p>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
          <strong style={{ color: "var(--bow-ink)" }}>What this ignores:</strong> {analysis.caveats}
        </p>
      </div>

      <p style={captionStyle}>{provenanceText(assumptions)}</p>
    </div>
  );
}

/**
 * <TradeAnalysis send="player-a" receive="player-b" /> — "who wins this swap,
 * and how much value does the apron gap create?" Runs the same pure engine the
 * live TradeMachine uses, so a trade quoted in prose reflects the reader's
 * assumptions the moment the page hydrates.
 */
export function TradeAnalysisEmbed({ playerA, playerB, assumptions = DEFAULT_ASSUMPTIONS }: { playerA: AnalyticsPlayer; playerB: AnalyticsPlayer; assumptions?: Assumptions }) {
  const analysis = buildTradeAnalysis(playerA, playerB, assumptions);
  return <TradeAnalysisView analysis={analysis} assumptions={assumptions} />;
}
