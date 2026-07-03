/* ============================================================
 * Intelligence layer — the type contract.
 *
 * lib/aasv.ts answers "what is the number?"
 * lib/intelligence.ts answers "so what should a GM do?"
 *
 * This file is types ONLY (plus label/color maps that UI and engine
 * must agree on). The functions live in lib/intelligence.ts. Both are
 * pure and client-safe: the dashboards recompute verdicts live as the
 * reader drags assumption sliders, so a verdict is never a hardcoded
 * opinion — it is the model's opinion under the reader's assumptions.
 * ============================================================ */

import type { AnalyticsPlayer, Valuation } from "@/lib/aasv";
import type { TeamRollup } from "@/lib/team-aasv";

/* ---------------- contract verdicts ---------------- */

/** How the deal prices against production under current assumptions. */
export type VerdictTier = "bargain" | "fair" | "premium" | "albatross";

export const VERDICT_LABELS: Record<VerdictTier, string> = {
  bargain: "Bargain",
  fair: "Fairly priced",
  premium: "Paying a premium",
  albatross: "Albatross risk",
};

/** Verdict colors — reuse the validated apron palette semantics (white surface, ≥3:1). */
export const VERDICT_COLORS: Record<VerdictTier, string> = {
  bargain: "#158a55",
  fair: "#4a5568",
  premium: "#c07f0a",
  albatross: "#d63b3b",
};

export type RiskLevel = "low" | "moderate" | "elevated" | "severe";

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  elevated: "Elevated",
  severe: "Severe",
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#158a55",
  moderate: "#4a5568",
  elevated: "#c07f0a",
  severe: "#d63b3b",
};

/** One named risk with a level and a one-sentence explanation. */
export interface RiskFactor {
  label: string;
  level: RiskLevel;
  note: string;
}

/** How movable the contract is on the trade market. */
export type TradeLiquidity = "positive-asset" | "movable" | "needs-sweetener" | "immovable";

export const LIQUIDITY_LABELS: Record<TradeLiquidity, string> = {
  "positive-asset": "Positive asset",
  movable: "Movable",
  "needs-sweetener": "Needs a sweetener",
  immovable: "Functionally immovable",
};

export interface ContractVerdict {
  tier: VerdictTier;
  /** Short verdict headline, e.g. "Top-5 surplus deal in the league." */
  headline: string;
  /** This season's surplus (AASV), dollars. */
  surplusPerYear: number;
  /** Surplus as a share of true cost (aasv / trueCost); 0 when trueCost is 0. */
  surplusPct: number;
  /** Risk that remaining years/money age badly relative to production trend. */
  agingRisk: RiskLevel;
  /** Sheer forward exposure: years × dollars still owed. */
  commitmentRisk: RiskLevel;
  tradeLiquidity: TradeLiquidity;
  /** 2–4 memo sentences a GM could read aloud. Plain language, no jargon dumps. */
  narrative: string[];
}

/* ---------------- scenario sensitivity ---------------- */

/** The same valuation under pessimistic / current / optimistic assumptions. */
export interface ScenarioBand {
  bear: Valuation;
  base: Valuation;
  bull: Valuation;
  /** True when the verdict tier changes across the band — the call is assumption-sensitive. */
  verdictFlips: boolean;
}

/* ---------------- player investment memo ---------------- */

export type MemoAction = "extend" | "hold" | "shop" | "trade-now" | "monitor";

export const ACTION_LABELS: Record<MemoAction, string> = {
  extend: "Extend early",
  hold: "Hold",
  shop: "Quietly shop",
  "trade-now": "Trade now",
  monitor: "Monitor",
};

export interface ComparablePlayer {
  slug: string;
  name: string;
  team: string;
  /** Why this comp is instructive, one sentence. */
  reason: string;
  aasv: number;
}

export interface PlayerMemo {
  player: AnalyticsPlayer;
  valuation: Valuation;
  verdict: ContractVerdict;
  /** One-paragraph value thesis: what you are actually buying. */
  thesis: string;
  upsideCase: string;
  downsideCase: string;
  riskFactors: RiskFactor[];
  comparables: ComparablePlayer[];
  recommendation: { action: MemoAction; rationale: string };
  sensitivity: ScenarioBand;
}

/* ---------------- franchise strategy index ---------------- */

export interface IndexScore {
  /** 0–100. */
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  /** One sentence on what drives the score. */
  driver: string;
}

export interface FranchiseIndex {
  rosterQuality: IndexScore;
  capFlexibility: IndexScore;
  assetBase: IndexScore;
  youngCore: IndexScore;
  championshipWindow: IndexScore;
  downsideRisk: IndexScore; // higher score = LESS downside risk
  optionality: IndexScore;
  overall: IndexScore;
}

export type WindowState = "contending" | "win-now" | "retooling" | "rebuilding";

export const WINDOW_LABELS: Record<WindowState, string> = {
  contending: "Contending",
  "win-now": "Win-now, closing",
  retooling: "Retooling",
  rebuilding: "Rebuilding",
};

/* ---------------- team GM brief ---------------- */

export interface TeamBrief {
  rollup: TeamRollup;
  /** One-paragraph roster thesis. */
  thesis: string;
  window: WindowState;
  index: FranchiseIndex;
  bestAsset: { player: AnalyticsPlayer; comment: string } | null;
  worstLiability: { player: AnalyticsPlayer; comment: string } | null;
  /** Apron/second-apron exposure in plain language. */
  apronRisk: { level: RiskLevel; note: string };
  /** The single next decision this front office actually faces. */
  nextDecision: { title: string; body: string };
  strategicWarning: string;
}

/* ---------------- league-wide context ---------------- */

/** Percentile context so verdicts can say "top-5 tracked deal" honestly. */
export interface LeagueContext {
  /** Players ranked by AASV desc under the SAME assumptions the verdict uses. */
  rankBySurplus: Map<string, number>; // slug -> 1-based rank
  trackedCount: number;
  medianAasv: number;
}
