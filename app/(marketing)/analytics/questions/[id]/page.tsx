import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestionById } from "@/lib/questions";
import { getAnalyticsPlayers, getAnalyticsPlayersBySlugs } from "@/lib/nba";
import { aggregateTeam } from "@/lib/team-aasv";
import { teamName, teamSlug } from "@/lib/nba-teams";
import { DEFAULT_ASSUMPTIONS, fmtMillions, fmtSignedMillions, valuate, type AnalyticsPlayer } from "@/lib/aasv";
import { buildContractVerdict, buildLeagueContext, buildScenarioBand, buildTradeAnalysis } from "@/lib/intelligence";
import type { LeagueContext } from "@/lib/intelligence-types";
import { QUESTION_KIND_LABELS, type EvidenceRef } from "@/lib/research-types";
import { VerdictBadge, ScenarioRange } from "@/components/intelligence";
import ApronBadge from "@/components/analytics/ApronBadge";
import { TradeAnalysisView } from "@/components/analytics/embeds";
import ClipButton from "@/components/research/ClipButton";
import QuestionKindChip from "@/components/research/QuestionKindChip";
import EvidenceCard from "@/components/research/EvidenceCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: raw } = await params;
  const question = (await getQuestionById(decodeURIComponent(raw)));
  if (!question) return { title: "Case Not Found — BOW Open Docket" };
  const title = `${question.question} — BOW Open Docket`;
  const description = `${question.setup[0]} ${question.method}`;
  return {
    title,
    description,
    openGraph: { type: "article", title, description, url: `/analytics/questions/${raw}` },
    twitter: { card: "summary", title, description },
  };
}

const captionStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-data)",
  fontSize: 10.5,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
};

/** Player evidence — resolved verdict + scenario band under house assumptions. */
async function PlayerEvidence({ evidenceRef, ctx, questionId }: { evidenceRef: EvidenceRef; ctx: LeagueContext; questionId: string }) {
  const [player] = (await getAnalyticsPlayersBySlugs(evidenceRef.slugs));
  if (!player) {
    return (
      <EvidenceCard kicker="Player evidence">
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
          {evidenceRef.label} is no longer on the tracked list.
        </p>
      </EvidenceCard>
    );
  }
  const valuation = valuate(player, DEFAULT_ASSUMPTIONS);
  const verdict = buildContractVerdict(player, valuation, DEFAULT_ASSUMPTIONS, ctx);
  const band = buildScenarioBand(player, DEFAULT_ASSUMPTIONS);

  return (
    <EvidenceCard
      kicker="Player evidence"
      action={
        <ClipButton
          kind="verdict"
          title={`${player.name} — ${verdict.headline}`}
          detail={verdict.narrative[0]}
          refs={[evidenceRef]}
          questionId={questionId}
        />
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link
          href={`/analytics/players/${player.slug}`}
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "0.01em", textTransform: "uppercase", color: "var(--bow-ink)", textDecoration: "none" }}
        >
          {player.name} &rarr;
        </Link>
        <VerdictBadge tier={verdict.tier} size="lg" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-slate)" }}>
        <span style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{player.team}</span>
        <ApronBadge status={player.apronStatus} compact />
        <span>
          {fmtMillions(player.capHit)}/yr &middot; {player.yearsRemaining} yr{player.yearsRemaining === 1 ? "" : "s"} &middot; {fmtMillions(player.totalRemaining)} left
        </span>
      </div>
      <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(17px,2vw,20px)", lineHeight: 1.32, color: "var(--bow-ink)", textWrap: "pretty" }}>
        {verdict.headline}
      </p>
      <ScenarioRange band={band} />
    </EvidenceCard>
  );
}

/** Trade evidence — the two-player swap, reusing TradeAnalysisView wholesale (no forked internals). */
async function TradeEvidence({ evidenceRef, questionId }: { evidenceRef: EvidenceRef; questionId: string }) {
  const [send, receive] = (await getAnalyticsPlayersBySlugs(evidenceRef.slugs));
  if (!send || !receive) {
    return (
      <EvidenceCard kicker="Trade evidence">
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
          {evidenceRef.label} — one side of this swap is no longer on the tracked list.
        </p>
      </EvidenceCard>
    );
  }
  const analysis = buildTradeAnalysis(send, receive, DEFAULT_ASSUMPTIONS);
  const detail = `${send.team} ${fmtSignedMillions(analysis.a.netAasvChange)} · ${receive.team} ${fmtSignedMillions(analysis.b.netAasvChange)}`;

  return (
    <EvidenceCard
      kicker="Trade evidence"
      action={<ClipButton kind="trade" title={analysis.headline} detail={detail} refs={[evidenceRef]} questionId={questionId} />}
    >
      <TradeAnalysisView analysis={analysis} assumptions={DEFAULT_ASSUMPTIONS} standalone={false} />
    </EvidenceCard>
  );
}

