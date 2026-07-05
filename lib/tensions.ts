/* ============================================================
 * The Open Docket — the question engine.
 *
 * Every other file in the analytics stack answers a question the
 * model can settle: what is the number (lib/aasv), what should a GM
 * do about it (lib/intelligence), which worldview is talking
 * (lib/lenses). This file mines those same outputs for the calls the
 * model CANNOT settle — the knife-edge verdicts, the disagreeing
 * metrics, the trades that create value nobody has made — and turns
 * each one into a research question a reader could actually take on.
 *
 * That's the product bet: the interesting story isn't the number the
 * model lands on, it's the number it can't quite land on. A verdict
 * that's obviously a bargain isn't a pitch; a verdict that flips
 * depending on which lens you trust is a pitch, and a researcher who
 * clips the right evidence can go settle it in print.
 *
 * Pure, deterministic, no I/O — same input always produces the same
 * questions with the same ids, so /analytics/questions/[id] can
 * rebuild a question from live data on every request (see
 * lib/questions.ts, the server-only glue that feeds this file).
 *
 * House rules for every detector below:
 *  - `heat` is deterministic and only needs to rank sensibly within
 *    the docket — it scales with dollars at stake and how severe the
 *    tension is, nothing hidden or random.
 *  - `question` names a figure or a name and ends in "?". `setup` is
 *    memo voice: what the model sees, why it can't settle it. `method`
 *    is the one sentence that tells a researcher what to go check.
 *  - ids are `kind:key` and stable: same slug/team/pair always
 *    produces the same id, so a question a reader clips today still
 *    resolves next week.
 * ============================================================ */

import { valuate, fmtMillions, fmtSignedMillions, type AnalyticsPlayer, type Assumptions } from "@/lib/aasv";
import { buildScenarioBand, buildTradeAnalysis, buildTeamBrief, classifyTier } from "@/lib/intelligence";
import type { VerdictTier } from "@/lib/intelligence-types";
import { buildLensSplit, PRESET_LENSES } from "@/lib/lenses";
import { aggregateTeams } from "@/lib/team-aasv";
import { teamName } from "@/lib/nba-teams";
import type { SeasonStat } from "@/lib/nba";
import type { ResearchQuestion, QuestionKind, EvidenceRef, Lens } from "@/lib/research-types";

/* ============================================================
 * Input contract — everything a detector needs, nothing it can fetch
 * for itself. Keeps this file free of I/O so it stays client-safe and
 * trivially testable with fabricated data.
 * ============================================================ */

export interface DocketInput {
  players: AnalyticsPlayer[];
  /** Player slug → season history, oldest season first (per lib/nba's ORDER BY). */
  histories: Record<string, SeasonStat[]>;
  assumptions: Assumptions;
}

/* ============================================================
 * Small shared helpers — presentation and heat math every detector
 * below leans on. Kept local (not imported from lib/intelligence)
 * because they're presentation glue, not model logic.
 * ============================================================ */

/** Tier order for measuring distance between verdicts — mirrors lib/lenses's private copy. */
const TIER_ORDER: Record<VerdictTier, number> = { bargain: 0, fair: 1, premium: 2, albatross: 3 };

/** Noun phrase per tier, grammatical after "calls it …" — mirrors lib/intelligence's private copy. */
const TIER_NOUN: Record<VerdictTier, string> = {
  bargain: "a bargain",
  fair: "fair value",
  premium: "an overpay",
  albatross: "an albatross",
};

/** Every kind the docket can produce, in a fixed order (used for the diversity guarantee). */
const ALL_KINDS: QuestionKind[] = [
  "knife-edge",
  "lens-split",
  "price-production-gap",
  "aging-cliff",
  "metric-disagreement",
  "mutual-gain-trade",
  "window-contradiction",
];

