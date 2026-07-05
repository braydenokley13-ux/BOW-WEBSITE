/* ============================================================
 * Lenses — named worldviews over the AASV model.
 *
 * A lens is nothing but a complete Assumptions object with a name and
 * a philosophy, which is exactly the point: front offices don't
 * disagree about the arithmetic, they disagree about what a win costs,
 * how much the apron should scare you, and how good the tenth man
 * really is. Naming those disagreements makes them comparable — and
 * makes "the verdict is CONTESTED" a computable fact, not a take.
 *
 * Pure and client-safe: the same code ranks lens splits on the server
 * (docket generation) and recomputes contested badges live in the
 * browser. All preset values sit inside ASSUMPTION_BOUNDS so a preset
 * is always reachable by hand with the sliders.
 * ============================================================ */

import { DEFAULT_ASSUMPTIONS, valuate, type AnalyticsPlayer, type Assumptions } from "@/lib/aasv";
import { classifyTier } from "@/lib/intelligence";
import type { VerdictTier } from "@/lib/intelligence-types";
import { CUSTOM_LENS_ID, type Lens, type LensSplit } from "@/lib/research-types";

/** Tier order for measuring how far apart two verdicts are. */
const TIER_ORDER: Record<VerdictTier, number> = { bargain: 0, fair: 1, premium: 2, albatross: 3 };

export const PRESET_LENSES: Lens[] = [
  {
    id: "consensus",
    name: "The Consensus",
    philosophy: "The market's own numbers: a win costs what the middle of the league pays for it.",
    assumptions: DEFAULT_ASSUMPTIONS,
  },
  {
    id: "accountant",
    name: "The Accountant",
    philosophy: "Every apron dollar is real money — the tax ledger, not the highlight reel, decides who wins the summer.",
    assumptions: {
      dollarsPerWin: 2_800_000,
      apronMultipliers: { below: 1.0, first: 2.0, second: 2.8 },
      replacementLevel: -2.0,
      pointsPerWin: 30.5,
    },
  },
  {
    id: "ring-chaser",
    name: "The Ring Chaser",
    philosophy: "Banners hang forever. A marginal win today is worth almost any tomorrow, and the tax is the cost of doing business.",
    assumptions: {
      dollarsPerWin: 4_800_000,
      apronMultipliers: { below: 1.0, first: 1.2, second: 1.5 },
      replacementLevel: -2.5,
      pointsPerWin: 30.5,
    },
  },
  {
    id: "rebuilder",
    name: "The Rebuilder",
    philosophy: "Wins you buy before you're ready are the most expensive wins in basketball — flexibility is the only asset that never ages.",
    assumptions: {
      dollarsPerWin: 2_200_000,
      apronMultipliers: { below: 1.0, first: 1.8, second: 2.6 },
      replacementLevel: -2.0,
      pointsPerWin: 30.5,
    },
  },
  {
    id: "skeptic",
    name: "The Skeptic",
    philosophy: "The tenth man is closer to the star than the star's agent admits — pay for scarcity you can prove, not reputation.",
    assumptions: {
      dollarsPerWin: 3_500_000,
      apronMultipliers: { below: 1.0, first: 1.5, second: 2.0 },
      replacementLevel: -0.5,
      pointsPerWin: 30.5,
    },
  },
];

export function getLens(id: string): Lens | null {
  return PRESET_LENSES.find((l) => l.id === id) ?? null;
}

/** Deep-equality on the four assumption knobs (slider-step precision is exact, so === is safe). */
export function assumptionsEqual(a: Assumptions, b: Assumptions): boolean {
  return (
    a.dollarsPerWin === b.dollarsPerWin &&
    a.replacementLevel === b.replacementLevel &&
    a.pointsPerWin === b.pointsPerWin &&
    a.apronMultipliers.below === b.apronMultipliers.below &&
    a.apronMultipliers.first === b.apronMultipliers.first &&
    a.apronMultipliers.second === b.apronMultipliers.second
  );
}

/** Which preset the current assumptions ARE, or null when the reader has moved a slider by hand. */
export function matchLens(assumptions: Assumptions): Lens | null {
  return PRESET_LENSES.find((l) => assumptionsEqual(l.assumptions, assumptions)) ?? null;
}

/** Display name for the active worldview — a preset's name, or "My lens" for hand-set sliders. */
export function lensDisplayName(assumptions: Assumptions): string {
  return matchLens(assumptions)?.name ?? "My lens";
}

/** Lens id for state purposes; CUSTOM_LENS_ID when no preset matches. */
export function activeLensId(assumptions: Assumptions): string {
  return matchLens(assumptions)?.id ?? CUSTOM_LENS_ID;
}

/** One player's verdict under every preset worldview. */
export function buildLensSplit(player: AnalyticsPlayer, lenses: Lens[] = PRESET_LENSES): LensSplit {
  const verdicts: Record<string, VerdictTier> = {};
  let min = Infinity;
  let max = -Infinity;
  for (const lens of lenses) {
    const tier = classifyTier(valuate(player, lens.assumptions));
    verdicts[lens.id] = tier;
    min = Math.min(min, TIER_ORDER[tier]);
    max = Math.max(max, TIER_ORDER[tier]);
  }
  const span = lenses.length ? max - min : 0;
  return { slug: player.slug, verdicts, contested: span > 0, span };
}

export function buildLensSplits(players: AnalyticsPlayer[], lenses: Lens[] = PRESET_LENSES): LensSplit[] {
  return players.map((p) => buildLensSplit(p, lenses));
}
