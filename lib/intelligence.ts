/* ============================================================
 * Intelligence engine — the "so what?" layer over lib/aasv.
 *
 * lib/aasv answers "what is the number?" (production value, true cost,
 * AASV). This file answers "so what should a GM do?": it turns those
 * raw valuations into verdicts, memos, risk reads, comps, and franchise
 * scores. Every output is DERIVED FROM THE NUMBERS — no hardcoded
 * opinions, no invented facts. Pure, deterministic, client-safe: the
 * dashboards recompute all of this live as the reader drags assumption
 * sliders, so a verdict is the model's opinion under the reader's
 * assumptions, not a frozen take.
 *
 * Honesty rules baked in here:
 *  - The dataset is ~40 curated star contracts. We ALWAYS rank against
 *    "tracked deals / tracked teams", never "the league".
 *  - There are NO ages in the data. Aging risk is a PROXY built from
 *    impact trend, forward money exposure, and whether production
 *    already trails cost — never a birthday. Comments flag every proxy.
 *  - Language stays "projects to / under these assumptions", never
 *    false certainty.
 * ============================================================ */

import {
  valuate,
  fmtMillions,
  fmtSignedMillions,
  fmtWins,
  ASSUMPTION_BOUNDS,
  APRON_LABELS,
  type AnalyticsPlayer,
  type Assumptions,
  type ApronStatus,
  type Valuation,
} from "@/lib/aasv";
import type { TeamRollup, TeamContract } from "@/lib/team-aasv";
import type { SeasonStat } from "@/lib/nba";
import {
  VERDICT_LABELS,
  RISK_LABELS,
  type VerdictTier,
  type RiskLevel,
  type RiskFactor,
  type TradeLiquidity,
  type ContractVerdict,
  type ScenarioBand,
  type MemoAction,
  type ComparablePlayer,
  type PlayerMemo,
  type IndexScore,
  type FranchiseIndex,
  type WindowState,
  type TeamBrief,
  type LeagueContext,
  type TradeSide,
  type TradeSideVerdict,
  type TradeAnalysis,
} from "@/lib/intelligence-types";

/* ============================================================
 * Threshold constants — every magic number lives here with a reason.
 * Dollars are RAW (AnalyticsPlayer.capHit etc. are dollars, not millions).
 * ============================================================ */

/** Verdict tiers off surplusPct = aasv / trueCost, with an absolute-dollar override. */
const TIER = {
  /** ≥ +35% over true cost is a clear bargain… */
  bargainPct: 0.35,
  /** …and so is any deal ≥ +$20M in raw surplus, even if the % is muted on a huge cap hit. */
  bargainAbs: 20_000_000,
  /** Break-even band: within ±15% of true cost reads as "fairly priced". */
  fairFloorPct: -0.15,
  /** Below −40% of true cost the overpay is structural, not cyclical → albatross. */
  albatrossPct: -0.4,
  /** …or any deal ≥ −$20M underwater in raw dollars. */
  albatrossAbs: -20_000_000,
} as const;

/** Trade-liquidity cutoffs (raw dollars of AASV / cap). */
const LIQ = {
  positiveAsset: 8_000_000, // ≥ +$8M surplus → teams line up for it
  modestCap: 20_000_000, // any positive surplus under this cap is still a desirable asset
  sweetenerBelow: -8_000_000, // ≤ −$8M surplus → you attach something to move it
  immovableBelow: -20_000_000, // ≤ −$20M AND second apron → functionally immovable
} as const;

/** Commitment risk by total dollars still owed (totalRemaining). */
const COMMIT = { low: 60_000_000, moderate: 130_000_000, elevated: 210_000_000 } as const;

const APRON_NUM: Record<ApronStatus, number> = { below: 0, first: 1, second: 2 };

/** Grammatical noun phrase per tier — reads cleanly after "grades as" / "in the … case" (no article snags). */
const TIER_PHRASE: Record<VerdictTier, string> = {
  bargain: "a bargain",
  fair: "fair value",
  premium: "an overpay",
  albatross: "an albatross",
};

/* ============================================================
 * Small numeric helpers.
 * ============================================================ */

const clamp01to100 = (n: number): number => Math.min(100, Math.max(0, n));
const clampV = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Midrank percentile (0–100) of `value` within `all`; neutral 50 when there's nothing to compare against. */
function percentileRank(value: number, all: number[]): number {
  if (all.length <= 1) return 50;
  const below = all.filter((v) => v < value).length;
  const equal = all.filter((v) => v === value).length;
  return ((below + equal / 2) / all.length) * 100;
}