/** Dollar/point scales that map a raw magnitude to a 0–100 heat contribution. Every one has a reason. */
const HEAT = {
  /** Cap hit at/above this reads as "max money" for heat purposes — supermax range. */
  capHitScale: 55_000_000,
  /** AASV swings at/above this read as "the whole ballgame" for a knife-edge. */
  swingScale: 30_000_000,
  /** Apron tax premium at/above this reads as a serious mismatch with a rebuilding/retooling window. */
  taxPremiumScale: 25_000_000,
  /** Leaguewide value created by a repriced trade at/above this reads as a loud free lunch. */
  valueCreatedScale: 15_000_000,
  /** Impact-point decline at/above this reads as an unambiguous cliff, not noise. */
  declineScale: 6,
  /** EPM/BPM gap at/above this reads as the trackers flatly disagreeing. */
  metricGapScale: 5,
} as const;

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** 0–100 contribution from a raw dollar (or point) magnitude against a fixed scale. */
function weight(magnitude: number, scale: number): number {
  return clampPct((Math.abs(magnitude) / scale) * 100);
}

function heatOf(...contributions: Array<{ w: number; weight: number }>): number {
  const totalWeight = contributions.reduce((s, c) => s + c.weight, 0) || 1;
  const blended = contributions.reduce((s, c) => s + c.w * c.weight, 0) / totalWeight;
  return Math.round(clampPct(blended));
}

