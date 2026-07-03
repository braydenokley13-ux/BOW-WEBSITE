/* ============================================================
 * AASV — Apron-Adjusted Surplus Value.
 *
 * The thesis: a player's roster value is the gap between what he
 * produces and what he TRULY costs — and under the current CBA the
 * true cost of a dollar depends on where the team sits against the
 * tax aprons. AASV prices that in:
 *
 *   production value = marginal wins × $/win
 *   true cost        = cap hit × apron multiplier
 *   AASV             = production value − true cost
 *
 * Every assumption is a user-controlled knob (see Assumptions /
 * ASSUMPTION_BOUNDS) so the model reflects the reader's judgment,
 * not hardcoded defaults. Pure math, no I/O — shared by server
 * rendering (article embeds) and the client dashboard (live sliders).
 * ============================================================ */

export type ApronStatus = "below" | "first" | "second";

export const APRON_LABELS: Record<ApronStatus, string> = {
  below: "Below apron",
  first: "First apron",
  second: "Second apron",
};

/** Chart/badge colors per apron tier — validated palette (dataviz six checks, white surface). */
export const APRON_COLORS: Record<ApronStatus, string> = {
  below: "#158a55", // --bow-positive
  first: "#c07f0a", // darkened --bow-warning step (≥3:1 on white for chart marks)
  second: "#d63b3b", // --bow-negative
};

export interface Assumptions {
  /** Open-market price of one marginal win, in dollars. */
  dollarsPerWin: number;
  /** True-cost multiplier applied to cap hit, by team apron tier. */
  apronMultipliers: Record<ApronStatus, number>;
  /** Replacement-level impact (per 100 possessions). Production is measured above this. */
  replacementLevel: number;
  /** Net points that buy one marginal win over a season. */
  pointsPerWin: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  dollarsPerWin: 3_500_000,
  apronMultipliers: { below: 1.0, first: 1.5, second: 2.0 },
  replacementLevel: -2.0,
  pointsPerWin: 30.5,
};

/** Slider ranges for every assumption the model exposes. */
export const ASSUMPTION_BOUNDS = {
  dollarsPerWin: { min: 2_000_000, max: 5_000_000, step: 100_000 },
  apronBelow: { min: 0.8, max: 1.5, step: 0.05 },
  apronFirst: { min: 1.0, max: 2.5, step: 0.05 },
  apronSecond: { min: 1.0, max: 3.0, step: 0.05 },
  replacementLevel: { min: -4.0, max: 0.0, step: 0.1 },
  pointsPerWin: { min: 25, max: 35, step: 0.5 },
} as const;

/** League pace baseline: ~100 possessions per 48 minutes → per-minute rate. */
export const POSSESSIONS_PER_MINUTE = 100 / 48;

/** One curated player as read from the database (dollars raw, not millions). */
export interface AnalyticsPlayer {
  slug: string;
  name: string;
  team: string;
  capHit: number;
  yearsRemaining: number;
  totalRemaining: number;
  apronStatus: ApronStatus;
  season: string;
  games: number;
  minutes: number;
  epm: number | null;
  bpm: number | null;
  /** Where the stat row came from: 'nba_api' (live ingest) or 'snapshot' (seed CSV). */
  statSource: string;
}

/** The full transparent calculation for one player — every intermediate step. */
export interface Valuation {
  /** Advanced impact metric actually used (EPM preferred, BPM fallback). */
  impact: number;
  metricUsed: "EPM" | "BPM" | null;
  possessions: number;
  impactAboveReplacement: number;
  netPointsAdded: number;
  marginalWins: number;
  productionValue: number;
  apronMultiplier: number;
  trueCost: number;
  aasv: number;
}

export function valuate(p: AnalyticsPlayer, a: Assumptions = DEFAULT_ASSUMPTIONS): Valuation {
  const metricUsed = p.epm != null ? "EPM" : p.bpm != null ? "BPM" : null;
  const impact = p.epm ?? p.bpm ?? 0;
  const possessions = p.minutes * POSSESSIONS_PER_MINUTE;
  // A player who didn't play produced nothing — never negative production
  // from the replacement adjustment alone.
  const impactAboveReplacement = metricUsed == null ? 0 : impact - a.replacementLevel;
  const netPointsAdded = (impactAboveReplacement * possessions) / 100;
  const marginalWins = a.pointsPerWin > 0 ? netPointsAdded / a.pointsPerWin : 0;
  const productionValue = marginalWins * a.dollarsPerWin;
  const apronMultiplier = a.apronMultipliers[p.apronStatus] ?? 1;
  const trueCost = p.capHit * apronMultiplier;
  return {
    impact,
    metricUsed,
    possessions,
    impactAboveReplacement,
    netPointsAdded,
    marginalWins,
    productionValue,
    apronMultiplier,
    trueCost,
    aasv: productionValue - trueCost,
  };
}

/* ---------------- formatting helpers (shared by table/chart/embeds) ---------------- */

/** "$53.1M" — dollars → compact millions. */
export function fmtMillions(dollars: number): string {
  const m = dollars / 1e6;
  const abs = Math.abs(m);
  const digits = abs >= 100 ? 0 : 1;
  return `${m < 0 ? "−" : ""}$${abs.toFixed(digits)}M`;
}

/** "+$12.4M" / "−$8.2M" — signed surplus formatting. */
export function fmtSignedMillions(dollars: number): string {
  return `${dollars >= 0 ? "+" : ""}${fmtMillions(dollars)}`.replace("+−", "−");
}

export function fmtWins(w: number): string {
  return w.toFixed(1);
}

/** Merge a partial (e.g. from sessionStorage) onto defaults, clamped to bounds. */
export function normalizeAssumptions(raw: unknown): Assumptions {
  const d = DEFAULT_ASSUMPTIONS;
  if (!raw || typeof raw !== "object") return { ...d, apronMultipliers: { ...d.apronMultipliers } };
  const r = raw as Partial<Assumptions> & { apronMultipliers?: Partial<Record<ApronStatus, number>> };
  const clamp = (v: unknown, min: number, max: number, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
  };
  const b = ASSUMPTION_BOUNDS;
  return {
    dollarsPerWin: clamp(r.dollarsPerWin, b.dollarsPerWin.min, b.dollarsPerWin.max, d.dollarsPerWin),
    apronMultipliers: {
      below: clamp(r.apronMultipliers?.below, b.apronBelow.min, b.apronBelow.max, d.apronMultipliers.below),
      first: clamp(r.apronMultipliers?.first, b.apronFirst.min, b.apronFirst.max, d.apronMultipliers.first),
      second: clamp(r.apronMultipliers?.second, b.apronSecond.min, b.apronSecond.max, d.apronMultipliers.second),
    },
    replacementLevel: clamp(r.replacementLevel, b.replacementLevel.min, b.replacementLevel.max, d.replacementLevel),
    pointsPerWin: clamp(r.pointsPerWin, b.pointsPerWin.min, b.pointsPerWin.max, d.pointsPerWin),
  };
}