/** 1-based rank descending (1 = highest value); ties share the better rank. */
function rankDesc(value: number, all: number[]): number {
  return all.filter((v) => v > value).length + 1;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Surplus as a share of true cost; 0 when true cost is non-positive (per the contract). */
function surplusPct(v: Valuation): number {
  return v.trueCost > 0 ? v.aasv / v.trueCost : 0;
}

/** Impact history is oldest-season-first; returns latest−earliest impact (EPM else BPM), or null if <2 usable seasons. */
function impactTrend(history?: SeasonStat[]): number | null {
  if (!history || history.length < 2) return null;
  const vals = history.map((h) => h.epm ?? h.bpm).filter((x): x is number => x != null);
  if (vals.length < 2) return null;
  return vals[vals.length - 1] - vals[0];
}

/* ============================================================
 * Core classifiers — shared by verdicts, comps, and briefs so the
 * per-player and league views can never disagree.
 * ============================================================ */

/** Verdict tier from a valuation. Percentage-first, with absolute-dollar overrides at both ends. */
function classifyTier(v: Valuation): VerdictTier {
  const pct = surplusPct(v);
  if (pct >= TIER.bargainPct || v.aasv >= TIER.bargainAbs) return "bargain";
  if (v.aasv <= TIER.albatrossAbs || pct <= TIER.albatrossPct) return "albatross";
  if (pct >= TIER.fairFloorPct) return "fair"; // −15% … +35%
  return "premium"; // −40% … −15%
}

/** Trade liquidity from surplus + money + apron exposure. */
function classifyLiquidity(player: AnalyticsPlayer, v: Valuation): TradeLiquidity {
  // Deeply underwater AND second-apron rigid → nobody wants it without huge inducement.
  if (v.aasv <= LIQ.immovableBelow && player.apronStatus === "second") return "immovable";
  // Positive surplus is a magnet: either a big raw surplus, or any surplus on modest money.
  if (v.aasv >= LIQ.positiveAsset || (v.aasv > 0 && player.capHit <= LIQ.modestCap)) return "positive-asset";
  // Clearly negative but not immovable → you have to attach a pick/young player.
  if (v.aasv <= LIQ.sweetenerBelow) return "needs-sweetener";
  // Big money hovering near fair value → moves, but as salary-matching, not as a prize.
  return "movable";
}

/** Aging PROXY (no ages exist). Blends: (a) impact trend, (b) forward money exposure, (c) production already trailing cost. */
function classifyAgingRisk(player: AnalyticsPlayer, v: Valuation, history?: SeasonStat[]): RiskLevel {
  let score = 0;
  const trend = impactTrend(history);
  if (trend != null) {
    if (trend <= -1.5) score += 2; // steep multi-season decline
    else if (trend <= -0.5) score += 1; // soft decline
    else if (trend >= 1.0) score -= 1; // still ascending — de-risks the years ahead
  }
  if (player.yearsRemaining >= 4) score += 1; // paying for a lot of unknown future seasons
  if (player.totalRemaining >= 180_000_000) score += 1; // heavy dollar exposure to that future
  if (v.aasv < 0) score += 1; // already underwater
  if (v.aasv <= -15_000_000) score += 1; // and not marginally so
  if (score >= 4) return "severe";
  if (score >= 2) return "elevated";
  if (score >= 1) return "moderate";
  return "low";
}

/** Sheer forward exposure = years × dollars still owed, read off totalRemaining. */
function classifyCommitmentRisk(player: AnalyticsPlayer): RiskLevel {
  const t = player.totalRemaining;
  if (t < COMMIT.low) return "low";
  if (t < COMMIT.moderate) return "moderate";
  if (t < COMMIT.elevated) return "elevated";
  return "severe";
}

/* ============================================================
 * 1. League context — percentile backdrop under the SAME assumptions.
 * ============================================================ */

export function buildLeagueContext(players: AnalyticsPlayer[], assumptions: Assumptions): LeagueContext {
  const valued = players.map((p) => ({ slug: p.slug, aasv: valuate(p, assumptions).aasv }));
  const ranked = [...valued].sort((a, b) => b.aasv - a.aasv);
  const rankBySurplus = new Map<string, number>();
  ranked.forEach((r, i) => rankBySurplus.set(r.slug, i + 1));
  return {
    rankBySurplus,
    trackedCount: players.length,
    medianAasv: median(valued.map((v) => v.aasv)),
  };
}

/* ============================================================
 * 2. Scenario band — bear / base / bull sensitivity.
 * ============================================================ */

/** Shift assumptions harsher (dir=-1, bear) or rosier (dir=+1, bull), clamped to ASSUMPTION_BOUNDS. */
function shiftAssumptions(a: Assumptions, dir: -1 | 1): Assumptions {
  const b = ASSUMPTION_BOUNDS;
  const sign = dir < 0 ? 1 : -1; // bear raises replacement/apron (harsher); bull lowers them
  return {
    // Bear: a marginal win is worth less (−20%). Bull: worth more (+20%).
    dollarsPerWin: clampV(a.dollarsPerWin * (dir < 0 ? 0.8 : 1.2), b.dollarsPerWin.min, b.dollarsPerWin.max),
    // Bear: replacement level +0.5 (production above replacement shrinks). Bull: −0.5.
    replacementLevel: clampV(a.replacementLevel + sign * 0.5, b.replacementLevel.min, b.replacementLevel.max),
    pointsPerWin: a.pointsPerWin,
    apronMultipliers: {
      below: a.apronMultipliers.below,
      // Bear: apron tax bites harder (+0.25). Bull: eases (−0.25).
      first: clampV(a.apronMultipliers.first + sign * 0.25, b.apronFirst.min, b.apronFirst.max),
      second: clampV(a.apronMultipliers.second + sign * 0.25, b.apronSecond.min, b.apronSecond.max),
    },
  };
}

export function buildScenarioBand(player: AnalyticsPlayer, assumptions: Assumptions): ScenarioBand {
  const bear = valuate(player, shiftAssumptions(assumptions, -1));
  const base = valuate(player, assumptions);
  const bull = valuate(player, shiftAssumptions(assumptions, 1));
  return { bear, base, bull, verdictFlips: classifyTier(bear) !== classifyTier(bull) };
}

/* ============================================================
 * 3. Contract verdict.
 * ============================================================ */

/**
 * Internal verdict builder. The public buildContractVerdict has no history
 * param (per the contract), so the aging PROXY there uses exposure + current
 * production only. buildPlayerMemo routes history through here so the memo's
 * aging read also reflects the impact trend.
 */
function buildVerdict(
  player: AnalyticsPlayer,
  valuation: Valuation,
  ctx: LeagueContext | undefined,
  history: SeasonStat[] | undefined,
): ContractVerdict {
  const tier = classifyTier(valuation);
  const pct = surplusPct(valuation);
  const agingRisk = classifyAgingRisk(player, valuation, history);
  const commitmentRisk = classifyCommitmentRisk(player);
  const tradeLiquidity = classifyLiquidity(player, valuation);

  const rank = ctx?.rankBySurplus.get(player.slug);
  const total = ctx?.trackedCount;
  const pctStr = `${valuation.aasv >= 0 ? "+" : "−"}${Math.abs(Math.round(pct * 100))}%`;

  // Headline varies by tier and, for bargains, by where it ranks among tracked deals.
  let headline: string;
  if (tier === "bargain") {
    headline =
      rank != null && total != null && rank <= 5
        ? `Top-${rank} surplus deal of ${total} tracked contracts`
        : `Clear bargain — ${fmtSignedMillions(valuation.aasv)} of surplus`;
  } else if (tier === "fair") {
    headline = `Priced about right — ${fmtSignedMillions(valuation.aasv)} against true cost`;
  } else if (tier === "premium") {
    headline = `Paying a premium — ${fmtSignedMillions(valuation.aasv)} under water`;
  } else {
    headline = `Albatross risk — ${fmtSignedMillions(valuation.aasv)} on ${fmtMillions(player.totalRemaining)} still owed`;
  }

  // Narrative: 2–4 sentences, structure varies by tier, every clause carries a figure.
  const narrative: string[] = [];
  narrative.push(
    `${player.name} projects to ${fmtWins(valuation.marginalWins)} marginal wins — ${fmtMillions(
      valuation.productionValue,
    )} of on-court value — against an apron-adjusted true cost of ${fmtMillions(valuation.trueCost)}.`,
  );
  if (tier === "bargain") {
    narrative.push(
      `That is ${fmtSignedMillions(valuation.aasv)} of surplus (${pctStr} over cost)${
        rank != null && total != null ? `, ${ordinal(rank)} of ${total} tracked contracts` : ""
      } — the kind of value you build around, not shop.`,
    );
  } else if (tier === "fair") {
    narrative.push(
      `The ${fmtSignedMillions(valuation.aasv)} gap (${pctStr}) is close enough to break-even that this reads as market-rate: neither a steal nor a drag.`,
    );
  } else if (tier === "premium") {
    narrative.push(
      `The team is paying ${fmtSignedMillions(valuation.aasv)} above production (${pctStr}) — defensible for a contender buying certainty, expensive for anyone counting dollars.`,
    );
  } else {
    narrative.push(
      `Production trails cost by ${fmtSignedMillions(valuation.aasv)} (${pctStr}), and ${fmtMillions(
        player.totalRemaining,
      )} over ${player.yearsRemaining} year${player.yearsRemaining === 1 ? "" : "s"} still owed turns a bad year into a structural problem.`,
    );
  }
  // Close with the risk/liquidity read when it actually adds information.
  if (agingRisk === "elevated" || agingRisk === "severe") {
    narrative.push(
      `Forward risk is ${RISK_LABELS[agingRisk].toLowerCase()}: the money runs ${player.yearsRemaining} more year${
        player.yearsRemaining === 1 ? "" : "s"
      } and the impact signal is not trending up.`,
    );
  } else if (tradeLiquidity === "positive-asset") {
    narrative.push(`On the trade market this is a positive asset — a chip that returns value, not one you dump.`);
  } else if (tradeLiquidity === "immovable") {
    narrative.push(`Second-apron rigidity makes it functionally immovable without attaching real sweetener.`);
  }

  return {
    tier,
    headline,
    surplusPerYear: valuation.aasv,
    surplusPct: pct,
    agingRisk,
    commitmentRisk,
    tradeLiquidity,
    narrative,
  };
}

export function buildContractVerdict(
  player: AnalyticsPlayer,
  valuation: Valuation,
  _assumptions: Assumptions,
  ctx?: LeagueContext,
): ContractVerdict {
  // _assumptions is part of the contract signature; the valuation passed in
  // already embeds them, so we don't re-derive here.
  return buildVerdict(player, valuation, ctx, undefined);
}

/* ============================================================
 * 4. Player memo.
 * ============================================================ */

/** Nearest tracked players by cap-hit and impact similarity (proxy for "same archetype = similar money band"). */
function buildComparables(
  player: AnalyticsPlayer,
  valuation: Valuation,
  allPlayers: AnalyticsPlayer[],
  assumptions: Assumptions,
): ComparablePlayer[] {
  const others = allPlayers.filter((p) => p.slug !== player.slug);
  if (others.length === 0) return [];
  const caps = allPlayers.map((p) => p.capHit);
  const capSpread = Math.max(...caps) - Math.min(...caps) || 1;
  const impacts = allPlayers.map((p) => valuate(p, assumptions).impact);
  const impSpread = Math.max(...impacts) - Math.min(...impacts) || 1;

  const scored = others
    .map((o) => {
      const ov = valuate(o, assumptions);
      const capN = Math.abs(o.capHit - player.capHit) / capSpread;
      const impN = Math.abs(ov.impact - valuation.impact) / impSpread;
      // Cap-band similarity leads (the "archetype" proxy), impact refines the tie-break.
      return { o, ov, dist: 0.6 * capN + 0.4 * impN };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);

  return scored.map(({ o, ov }) => ({
    slug: o.slug,
    name: o.name,
    team: o.team,
    aasv: ov.aasv,
    reason: `Similar money band (${fmtMillions(o.capHit)} vs ${fmtMillions(player.capHit)}) and impact (${ov.impact.toFixed(
      1,
    )} vs ${valuation.impact.toFixed(1)}); his deal grades ${VERDICT_LABELS[classifyTier(ov)].toLowerCase()} at ${fmtSignedMillions(
      ov.aasv,
    )}.`,
  }));
}

/** Grounded risk factors for the memo. */
function buildRiskFactors(
  player: AnalyticsPlayer,
  valuation: Valuation,
  agingRisk: RiskLevel,
  commitmentRisk: RiskLevel,
  history?: SeasonStat[],
): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const trend = impactTrend(history);

  factors.push({
    label: "Aging / decline (proxy)",
    level: agingRisk,
    note:
      trend != null
        ? `Impact has moved ${trend >= 0 ? "+" : ""}${trend.toFixed(1)} across tracked seasons; ${fmtMillions(
            player.totalRemaining,
          )} runs ${player.yearsRemaining} more year${player.yearsRemaining === 1 ? "" : "s"}. No ages in the data — this is a trend/exposure proxy.`
        : `${fmtMillions(player.totalRemaining)} committed over ${player.yearsRemaining} year${
            player.yearsRemaining === 1 ? "" : "s"
          } with no multi-season impact trend on file. No ages in the data — this is an exposure proxy.`,
  });

  factors.push({
    label: "Commitment size",
    level: commitmentRisk,
    note: `${fmtMillions(player.totalRemaining)} still owed across ${player.yearsRemaining} year${
      player.yearsRemaining === 1 ? "" : "s"
    } — ${fmtMillions(player.capHit)} on this season's books.`,
  });

  const apronLevel: RiskLevel = player.apronStatus === "second" ? "severe" : player.apronStatus === "first" ? "elevated" : "low";
  factors.push({
    label: "Apron exposure",
    level: apronLevel,
    note:
      player.apronStatus === "below"
        ? `Below the apron — the ${fmtMillions(player.capHit)} cap hit and true cost are one and the same.`
        : `${player.apronStatus === "second" ? "Second" : "First"}-apron tax lifts the true cost to ${fmtMillions(
            valuation.trueCost,
          )} (+${fmtMillions(valuation.trueCost - player.capHit)} over cap).`,
  });

  // Availability: games are in the data (~82-game season); thin samples are a real risk flag.
  if (player.games > 0 && player.games < 50) {
    factors.push({
      label: "Availability",
      level: player.games < 30 ? "severe" : "elevated",
      note: `Only ${player.games} games / ${Math.round(player.minutes)} minutes logged in ${player.season} — the valuation rests on a thin sample.`,
    });
  } else if (player.games === 0) {
    factors.push({
      label: "Availability",
      level: "severe",
      note: `No games logged in ${player.season}; production value defaults to zero until a stat sample exists.`,
    });
  }

  return factors;
}

/** Recommendation heuristics — action + a rationale that cites the figures behind it. */
function buildRecommendation(
  player: AnalyticsPlayer,
  valuation: Valuation,
  verdict: ContractVerdict,
  sensitivity: ScenarioBand,
  medianCap: number,
): { action: MemoAction; rationale: string } {
  const a = valuation.aasv;
  const yr = player.yearsRemaining;
  const risingOrElevated = verdict.agingRisk === "elevated" || verdict.agingRisk === "severe";

  let action: MemoAction;
  let rationale: string;

  if (a > 5_000_000 && risingOrElevated) {
    // Value has peaked while forward risk climbs — cash the chip in.
    action = "trade-now";
    rationale = `Still worth ${fmtSignedMillions(a)} of surplus today, but ${RISK_LABELS[
      verdict.agingRisk
    ].toLowerCase()} forward risk on ${fmtMillions(player.totalRemaining)} argues for selling into strength rather than riding the decline.`;
  } else if (a > 0 && yr <= 2 && player.capHit <= medianCap) {
    // Cheap, productive, and about to hit free agency — extend before the market resets it.
    action = "extend";
    rationale = `${fmtMillions(player.capHit)} for ${fmtSignedMillions(a)} of surplus with only ${yr} year${
      yr === 1 ? "" : "s"
    } of control left — extend early to lock the production below what the open market would charge.`;
  } else if (a >= 8_000_000 && yr >= 3) {
    // Big surplus on long control — the definition of a keeper.
    action = "hold";
    rationale = `${fmtSignedMillions(a)} of surplus on ${yr} years of control is a core-building asset; there is no version of this roster that gets better by moving it.`;
  } else if (a <= LIQ.sweetenerBelow && verdict.tradeLiquidity !== "immovable") {
    // Negative, but you can still get out — start quietly.
    action = "shop";
    rationale = `At ${fmtSignedMillions(a)} under water the deal drags the books; it still grades "${verdict.tradeLiquidity}", so quietly canvassing the market beats waiting for it to worsen.`;
  } else if (sensitivity.verdictFlips || verdict.tier === "fair" || verdict.tradeLiquidity === "immovable") {
    // Assumption-sensitive or stuck — watch, don't act.
    action = "monitor";
    rationale = sensitivity.verdictFlips
      ? `The verdict swings from ${fmtSignedMillions(sensitivity.bear.aasv)} (bear) to ${fmtSignedMillions(
          sensitivity.bull.aasv,
        )} (bull) — too assumption-sensitive to move on; let another season of data settle the call.`
      : `${fmtSignedMillions(a)} sits close enough to fair (or too rigid to move) that the right play is patience, not a transaction.`;
  } else if (a > 0) {
    action = "hold";
    rationale = `${fmtSignedMillions(a)} of positive surplus with no pressing risk flag — keep it and revisit at the next assumption checkpoint.`;
  } else {
    action = "monitor";
    rationale = `${fmtSignedMillions(a)} of negative surplus, but not yet movable value — track the impact trend before committing to a direction.`;
  }

  return { action, rationale };
}

export function buildPlayerMemo(
  player: AnalyticsPlayer,
  allPlayers: AnalyticsPlayer[],
  assumptions: Assumptions,
  history?: SeasonStat[],
): PlayerMemo {
  const valuation = valuate(player, assumptions);
  const ctx = buildLeagueContext(allPlayers, assumptions);
  const verdict = buildVerdict(player, valuation, ctx, history);
  const sensitivity = buildScenarioBand(player, assumptions);
  const medianCap = median(allPlayers.map((p) => p.capHit));

  const rank = ctx.rankBySurplus.get(player.slug);
  const metric = valuation.metricUsed ?? "impact";

  // Thesis: what the dollars actually buy.
  const thesis = `For ${fmtMillions(player.capHit)} this season (${player.yearsRemaining} yr, ${fmtMillions(
    player.totalRemaining,
  )} total), you are buying ${fmtWins(valuation.marginalWins)} marginal wins of ${metric} production — ${fmtMillions(
    valuation.productionValue,
  )} of value at ${fmtMillions(assumptions.dollarsPerWin)}/win. Against an apron-adjusted true cost of ${fmtMillions(
    valuation.trueCost,
  )}, that nets ${fmtSignedMillions(valuation.aasv)} of surplus${
    rank != null ? `, ${ordinal(rank)} of ${ctx.trackedCount} tracked contracts` : ""
  } — it grades as ${TIER_PHRASE[verdict.tier]}.`;

  const upsideCase = `If wins price up toward ${fmtMillions(
    sensitivity.bull.productionValue / Math.max(sensitivity.bull.marginalWins, 0.0001),
  )}/win and the apron tax eases, production value climbs to ${fmtMillions(
    sensitivity.bull.productionValue,
  )} and surplus swings to ${fmtSignedMillions(sensitivity.bull.aasv)} — ${
    TIER_PHRASE[classifyTier(sensitivity.bull)]
  } in the optimistic case.`;

  const downsideCase = `If a marginal win is worth less and the apron bites harder, true cost rises to ${fmtMillions(
    sensitivity.bear.trueCost,
  )} and surplus falls to ${fmtSignedMillions(sensitivity.bear.aasv)} — ${
    TIER_PHRASE[classifyTier(sensitivity.bear)]
  } in the pessimistic case${sensitivity.verdictFlips ? "; the verdict flips across the band" : ""}.`;

  const riskFactors = buildRiskFactors(player, valuation, verdict.agingRisk, verdict.commitmentRisk, history);
  const comparables = buildComparables(player, valuation, allPlayers, assumptions);
  const recommendation = buildRecommendation(player, valuation, verdict, sensitivity, medianCap);

  return { player, valuation, verdict, thesis, upsideCase, downsideCase, riskFactors, comparables, recommendation, sensitivity };
}

/* ============================================================
 * 5. Franchise index — seven 0–100 scores, percentile-normalized
 *    against the tracked team set.
 * ============================================================ */

function grade(score: number): IndexScore["grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function makeScore(raw: number, driver: string): IndexScore {
  const score = Math.round(clamp01to100(raw));
  return { score, grade: grade(score), driver };
}

/** Share of a team's positive surplus coming from young-and-cheap deals (yearsRemaining ≥ 4 AND capHit < tracked median). */
function youngCoreShare(r: TeamRollup, medianCap: number): number {
  const totalPos = r.contracts.reduce((s, c) => s + Math.max(0, c.valuation.aasv), 0);
  if (totalPos <= 0) return 0;
  // PROXY for rookie-scale / young cheap deals — the data has no ages, so "long control on
  // below-median money" stands in for "young and team-friendly".
  const young = r.contracts.filter((c) => c.player.yearsRemaining >= 4 && c.player.capHit < medianCap);
  return young.reduce((s, c) => s + Math.max(0, c.valuation.aasv), 0) / totalPos;
}

/** How much of a team's spend is tied up in negative-surplus money (higher = riskier). */
function negativeMoneyShare(r: TeamRollup): number {
  if (r.totalTrueCost <= 0) return 0;
  return r.contracts.reduce((s, c) => s + Math.max(0, -c.valuation.aasv), 0) / r.totalTrueCost;
}

function positiveAssetCount(r: TeamRollup): number {
  return r.contracts.filter((c) => classifyLiquidity(c.player, c.valuation) === "positive-asset").length;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- in the signature for symmetry with the other builders; the rollups passed in already carry valuations computed under these assumptions.
export function buildFranchiseIndex(rollup: TeamRollup, allRollups: TeamRollup[], _assumptions: Assumptions): FranchiseIndex {
  const n = allRollups.length;
  const allPlayers = allRollups.flatMap((r) => r.contracts.map((c) => c.player));
  const medianCap = median(allPlayers.map((p) => p.capHit));

  // Comparison arrays across the tracked team set.
  const prodArr = allRollups.map((r) => r.totalProduction);
  const aasvArr = allRollups.map((r) => r.totalAasv);
  const capArr = allRollups.map((r) => r.totalCap);
  const ycShareArr = allRollups.map((r) => youngCoreShare(r, medianCap));
  const negShareArr = allRollups.map((r) => negativeMoneyShare(r));
  const posAssetArr = allRollups.map((r) => positiveAssetCount(r));

  // rosterQuality = production percentile.
  const rqPct = percentileRank(rollup.totalProduction, prodArr);
  const rosterQuality = makeScore(
    rqPct,
    `${fmtMillions(rollup.totalProduction)} of tracked production ranks ${ordinal(rankDesc(rollup.totalProduction, prodArr))} of ${n} tracked teams.`,
  );

  // capFlexibility = inverse of (committed money + apron rigidity).
  const committedPct = percentileRank(rollup.totalCap, capArr);
  const apronPenalty = (APRON_NUM[rollup.apronStatus] / 2) * 100; // 0 / 50 / 100
  const capFlexRaw = 100 - (0.5 * committedPct + 0.5 * apronPenalty);
  const capFlexibility = makeScore(
    capFlexRaw,
    `${fmtMillions(rollup.totalCap)} committed at the ${rollup.apronStatus}-apron tier — ${
      rollup.apronStatus === "below" ? "room to operate" : rollup.apronStatus === "first" ? "limited tools" : "hard-capped and rigid"
    }.`,
  );

  // assetBase = total AASV percentile.
  const abPct = percentileRank(rollup.totalAasv, aasvArr);
  const assetBase = makeScore(
    abPct,
    `${fmtSignedMillions(rollup.totalAasv)} of aggregate surplus ranks ${ordinal(rankDesc(rollup.totalAasv, aasvArr))} of ${n} tracked teams.`,
  );

  // youngCore = percentile of young-cheap surplus share.
  const ycShare = youngCoreShare(rollup, medianCap);
  const ycPct = percentileRank(ycShare, ycShareArr);
  const youngCore = makeScore(
    ycPct,
    ycShare > 0
      ? `${Math.round(ycShare * 100)}% of the team's surplus comes from long-control, below-median-money deals (a young-core proxy).`
      : `No surplus is coming from long-control, below-median-money deals — no young-core engine on the tracked books.`,
  );

  // championshipWindow = win-now firepower (rosterQuality) blended with the surplus to keep improving.
  const cwRaw = 0.6 * rqPct + 0.4 * abPct;
  const championshipWindow = makeScore(
    cwRaw,
    `Blend of ${Math.round(rqPct)}th-pct production now and ${Math.round(abPct)}th-pct surplus to build on.`,
  );

  // downsideRisk (higher = safer) = inverse of negative-money concentration.
  const negPct = percentileRank(negativeMoneyShare(rollup), negShareArr);
  const downsideRisk = makeScore(
    100 - negPct,
    `${Math.round(negativeMoneyShare(rollup) * 100)}% of spend sits in negative-surplus money (${
      negPct >= 60 ? "heavy" : negPct >= 35 ? "moderate" : "light"
    } concentration).`,
  );

  // optionality = cap flexibility blended with count of genuinely tradable positive assets.
  const posPct = percentileRank(positiveAssetCount(rollup), posAssetArr);
  const optRaw = 0.5 * clamp01to100(capFlexRaw) + 0.5 * posPct;
  const optionality = makeScore(
    optRaw,
    `${positiveAssetCount(rollup)} positive-asset contract${positiveAssetCount(rollup) === 1 ? "" : "s"} plus ${
      rollup.apronStatus === "below" ? "open" : "constrained"
    } cap sheet.`,
  );

  // overall = weighted mean. Weights favor real on-court value and surplus, then flexibility.
  const overallRaw =
    0.22 * rosterQuality.score +
    0.2 * assetBase.score +
    0.15 * capFlexibility.score +
    0.15 * championshipWindow.score +
    0.12 * downsideRisk.score +
    0.1 * optionality.score +
    0.06 * youngCore.score;
  // Driver names the single strongest sub-score.
  const subs: Array<[string, number]> = [
    ["roster quality", rosterQuality.score],
    ["asset base", assetBase.score],
    ["cap flexibility", capFlexibility.score],
    ["championship window", championshipWindow.score],
    ["downside safety", downsideRisk.score],
    ["optionality", optionality.score],
    ["young core", youngCore.score],
  ];
  const topSub = subs.reduce((a, b) => (b[1] > a[1] ? b : a));
  const overall = makeScore(overallRaw, `Weighted profile led by ${topSub[0]} (${topSub[1]}/100).`);

  return { rosterQuality, capFlexibility, assetBase, youngCore, championshipWindow, downsideRisk, optionality, overall };
}

/* ============================================================
 * 6. Team GM brief.
 * ============================================================ */

function classifyWindow(rollup: TeamRollup, allRollups: TeamRollup[]): WindowState {
  const prodPct = percentileRank(
    rollup.totalProduction,
    allRollups.map((r) => r.totalProduction),
  );
  if (prodPct < 35) return "rebuilding"; // little tracked production → building from below
  if (prodPct < 60) return "retooling"; // middle of the pack → reshaping around a core
  // High production: surplus decides whether the window is open (contending) or expensively closing.
  return rollup.totalAasv > 0 ? "contending" : "win-now";
}

export function buildTeamBrief(
  rollup: TeamRollup,
  allRollups: TeamRollup[],
  assumptions: Assumptions,
  _allPlayers: AnalyticsPlayer[],
): TeamBrief {
  const index = buildFranchiseIndex(rollup, allRollups, assumptions);
  const window = classifyWindow(rollup, allRollups);
  const n = allRollups.length;
  const prodRank = rankDesc(
    rollup.totalProduction,
    allRollups.map((r) => r.totalProduction),
  );
  const aasvRank = rankDesc(
    rollup.totalAasv,
    allRollups.map((r) => r.totalAasv),
  );

  // Best asset / worst liability come straight off the roll-up's sorted contracts.
  const best: TeamContract | null = rollup.bestContract;
  const worst: TeamContract | null = rollup.worstContract;

  const bestAsset =
    best != null
      ? {
          player: best.player,
          comment: `${best.player.name} is the surplus engine: ${fmtSignedMillions(best.valuation.aasv)} on ${fmtMillions(
            best.player.capHit,
          )}, ${fmtWins(best.valuation.marginalWins)} marginal wins of production.`,
        }
      : null;

  const worstLiability =
    worst != null && worst.valuation.aasv < 0
      ? {
          player: worst.player,
          comment: `${worst.player.name} is the drag: ${fmtSignedMillions(worst.valuation.aasv)} under water on ${fmtMillions(
            worst.player.totalRemaining,
          )} still owed over ${worst.player.yearsRemaining} year${worst.player.yearsRemaining === 1 ? "" : "s"}.`,
        }
      : null;

  // Apron risk from the majority tier plus the raw tax premium the tier imposes.
  const taxPremium = rollup.totalTrueCost - rollup.totalCap;
  const apronLevel: RiskLevel =
    rollup.apronStatus === "second" ? "severe" : rollup.apronStatus === "first" ? "elevated" : "low";
  const apronRisk = {
    level: apronLevel,
    note:
      rollup.apronStatus === "below"
        ? `Majority of tracked salary sits below the apron — no penalty multiplier, ${fmtMillions(rollup.totalCap)} of clean cap.`
        : `${rollup.apronStatus === "second" ? "Second" : "First"}-apron majority lifts ${fmtMillions(
            rollup.totalCap,
          )} of cap into ${fmtMillions(rollup.totalTrueCost)} of true cost — a ${fmtMillions(taxPremium)} tax premium and the roster tools that come with it.`,
  };

  // Next decision: scan for the single most consequential item.
  const strongYoungCheap = rollup.contracts
    .filter((c) => c.player.yearsRemaining <= 2 && c.valuation.aasv > 0 && c.player.capHit <= median(_allPlayers.map((p) => p.capHit)))
    .sort((a, b) => b.valuation.aasv - a.valuation.aasv)[0];

  let nextDecision: { title: string; body: string };
  if (worst != null && worst.valuation.aasv <= -12_000_000) {
    nextDecision = {
      title: `Move off ${worst.player.name}'s money`,
      body: `${worst.player.name} carries ${fmtSignedMillions(worst.valuation.aasv)} of negative surplus on ${fmtMillions(
        worst.player.totalRemaining,
      )} across ${worst.player.yearsRemaining} year${worst.player.yearsRemaining === 1 ? "" : "s"}. It grades "${classifyLiquidity(
        worst.player,
        worst.valuation,
      )}" — the front office's biggest lever is finding the exit before the term shortens the buyer pool further.`,
    };
  } else if (strongYoungCheap != null) {
    nextDecision = {
      title: `Extend ${strongYoungCheap.player.name} early`,
      body: `${strongYoungCheap.player.name} returns ${fmtSignedMillions(strongYoungCheap.valuation.aasv)} of surplus on ${fmtMillions(
        strongYoungCheap.player.capHit,
      )} with only ${strongYoungCheap.player.yearsRemaining} year${
        strongYoungCheap.player.yearsRemaining === 1 ? "" : "s"
      } of control. Locking that production in ahead of the market is the highest-leverage move on the board.`,
    };
  } else if (rollup.apronStatus === "second") {
    nextDecision = {
      title: `Trim under the second apron`,
      body: `The tracked books already push into the second apron, turning ${fmtMillions(rollup.totalCap)} of cap into ${fmtMillions(
        rollup.totalTrueCost,
      )} of true cost. The next decision is which contract to shed to restore roster-building tools before the tax compounds.`,
    };
  } else if (best != null) {
    nextDecision = {
      title: `Build around ${best.player.name}`,
      body: `With ${fmtSignedMillions(best.valuation.aasv)} of surplus from ${best.player.name} and ${fmtSignedMillions(
        rollup.totalAasv,
      )} team-wide, the live question is how to convert flexibility into a second star while the surplus window is open.`,
    };
  } else {
    nextDecision = {
      title: `Establish a core`,
      body: `No tracked contract yet anchors the roster; the front office's next decision is acquiring the surplus asset to build around.`,
    };
  }

  // Strategic warning: the single biggest tail risk, in one sentence.
  let strategicWarning: string;
  if (worst != null && worst.valuation.aasv <= -15_000_000) {
    strategicWarning = `Concentration risk: ${worst.player.name}'s ${fmtSignedMillions(
      worst.valuation.aasv,
    )} deal can swallow the flexibility the rest of the sheet creates.`;
  } else if (rollup.apronStatus === "second") {
    strategicWarning = `Second-apron rigidity is the tail risk — one injury to a key contract leaves almost no legal path to replace the production.`;
  } else if (index.downsideRisk.score < 40) {
    strategicWarning = `Too much spend rides on negative-surplus money (${index.downsideRisk.score}/100 downside safety); a soft season turns the cap sheet upside down.`;
  } else if (window === "win-now") {
    strategicWarning = `The window is expensive and closing: high production but ${fmtSignedMillions(
      rollup.totalAasv,
    )} of surplus means every season delayed costs real value.`;
  } else {
    strategicWarning = `Biggest tail risk is stagnation — a ${index.overall.grade}-grade profile that doesn't add a difference-maker while the surplus holds.`;
  }

  // Thesis ties the totals, window, and index grade together.
  const thesis = `${rollup.team} carries ${fmtMillions(rollup.totalProduction)} of tracked production (${ordinal(
    prodRank,
  )} of ${n}) against ${fmtMillions(rollup.totalTrueCost)} of true cost, netting ${fmtSignedMillions(
    rollup.totalAasv,
  )} of surplus (${ordinal(aasvRank)} of ${n}). That profile reads ${window}: an overall ${index.overall.grade}-grade roster (${index.overall.score}/100) whose defining trait is ${index.overall.driver
    .replace(/^Weighted profile led by /, "")
    .replace(/\.$/, "")}.`;

  return { rollup, thesis, window, index, bestAsset, worstLiability, apronRisk, nextDecision, strategicWarning };
}

/* ============================================================
 * 7. Trade analysis — the apron era's defining trick.
 *
 * The same contract has a DIFFERENT true cost on different teams, because
 * the apron multiplier is a property of the receiving team, not the player.
 * Production, by contrast, travels with the player unchanged. So when two
 * contracts swap teams, surplus can be created (or destroyed) out of nothing
 * but the apron math:
 *
 *   valueCreated = (capA − capB) × (multA − multB)
 *
 * — strictly positive when the pricier contract moves to the lower-multiplier
 * team. That asymmetry is why an apron team and a below-apron team can BOTH
 * win the same trade, and it's the mechanism this module makes visible.
 *
 * Pure and deterministic like every other builder here: it recomputes live
 * as the reader drags the apron-multiplier sliders, so "who won?" is always
 * the model's answer under the reader's assumptions.
 * ============================================================ */

/** ± surplus swing (raw dollars) at which a side reads as a clear winner or loser rather than a wash. */
const TRADE_SIDE_THRESHOLD = 4_000_000;
/** |valueCreated| under this reads as "no real repricing" — the trade is about fit, not price. */
const TRADE_EVEN_BAND = 1_000_000;
/** Straight-swap salary match within this fraction of the larger salary passes the CBA proxy. */
const SALARY_MATCH_TOLERANCE = 0.25;

function tradeSideVerdict(net: number): TradeSideVerdict {
  if (net >= TRADE_SIDE_THRESHOLD) return "wins";
  if (net <= -TRADE_SIDE_THRESHOLD) return "loses";
  return "neutral";
}

/** Build one team's side of the swap. `sends` is the departing player (whose team + tier govern this side). */
function buildTradeSide(
  sends: AnalyticsPlayer,
  receives: AnalyticsPlayer,
  assumptions: Assumptions,
): TradeSide {
  const mult = assumptions.apronMultipliers[sends.apronStatus] ?? 1;
  const outgoing = valuate(sends, assumptions); // what we give up, on our books
  const incomingProduction = valuate(receives, assumptions).productionValue; // travels with the player
  const incomingTrueCost = receives.capHit * mult; // repriced at OUR apron tier
  const incomingAasv = incomingProduction - incomingTrueCost;
  const netAasvChange = incomingAasv - outgoing.aasv;
  const verdict = tradeSideVerdict(netAasvChange);

  const note =
    verdict === "wins"
      ? `${sends.team} banks ${fmtSignedMillions(netAasvChange)} of surplus: ${receives.name} reprices to ${fmtMillions(
          incomingTrueCost,
        )} of true cost at the ${APRON_LABELS[sends.apronStatus].toLowerCase()}, cheaper value than ${sends.name} was returning.`
      : verdict === "loses"
        ? `${sends.team} gives up ${fmtSignedMillions(netAasvChange)} of surplus: ${receives.name}'s ${fmtMillions(
            incomingTrueCost,
          )} true cost at the ${APRON_LABELS[sends.apronStatus].toLowerCase()} outruns the ${fmtSignedMillions(
            outgoing.aasv,
          )} ${sends.name} provided.`
        : `${sends.team} lands close to even (${fmtSignedMillions(
            netAasvChange,
          )}): ${receives.name}'s repriced value roughly matches what ${sends.name} was worth here.`;

  return {
    team: sends.team,
    apronStatus: sends.apronStatus,
    multiplier: mult,
    sends,
    receives,
    capOut: sends.capHit,
    capIn: receives.capHit,
    capDelta: receives.capHit - sends.capHit,
    incomingTrueCost,
    outgoingAasv: outgoing.aasv,
    incomingAasv,
    netAasvChange,
    verdict,
    note,
  };
}

/**
 * Analyze a straight two-player swap between the players' current teams. Each
 * side is valued from its OWN team's apron tier, which is where the repricing
 * — and the possibility of both sides winning — comes from.
 */
export function buildTradeAnalysis(
  playerA: AnalyticsPlayer,
  playerB: AnalyticsPlayer,
  assumptions: Assumptions,
): TradeAnalysis {
  const a = buildTradeSide(playerA, playerB, assumptions);
  const b = buildTradeSide(playerB, playerA, assumptions);

  // Leaguewide creation = the sum of both sides' swings (production cancels).
  const valueCreated = a.netAasvChange + b.netAasvChange;
  const mutualGain = a.netAasvChange > 0 && b.netAasvChange > 0;
  const sameTeam = playerA.team === playerB.team;

  // Headline.
  let headline: string;
  if (sameTeam) {
    headline = "Same-team swap — no apron repricing to capture";
  } else if (mutualGain) {
    headline = `Both win — ${fmtSignedMillions(valueCreated)} of surplus created by the apron gap`;
  } else if (valueCreated > TRADE_EVEN_BAND) {
    headline = `${fmtSignedMillions(valueCreated)} of value created in transit`;
  } else if (valueCreated < -TRADE_EVEN_BAND) {
    headline = `${fmtSignedMillions(valueCreated)} of value destroyed — the money moves the wrong way`;
  } else {
    headline = "A wash on price — this trade is about fit, not the cap";
  }

  // Narrative.
  const narrative: string[] = [];
  if (sameTeam) {
    narrative.push(
      `${playerA.name} and ${playerB.name} are both on ${playerA.team}, so no apron repricing happens — swapping them changes nothing about either contract's true cost.`,
    );
  } else if (a.apronStatus === b.apronStatus) {
    narrative.push(
      `Both teams sit at the ${APRON_LABELS[a.apronStatus].toLowerCase()}, so each dollar is priced the same on either side — the swap creates only ${fmtSignedMillions(
        valueCreated,
      )} of value from the money itself. Whatever makes this trade worth doing is fit and talent, not the cap.`,
    );
  } else {
    const cheaper = playerA.capHit >= playerB.capHit ? playerA : playerB;
    const cheaperSide = cheaper === playerA ? a : b;
    const otherSide = cheaper === playerA ? b : a;
    narrative.push(
      `${cheaper.name}'s ${fmtMillions(cheaper.capHit)} is priced at ${cheaperSide.multiplier.toFixed(
        2,
      )}× on ${cheaperSide.team} but ${otherSide.multiplier.toFixed(2)}× on ${otherSide.team} — moving the bigger salary toward the ${
        cheaperSide.multiplier < otherSide.multiplier ? otherSide.team : cheaperSide.team
      } tier is what ${valueCreated >= 0 ? "creates" : "destroys"} ${fmtSignedMillions(valueCreated)} of surplus, before either roster plays a game.`,
    );
  }

  if (mutualGain) {
    narrative.push(
      `Under these assumptions both front offices come out ahead — ${a.team} ${fmtSignedMillions(
        a.netAasvChange,
      )}, ${b.team} ${fmtSignedMillions(
        b.netAasvChange,
      )}. That is the outcome the apron era makes possible: the same production is simply worth more on the cheaper books.`,
    );
  } else if (!sameTeam) {
    const winner = a.netAasvChange >= b.netAasvChange ? a : b;
    const loser = winner === a ? b : a;
    narrative.push(
      `On value alone ${winner.team} is the better side of the deal (${fmtSignedMillions(
        winner.netAasvChange,
      )} vs ${fmtSignedMillions(loser.netAasvChange)} for ${loser.team})${
        winner.verdict === "wins" && loser.verdict === "loses"
          ? " — a clear win-one-side trade"
          : winner.verdict === "neutral"
            ? " — though both sides land near even"
            : ""
      }.`,
    );
  }

  // Salary-matching proxy.
  const gap = Math.abs(playerA.capHit - playerB.capHit);
  const larger = Math.max(playerA.capHit, playerB.capHit, 1);
  const matches = gap / larger <= SALARY_MATCH_TOLERANCE;
  const secondApronTakingOn =
    (a.apronStatus === "second" && a.capDelta > 0) || (b.apronStatus === "second" && b.capDelta > 0);
  const legalityNote = sameTeam
    ? "Same-team swap — salary matching doesn't apply."
    : matches
      ? `Salaries are ${fmtMillions(gap)} apart (within the ~25% straight-swap tolerance), so this works as a one-for-one under standard matching rules.`
      : secondApronTakingOn
        ? `Salaries are ${fmtMillions(
            gap,
          )} apart AND a second-apron team is taking on money — the CBA bars second-apron teams from aggregating or absorbing extra salary, so in reality this needs a third team or added filler.`
        : `Salaries are ${fmtMillions(gap)} apart — a straight swap likely needs filler contracts to satisfy salary matching.`;

  const caveats =
    "Pure value only: this ignores positional fit, roster construction, draft compensation, health, and contract length. A real front office weighs all of them — the surplus math is the starting point of the conversation, not the end of it.";

  return { a, b, valueCreated, mutualGain, headline, narrative, legalityNote, caveats };
}