function yearWord(n: number): string {
  return n === 1 ? "year" : "years";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/* ---------------- evidence builders (one per EvidenceRef kind) ---------------- */

function playerEvidence(p: AnalyticsPlayer): EvidenceRef {
  return { kind: "player", slugs: [p.slug], label: p.name };
}

function teamEvidence(team: string): EvidenceRef {
  return { kind: "team", slugs: [], team, label: `${teamName(team)} cap sheet` };
}

function tradeEvidence(send: AnalyticsPlayer, receive: AnalyticsPlayer): EvidenceRef {
  return { kind: "trade", slugs: [send.slug, receive.slug], label: `${send.name} for ${receive.name}` };
}

/* ============================================================
 * 1. Knife edge — buildScenarioBand(player).verdictFlips.
 *
 * The bear/bull sensitivity band already exists to show the reader how
 * fragile a verdict is. When it's fragile enough to change the CALL,
 * not just the number, that's not a footnote — it's a question: which
 * side of the flip do you actually believe, and why?
 * ============================================================ */

export function detectKnifeEdges({ players, assumptions }: DocketInput): ResearchQuestion[] {
  const out: ResearchQuestion[] = [];
  for (const p of players) {
    const band = buildScenarioBand(p, assumptions);
    if (!band.verdictFlips) continue;

    const bearTier = classifyTier(band.bear);
    const bullTier = classifyTier(band.bull);
    const swing = band.bull.aasv - band.bear.aasv;
    const heat = heatOf({ w: weight(p.capHit, HEAT.capHitScale), weight: 0.55 }, { w: weight(swing, HEAT.swingScale), weight: 0.45 });

    out.push({
      id: `knife-edge:${p.slug}`,
      kind: "knife-edge",
      question: `Is ${p.name}'s ${fmtMillions(p.capHit)} deal ${TIER_NOUN[bullTier]} or ${TIER_NOUN[bearTier]} — which read survives a real season?`,
      setup: [
        `The bear/bull sensitivity band doesn't just move the surplus number, it moves the verdict itself: ${TIER_NOUN[bearTier]} in the pessimistic case, ${TIER_NOUN[bullTier]} in the optimistic one, on the exact same contract.`,
        `That's a ${fmtSignedMillions(swing)} surplus swing sitting on top of a ${fmtMillions(
          p.capHit,
        )} cap hit — a modest shift in what a marginal win is worth, or how hard the apron bites, is enough to flip which side of the ledger this lands on.`,
      ],
      evidence: [playerEvidence(p)],
      method: `Rerun the valuation at the dollars-per-win and apron multipliers you actually believe today, and report which side of the flip they land on before calling this a bargain or an albatross.`,
      heat,
    });
  }
  return out;
}

/* ============================================================
 * 2. Lens split — buildLensSplit(player).span >= 2.
 *
 * Every preset lens is a legitimate front-office worldview, not a
 * strawman. When the extremes land two-plus tiers apart, the model
 * isn't confused — the inputs are contested, and naming which lens you
 * trust IS the argument.
 * ============================================================ */

export function detectLensSplits({ players }: DocketInput): ResearchQuestion[] {
  const out: ResearchQuestion[] = [];
  for (const p of players) {
    const split = buildLensSplit(p, PRESET_LENSES);
    if (split.span < 2) continue;

    let minLens: Lens = PRESET_LENSES[0];
    let maxLens: Lens = PRESET_LENSES[0];
    let minOrder = Infinity;
    let maxOrder = -Infinity;
    for (const lens of PRESET_LENSES) {
      const order = TIER_ORDER[split.verdicts[lens.id]];
      if (order < minOrder) {
        minOrder = order;
        minLens = lens;
      }
      if (order > maxOrder) {
        maxOrder = order;
        maxLens = lens;
      }
    }
    const generousTier = split.verdicts[minLens.id];
    const stingyTier = split.verdicts[maxLens.id];
    const heat = heatOf({ w: weight(p.capHit, HEAT.capHitScale), weight: 0.5 }, { w: (split.span / 3) * 100, weight: 0.5 });

    out.push({
      id: `lens-split:${p.slug}`,
      kind: "lens-split",
      question: `${minLens.name} calls ${p.name}'s contract ${TIER_NOUN[generousTier]}; ${maxLens.name} calls the same deal ${TIER_NOUN[stingyTier]} — who's right about what a win costs?`,
      setup: [
        `Every preset worldview runs the same ${fmtMillions(p.capHit)} contract through its own price-of-a-win and apron fear, and the verdict moves ${split.span} tier${
          split.span === 1 ? "" : "s"
        } depending on which one you believe.`,
        `${minLens.name} (${minLens.philosophy}) and ${maxLens.name} (${maxLens.philosophy}) are the extremes here — the distance between them is the entire disagreement, not a rounding error.`,
      ],
      evidence: [playerEvidence(p)],
      method: `Pick the lens you'd actually defend in print, argue for its price-of-a-win and apron-fear explicitly, and show the verdict that follows instead of hiding the assumption behind a single number.`,
      heat,
    });
  }
  return out;
}

/* ============================================================
 * 3. Price vs. production gap — cap-hit rank vs. production rank.
 *
 * Salary rank is a market bet made in advance; production rank is what
 * actually showed up. When they're far enough apart — paid like a
 * star but ranks like a rotation piece, or the reverse — the model has
 * flagged a genuine argument, not just noise in a single stat line.
 * ============================================================ */

export function detectPriceProductionGaps({ players, assumptions }: DocketInput): ResearchQuestion[] {
  const n = players.length;
  if (n < 2) return [];

  const valuations = new Map(players.map((p) => [p.slug, valuate(p, assumptions)] as const));
  const byCap = [...players].sort((a, b) => b.capHit - a.capHit);
  const byProd = [...players].sort(
    (a, b) => valuations.get(b.slug)!.productionValue - valuations.get(a.slug)!.productionValue,
  );
  const capRank = new Map<string, number>();
  byCap.forEach((p, i) => capRank.set(p.slug, i + 1));
  const prodRank = new Map<string, number>();
  byProd.forEach((p, i) => prodRank.set(p.slug, i + 1));

  // 33% of the tracked count, floored at 5 so a small dataset doesn't flag everything.
  const threshold = Math.max(5, Math.round(n * 0.33));

  const out: ResearchQuestion[] = [];
  for (const p of players) {
    const cr = capRank.get(p.slug)!;
    const pr = prodRank.get(p.slug)!;
    const gap = cr - pr; // negative: paid better than he produces. positive: produces better than he's paid.
    if (Math.abs(gap) < threshold) continue;

    const v = valuations.get(p.slug)!;
    const overpaid = gap < 0;
    const heat = heatOf(
      { w: weight(p.capHit, HEAT.capHitScale), weight: 0.5 },
      { w: (Math.abs(gap) / n) * 100, weight: 0.5 },
    );

    const question = overpaid
      ? `${p.name} is paid like the ${ordinal(cr)}-highest cap hit tracked but ranks ${ordinal(pr)} of ${n} in modeled production — is the money buying something the model can't see, or is this a genuine misprice?`
      : `${p.name} ranks ${ordinal(pr)} of ${n} tracked players in modeled production on only the ${ordinal(
          cr,
        )}-highest cap hit — why isn't the market paying for it?`;

    out.push({
      id: `price-production-gap:${p.slug}`,
      kind: "price-production-gap",
      question,
      setup: [
        `${p.name} carries a ${fmtMillions(p.capHit)} cap hit (${ordinal(cr)} of ${n} tracked) against ${fmtMillions(
          v.productionValue,
        )} of modeled production (${ordinal(pr)} of ${n}) — a ${Math.abs(gap)}-spot gap between what he's paid and what he produces.`,
        overpaid
          ? `That reads as the price outrunning the box score, and rank alone can't separate a real overpay from context the model doesn't track — shot-creation gravity, defensive value the counting stats miss, locker-room command.`
          : `That reads as production outrunning the paycheck, which is either a market inefficiency worth exploiting or a sign the model is missing what the cap hit is actually paying for.`,
      ],
      evidence: [playerEvidence(p)],
      method: `Compare ${p.name}'s on/off-court impact and role against the players immediately around him in cap rank, and clip whichever comps make the gap look earned or unearned.`,
      heat,
    });
  }
  return out;
}

/* ============================================================
 * 4. Aging cliff — multi-season impact decline with real money left.
 *
 * There are no ages in this data, on purpose (see lib/intelligence's
 * honesty rules) — so this is a trend-plus-exposure proxy, not a
 * birthday. A decline only becomes a QUESTION when there's enough
 * forward commitment that "is it real?" has a dollar answer attached.
 * ============================================================ */

export function detectAgingCliffs({ players, histories }: DocketInput): ResearchQuestion[] {
  const out: ResearchQuestion[] = [];
  for (const p of players) {
    const history = histories[p.slug];
    if (!history || history.length < 2) continue;
    const usable = history.filter((h) => h.epm != null || h.bpm != null);
    if (usable.length < 2) continue;

    const first = usable[0];
    const last = usable[usable.length - 1];
    const firstImpact = (first.epm ?? first.bpm) as number;
    const lastImpact = (last.epm ?? last.bpm) as number;
    const decline = firstImpact - lastImpact;
    if (decline < 1.0) continue;

    const bigMoneyLeft = p.yearsRemaining >= 3 || p.totalRemaining >= 120_000_000;
    if (!bigMoneyLeft) continue;

    const heat = heatOf(
      { w: (decline / HEAT.declineScale) * 100, weight: 0.5 },
      { w: weight(p.totalRemaining, HEAT.capHitScale * 3), weight: 0.5 },
    );

    out.push({
      id: `aging-cliff:${p.slug}`,
      kind: "aging-cliff",
      question: `Has ${p.name}'s impact actually fallen off a cliff, or is a ${decline.toFixed(1)}-point drop from ${
        first.season
      } to ${last.season} just variance — with ${fmtMillions(p.totalRemaining)} over ${p.yearsRemaining} ${yearWord(
        p.yearsRemaining,
      )} still owed, can the front office afford to wait and see?`,
      setup: [
        `Tracked impact moved from ${firstImpact.toFixed(1)} in ${first.season} to ${lastImpact.toFixed(
          1,
        )} in ${last.season} — a ${decline.toFixed(1)}-point decline across ${usable.length} usable seasons, with no age in the data to say whether that's a career turn or a blip.`,
        `${fmtMillions(p.totalRemaining)} is still committed over ${p.yearsRemaining} more ${yearWord(
          p.yearsRemaining,
        )}, which is exactly the exposure that turns "down year" into "structural problem" if the trend is real.`,
      ],
      evidence: [playerEvidence(p)],
      method: `Split the decline by usage and role changes and check games missed before assuming it's decline; a real cliff shows up in efficiency at stable usage, not just in a shorter box score.`,
      heat,
    });
  }
  return out;
}

/* ============================================================
 * 5. Metric disagreement — EPM and BPM tell different stories.
 *
 * The model defaults to EPM when both exist. That default is invisible
 * unless someone points out how much the verdict would change if BPM
 * had won the coin flip instead.
 * ============================================================ */

export function detectMetricDisagreements({ players, assumptions }: DocketInput): ResearchQuestion[] {
  const out: ResearchQuestion[] = [];
  for (const p of players) {
    if (p.epm == null || p.bpm == null) continue;
    const diff = p.epm - p.bpm;
    const oppositeSigns = (p.epm > 0 && p.bpm < 0) || (p.epm < 0 && p.bpm > 0);
    const flagged = (oppositeSigns && Math.abs(diff) >= 1.5) || Math.abs(diff) >= 2.5;
    if (!flagged) continue;

    // What the verdict reads as under each tracker alone — EPM is what the model already
    // uses (impact = epm ?? bpm), so the BPM read comes from forcing the fallback.
    const epmTier = classifyTier(valuate(p, assumptions));
    const bpmTier = classifyTier(valuate({ ...p, epm: null }, assumptions));
    const heat = heatOf(
      { w: weight(p.capHit, HEAT.capHitScale), weight: 0.5 },
      { w: (Math.abs(diff) / HEAT.metricGapScale) * 100, weight: 0.5 },
    );

    out.push({
      id: `metric-disagreement:${p.slug}`,
      kind: "metric-disagreement",
      question: `Which metric do you trust for ${p.name} — EPM at ${p.epm.toFixed(1)} (reads ${TIER_NOUN[epmTier]}) or BPM at ${p.bpm.toFixed(
        1,
      )} (reads ${TIER_NOUN[bpmTier]})?`,
      setup: [
        `EPM and BPM are ${Math.abs(diff).toFixed(1)} points apart on the same player-season${
          oppositeSigns ? ", and they don't even agree on the sign of the contribution" : ""
        } — two advanced trackers looking at the same box score and minutes and reaching different verdicts.`,
        `The model prefers EPM whenever both exist, so ${p.name}'s current verdict rests on trusting one tracker over the other on ${fmtMillions(
          p.capHit,
        )} of cap hit${epmTier !== bpmTier ? ` — and the tier itself changes depending on which one wins` : ""}.`,
      ],
      evidence: [playerEvidence(p)],
      method: `Pull a third tracker (LEBRON, DARKO, RAPTOR) as a tiebreaker, and check which side of the EPM/BPM split it lands on before trusting either input over the other.`,
      heat,
    });
  }
  return out;
}

/* ============================================================
 * 6. Mutual-gain trade — the apron repricing the model can see, that
 *    the league hasn't executed.
 *
 * lib/intelligence's buildTradeAnalysis shows how the SAME two
 * contracts can create value out of nothing but a change of team,
 * because the apron multiplier belongs to the receiving side, not the
 * player. When both front offices would gain, "why hasn't this
 * happened?" is a real question — the value model is blind to fit,
 * picks, and locker rooms, and that blind spot is exactly the story.
 * ============================================================ */

export function detectMutualGainTrades({ players, assumptions }: DocketInput): ResearchQuestion[] {
  // Pre-filter to O(n^2)-cheap candidates: different team, different apron tier
  // (otherwise there's no repricing to capture), cap hits within 30% of each other
  // (otherwise it isn't a plausible swap).
  const candidates: Array<{ a: AnalyticsPlayer; b: AnalyticsPlayer }> = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      if (a.team === b.team) continue;
      if (a.apronStatus === b.apronStatus) continue;
      const larger = Math.max(a.capHit, b.capHit, 1);
      if (Math.abs(a.capHit - b.capHit) / larger > 0.3) continue;
      candidates.push({ a, b });
    }
  }

  const scored: Array<{ q: ResearchQuestion; valueCreated: number }> = [];
  for (const { a, b } of candidates) {
    const analysis = buildTradeAnalysis(a, b, assumptions);
    if (!analysis.mutualGain || analysis.valueCreated < 4_000_000) continue;

    const [slugA, slugB] = [a.slug, b.slug].sort();
    const heat = heatOf(
      { w: weight(analysis.valueCreated, HEAT.valueCreatedScale), weight: 0.7 },
      { w: weight(Math.min(a.capHit, b.capHit), HEAT.capHitScale), weight: 0.3 },
    );

    scored.push({
      valueCreated: analysis.valueCreated,
      q: {
        id: `mutual-gain-trade:${slugA}+${slugB}`,
        kind: "mutual-gain-trade",
        question: `Why hasn't ${a.team} and ${b.team} swapped ${a.name} for ${b.name}, when the apron math alone creates ${fmtSignedMillions(
          analysis.valueCreated,
        )} of value for both sides?`,
        setup: [
          `${a.name} (${fmtMillions(a.capHit)}, ${a.team}) and ${b.name} (${fmtMillions(
            b.capHit,
          )}, ${b.team}) sit at different apron tiers, and repricing each contract at the OTHER team's tier is enough to leave both front offices ahead: ${a.team} nets ${fmtSignedMillions(
            analysis.a.netAasvChange,
          )}, ${b.team} nets ${fmtSignedMillions(analysis.b.netAasvChange)}.`,
          `That's a free lunch the apron created, purely on value — and the value model has no way to see the fit, draft compensation, or locker-room fallout that's presumably the real reason nobody has made this call.`,
        ],
        evidence: [tradeEvidence(a, b), playerEvidence(a), playerEvidence(b), teamEvidence(a.team), teamEvidence(b.team)],
        method: `Build the case for what the value model can't price — positional fit, third-team logistics, or a health/character flag — and show why it outweighs ${fmtSignedMillions(
          analysis.valueCreated,
        )} of created surplus.`,
        heat,
      },
    });
  }

  return scored
    .sort((x, y) => y.valueCreated - x.valueCreated)
    .slice(0, 5)
    .map((r) => r.q);
}