/** Team evidence — a compact cap-sheet readout, house assumptions. */
function TeamEvidence({ evidenceRef, allPlayers, questionId }: { evidenceRef: EvidenceRef; allPlayers: AnalyticsPlayer[]; questionId: string }) {
  const team = evidenceRef.team ?? "";
  const rollup = aggregateTeam(allPlayers, team, DEFAULT_ASSUMPTIONS);
  if (!rollup) {
    return (
      <EvidenceCard kicker="Team evidence">
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
          {evidenceRef.label} has no tracked contracts on file.
        </p>
      </EvidenceCard>
    );
  }
  const taxPremium = rollup.totalTrueCost - rollup.totalCap;
  const stats: Array<[string, string, string?]> = [
    ["Cap", fmtMillions(rollup.totalCap)],
    ["True cost", fmtMillions(rollup.totalTrueCost)],
    ["Tax premium", fmtMillions(taxPremium)],
    ["AASV", fmtSignedMillions(rollup.totalAasv), rollup.totalAasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)"],
  ];

  return (
    <EvidenceCard
      kicker="Team evidence"
      action={
        <ClipButton
          kind="team"
          title={`${teamName(team)} cap sheet`}
          detail={`${fmtMillions(rollup.totalCap)} cap · ${fmtSignedMillions(rollup.totalAasv)} AASV across ${rollup.trackedCount} tracked contract${rollup.trackedCount === 1 ? "" : "s"}`}
          refs={[evidenceRef]}
          questionId={questionId}
        />
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link
          href={`/analytics/teams/${teamSlug(team)}`}
          style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, letterSpacing: "0.01em", textTransform: "uppercase", color: "var(--bow-ink)", textDecoration: "none" }}
        >
          {teamName(team)} &rarr;
        </Link>
        <ApronBadge status={rollup.apronStatus} compact />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px" }}>
        {stats.map(([label, value, color]) => (
          <div key={label}>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{label}</div>
            <div style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 18, fontVariantNumeric: "tabular-nums", color: color ?? "var(--bow-ink)" }}>{value}</div>
          </div>
        ))}
      </div>
    </EvidenceCard>
  );
}

export default async function QuestionCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const question = (await getQuestionById(id));
  if (!question) notFound();

  const allPlayers = (await getAnalyticsPlayers());
  const ctx = buildLeagueContext(allPlayers, DEFAULT_ASSUMPTIONS);
  const kindLabel = QUESTION_KIND_LABELS[question.kind];

  return (
    <div data-screen-label="Docket Case File">
      {/* breadcrumb + header */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(20px,3vw,32px) clamp(18px,4vw,40px) clamp(28px,3.6vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>
            <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>
              Analytics
            </Link>
            <span aria-hidden>/</span>
            <Link href="/analytics/questions" style={{ color: "var(--bow-blue)" }}>
              Open Docket
            </Link>
            <span aria-hidden>/</span>
            <span style={{ color: "var(--bow-ink)" }}>{kindLabel}</span>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <QuestionKindChip kind={question.kind} />
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
              heat {question.heat}
            </span>
          </div>

          <h1
            style={{
              margin: "16px 0 0",
              fontFamily: "var(--font-editorial)",
              fontWeight: 600,
              fontSize: "clamp(28px,4.4vw,46px)",
              lineHeight: 1.14,
              letterSpacing: "-0.012em",
              color: "var(--bow-ink)",
              maxWidth: "24ch",
              textWrap: "pretty",
            }}
          >
            {question.question}
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, maxWidth: 720 }}>
            {question.setup.map((s, i) => (
              <p key={i} style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.4vw,17px)", lineHeight: 1.6, color: "var(--bow-ink)" }}>
                {s}
              </p>
            ))}
          </div>

          <div
            style={{
              marginTop: 22,
              maxWidth: 720,
              border: "1px solid var(--border-rule)",
              borderLeft: "4px solid var(--bow-orange)",
              background: "var(--bow-white)",
              padding: "14px 18px",
            }}
          >
            <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
              How you&rsquo;d settle it
            </span>
            <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-ink)" }}>{question.method}</p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 24 }}>
            <ClipButton
              kind="question"
              title={question.question}
              detail={question.setup[0]}
              refs={question.evidence}
              questionId={question.id}
              style={{ fontSize: 13, padding: "9px 16px" }}
            />
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)", maxWidth: 420 }}>
              Take this into your notebook &mdash; clipping freezes the case, evidence and all, so you can build an argument
              around it.
            </span>
          </div>
        </div>
      </section>

      {/* THE EVIDENCE */}
      <section style={{ background: "#fff", padding: "clamp(32px,4.5vw,56px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
              The Evidence
            </span>
            <h2 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(22px,2.8vw,32px)", lineHeight: 1.15 }}>
              What&rsquo;s already on the record.
            </h2>
            <p style={{ ...captionStyle, marginTop: 6 }}>
              Rendered under the house assumption set on the server &mdash; this is not personalized. Your own
              sliders and lens apply once you open a player&rsquo;s page or clip from a live surface.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 24 }}>
            {question.evidence.map((evidenceRef, i) => {
              if (evidenceRef.kind === "player")
                return <PlayerEvidence key={i} evidenceRef={evidenceRef} ctx={ctx} questionId={question.id} />;
              if (evidenceRef.kind === "trade") return <TradeEvidence key={i} evidenceRef={evidenceRef} questionId={question.id} />;
              return <TeamEvidence key={i} evidenceRef={evidenceRef} allPlayers={allPlayers} questionId={question.id} />;
            })}
          </div>
        </div>
      </section>

      {/* NEXT STEP */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(22px,3vw,32px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide" style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/analytics/notebook" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
            Build the argument in your notebook &rarr;
          </Link>
          <Link href="/analytics/questions" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
            Back to the docket &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
