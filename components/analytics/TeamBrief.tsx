"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DecisionModule, ExecutiveSummary, IndexScorecard, MemoSection, RiskPill, VerdictBadge } from "@/components/intelligence";
import TeamCapSheet from "@/components/analytics/TeamCapSheet";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import ClipButton from "@/components/research/ClipButton";
import { fmtMillions, fmtSignedMillions, valuate, type AnalyticsPlayer } from "@/lib/aasv";
import { buildContractVerdict, buildLeagueContext, buildTeamBrief } from "@/lib/intelligence";
import { WINDOW_LABELS, type VerdictTier } from "@/lib/intelligence-types";
import { teamName } from "@/lib/nba-teams";
import { aggregateTeam, aggregateTeams } from "@/lib/team-aasv";

/**
 * TeamBrief — the "Front Office Brief" for one team: thesis, Franchise
 * Strategy Index, best asset / worst liability, apron exposure, and the
 * single next decision, all derived live from lib/intelligence under the
 * SAME session-persisted assumptions the audit-trail cap sheet below it
 * uses (TeamCapSheet reads the same sessionStorage-backed store, so the
 * brief and the ledger never disagree, even though each recomputes
 * independently in its own useMemo).
 */
export default function TeamBrief({ team, players }: { team: string; players: AnalyticsPlayer[] }) {
  const [assumptions] = useAssumptions();

  const rollup = useMemo(() => aggregateTeam(players, team, assumptions), [players, team, assumptions]);
  const allRollups = useMemo(() => aggregateTeams(players, assumptions), [players, assumptions]);
  const ctx = useMemo(() => buildLeagueContext(players, assumptions), [players, assumptions]);

  const brief = useMemo(
    () => (rollup ? buildTeamBrief(rollup, allRollups, assumptions, players) : null),
    [rollup, allRollups, assumptions, players],
  );

  const bestVerdict = useMemo(
    () =>
      brief?.bestAsset
        ? buildContractVerdict(brief.bestAsset.player, valuate(brief.bestAsset.player, assumptions), assumptions, ctx)
        : null,
    [brief, assumptions, ctx],
  );
  const worstVerdict = useMemo(
    () =>
      brief?.worstLiability
        ? buildContractVerdict(brief.worstLiability.player, valuate(brief.worstLiability.player, assumptions), assumptions, ctx)
        : null,
    [brief, assumptions, ctx],
  );

  if (rollup == null || brief == null) {
    return (
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
        No tracked contracts for {teamName(team)} yet.
      </p>
    );
  }

  // Headline = the thesis's first sentence — derived, never a separate hardcoded take.
  const firstSentence = brief.thesis.split(/(?<=\.)\s+/)[0] ?? brief.thesis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(28px,3.6vw,44px)" }}>
      {/* live header chips: window read + apron exposure, both re-derived on every slider move */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
        <span style={windowChipStyle}>{WINDOW_LABELS[brief.window]}</span>
        <RiskPill label="Apron exposure" level={brief.apronRisk.level} />
      </div>

      <ExecutiveSummary
        eyebrow="Front Office Brief"
        headline={firstSentence}
        stats={[
          { label: "Tracked production", value: fmtMillions(rollup.totalProduction) },
          { label: "Tracked true cost", value: fmtMillions(rollup.totalTrueCost) },
          { label: "Net surplus", value: fmtSignedMillions(rollup.totalAasv), tone: rollup.totalAasv >= 0 ? "positive" : "negative" },
          { label: "Tracked contracts", value: String(rollup.trackedCount) },
          { label: "FSI grade", value: `${brief.index.overall.grade} · ${brief.index.overall.score}/100` },
        ]}
        recommendation={{ action: brief.nextDecision.title, rationale: brief.nextDecision.body }}
      />

      <ClipButton
        kind="team"
        title={`${teamName(team)}: ${firstSentence}`}
        detail={`Cap ${fmtMillions(rollup.totalCap)} · true cost ${fmtMillions(rollup.totalTrueCost)} · AASV ${fmtSignedMillions(rollup.totalAasv)}`}
        refs={[{ kind: "team", slugs: [], team, label: `${teamName(team)} cap sheet` }]}
        style={{ alignSelf: "flex-start" }}
      />

      <IndexScorecard index={brief.index} title={`${teamName(team)} · Franchise Strategy Index`} />

      <MemoSection label="Roster thesis">
        <p style={memoText}>{brief.thesis}</p>
      </MemoSection>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
        {brief.bestAsset && bestVerdict && (
          <AssetCard kicker="Best asset" player={brief.bestAsset.player} comment={brief.bestAsset.comment} tier={bestVerdict.tier} accent="var(--bow-positive)" />
        )}
        {brief.worstLiability && worstVerdict && (
          <AssetCard kicker="Worst liability" player={brief.worstLiability.player} comment={brief.worstLiability.comment} tier={worstVerdict.tier} accent="var(--bow-negative)" />
        )}
      </div>

      <MemoSection label="Apron exposure">
        <RiskPill label="Tracked books" level={brief.apronRisk.level} note={brief.apronRisk.note} />
      </MemoSection>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
        <DecisionModule title={brief.nextDecision.title} body={brief.nextDecision.body} tone="action" />
        <DecisionModule title="Strategic warning" body={brief.strategicWarning} tone="warning" />
      </div>

      {/* audit trail — the full contract-level ledger + sliders, unchanged mechanics, now with a verdict per row */}
      <TeamCapSheet team={team} players={players} />
    </div>
  );
}

function AssetCard({
  kicker,
  player,
  comment,
  tier,
  accent,
}: {
  kicker: string;
  player: AnalyticsPlayer;
  comment: string;
  tier: VerdictTier;
  accent: string;
}) {
  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderTop: `4px solid ${accent}`, padding: "clamp(16px,2vw,22px)", display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{kicker}</span>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Link
          href={`/analytics/players/${player.slug}`}
          className="bow-link"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.01em", color: "var(--bow-ink)", textDecoration: "none" }}
        >
          {player.name}
        </Link>
        <VerdictBadge tier={tier} />
      </div>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)" }}>{comment}</p>
    </div>
  );
}

const windowChipStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--bow-ink)",
  border: "1px solid var(--border-rule)",
  background: "var(--bow-white)",
  padding: "5px 12px",
};

const memoText: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-interface)",
  fontSize: 15,
  lineHeight: 1.65,
  color: "var(--bow-ink)",
};