/* ============================================================
 * 7. Window contradiction — the team's stated window argues with its
 *    own cap posture.
 *
 * buildTeamBrief already reads a window off production percentile and
 * an apron-risk level off the tax premium; when a rebuilding team pays
 * a contender's tax, or a "contending" team grades out D/F on roster
 * quality, the two halves of the same brief are in tension with each
 * other — and that tension is the story, not a bug in either read.
 * ============================================================ */

export function detectWindowContradictions({ players, assumptions }: DocketInput): ResearchQuestion[] {
  const rollups = aggregateTeams(players, assumptions);
  const out: ResearchQuestion[] = [];

  for (const rollup of rollups) {
    const brief = buildTeamBrief(rollup, rollups, assumptions, players);
    const { window, index, apronRisk } = brief;

    const payingContendersTax =
      (window === "rebuilding" || window === "retooling") && (apronRisk.level === "elevated" || apronRisk.level === "severe");
    const contendingOnPaperOnly = window === "contending" && (index.rosterQuality.grade === "D" || index.rosterQuality.grade === "F");
    if (!payingContendersTax && !contendingOnPaperOnly) continue;

    const taxPremium = rollup.totalTrueCost - rollup.totalCap;
    const extraEvidence: EvidenceRef[] = [];
    if (brief.bestAsset) extraEvidence.push(playerEvidence(brief.bestAsset.player));
    if (brief.worstLiability) extraEvidence.push(playerEvidence(brief.worstLiability.player));

    let question: string;
    let setup: string[];
    let method: string;
    let heat: number;

    if (payingContendersTax) {
      question = `Why is ${rollup.team} paying ${fmtMillions(taxPremium)} of apron tax like a contender while the roster still reads ${window}?`;
      setup = [
        `${rollup.team}'s tracked books sit at ${apronRisk.level} apron risk: ${apronRisk.note}`,
        `But the production numbers behind it classify the roster as ${window}, not contending — ${brief.thesis}`,
      ];
      method = `Pull the full 15-man books beyond the tracked contracts and check whether the tax bill is buying optionality the model can't score (trade exceptions, second-round sweeteners), or whether it's a front office paying contender rates for a roster it hasn't built yet.`;
      heat = heatOf(
        { w: weight(taxPremium, HEAT.taxPremiumScale), weight: 0.6 },
        { w: apronRisk.level === "severe" ? 100 : 65, weight: 0.4 },
      );
    } else {
      question = `How is ${rollup.team} grading as "contending" with a ${index.rosterQuality.grade}-grade roster (${index.rosterQuality.score}/100)?`;
      setup = [
        `${rollup.team}'s production numbers clear the bar for a contending window, but roster quality itself grades ${index.rosterQuality.grade} — ${index.rosterQuality.driver}`,
        brief.thesis,
      ];
      method = `Check whether thin tracked-roster depth (bench pieces off the model's radar) explains the gap, or whether the "contending" read is a lagging indicator on a front office that's already a tier behind its own cap sheet.`;
      heat = heatOf(
        { w: 100 - index.rosterQuality.score, weight: 0.5 },
        { w: weight(rollup.totalCap, HEAT.capHitScale * 2), weight: 0.5 },
      );
    }

    out.push({
      id: `window-contradiction:${rollup.team}`,
      kind: "window-contradiction",
      question,
      setup,
      evidence: [teamEvidence(rollup.team), ...extraEvidence],
      method,
      heat,
    });
  }
  return out;
}

