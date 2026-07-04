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

import type { AnalyticsPlayer, ApronStatus, Valuation } from "@/lib/aasv";
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

/* ---------------- trade analysis ---------------- */

/**
 * Whether a side comes out ahead in PURE apron-adjusted value. This is a
 * value-only read — it deliberately ignores fit, positional need, draft
 * compensation, health, and roster construction (see TradeAnalysis.caveats).
 */
export type TradeSideVerdict = "wins" | "neutral" | "loses";

export const TRADE_SIDE_LABELS: Record<TradeSideVerdict, string> = {
  wins: "Gains value",
  neutral: "Roughly even",
  loses: "Loses value",
};

export const TRADE_SIDE_COLORS: Record<TradeSideVerdict, string> = {
  wins: "#158a55", // --bow-positive
  neutral: "#4a5568", // --bow-slate
  loses: "#d63b3b", // --bow-negative
};

/** One team's side of a two-player swap, valued from THAT team's apron tier. */
export interface TradeSide {
  /** Receiving team abbreviation (the team this side belongs to). */
  team: string;
  /** That team's tracked apron tier — this is the multiplier it pays on the incoming deal. */
  apronStatus: ApronStatus;
  multiplier: number;
  /** The player this team gives up. */
  sends: AnalyticsPlayer;
  /** The player this team takes on. */
  receives: AnalyticsPlayer;
  capOut: number;
  capIn: number;
  /** capIn − capOut; positive means the team is taking on salary. */
  capDelta: number;
  /** True cost of the incoming contract once repriced at THIS team's apron tier. */
  incomingTrueCost: number;
  /** Surplus the departing player was providing this team (his AASV here). */
  outgoingAasv: number;
  /** Surplus the arriving player provides this team, repriced at this tier. */
  incomingAasv: number;
  /** incomingAasv − outgoingAasv — the value swing for this front office. */
  netAasvChange: number;
  verdict: TradeSideVerdict;
  note: string;
}

export interface TradeAnalysis {
  a: TradeSide;
  b: TradeSide;
  /**
   * Leaguewide surplus created purely by repricing the two contracts across
   * apron tiers. Equals (capA − capB) × (multA − multB): production travels
   * with the player and cancels, so what's left is the apron math alone.
   */
  valueCreated: number;
  /** True when BOTH front offices gain value — the "both won" case the apron era makes possible. */
  mutualGain: boolean;
  headline: string;
  /** 2–3 memo sentences a GM could read aloud. */
  narrative: string[];
  /** Salary-matching read (a CBA-legality proxy) — informational, not a hard rule. */
  legalityNote: string;
  /** What the value-only model deliberately leaves out. */
  caveats: string;
}

/* ---------------- league-wide context ---------------- */

/** Percentile context so verdicts can say "top-5 tracked deal" honestly. */
export interface LeagueContext {
  /** Players ranked by AASV desc under the SAME assumptions the verdict uses. */
  rankBySurplus: Map<string, number>; // slug -> 1-based rank
  trackedCount: number;
  medianAasv: number;
}