/* ============================================================
 * The docket — every detector, ranked and capped.
 *
 * Ranking is heat-desc, but a pure heat sort would let one loud
 * detector (say, knife edges on max-money deals) crowd out every other
 * flavor of tension. The diversity rule fixes that: the top 2 results
 * of every kind that produced anything are guaranteed a seat before
 * the remaining slots fill by heat alone. The board is capped at 24 so
 * it reads as a curated docket, not a data dump.
 * ============================================================ */

/** kind → detector, so lib/questions.ts can resolve an id's `kind:` prefix without re-listing them. */
export const DETECTORS: Record<QuestionKind, (input: DocketInput) => ResearchQuestion[]> = {
  "knife-edge": detectKnifeEdges,
  "lens-split": detectLensSplits,
  "price-production-gap": detectPriceProductionGaps,
  "aging-cliff": detectAgingCliffs,
  "metric-disagreement": detectMetricDisagreements,
  "mutual-gain-trade": detectMutualGainTrades,
  "window-contradiction": detectWindowContradictions,
};

const DOCKET_CAP = 24;
const GUARANTEE_PER_KIND = 2;

export function buildDocket(input: DocketInput): ResearchQuestion[] {
  const groups = ALL_KINDS.map((kind) => DETECTORS[kind](input));

  const seen = new Set<string>();
  const guaranteed: ResearchQuestion[] = [];
  for (const group of groups) {
    const top = [...group].sort((a, b) => b.heat - a.heat).slice(0, GUARANTEE_PER_KIND);
    for (const q of top) {
      if (!seen.has(q.id)) {
        seen.add(q.id);
        guaranteed.push(q);
      }
    }
  }

  const remaining = groups
    .flat()
    .filter((q) => !seen.has(q.id))
    .sort((a, b) => b.heat - a.heat);

  return [...guaranteed, ...remaining].slice(0, DOCKET_CAP).sort((a, b) => b.heat - a.heat);
}
