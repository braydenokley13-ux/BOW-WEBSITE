/**
 * The simulation catalog, as the public site sees it.
 *
 * The data is vendored from the sim-library registry by
 * `npm run sync:simulations`. Everything here is already public-safe: the
 * registry allowlists fields on the way out, so there is no internal
 * governance, no owner, no blocker list and no maturity vocabulary beyond the
 * single label it publishes.
 *
 * Two vocabulary rules travel with the data and are enforced rather than
 * assumed, because they are the ones most likely to drift:
 *
 *   - Nothing here has been run with students. The published label is "Beta"
 *     everywhere, and the words Tested, Validated and Proven are forbidden.
 *   - A card either launches or it does not. `available` carries a playUrl;
 *     `in-development` carries none, so a dead Launch button cannot be built.
 *
 * Curation tier (`flagship`, `recommended`, …) is optional and may be absent
 * for a simulation nobody has reviewed yet. It is an editorial opinion about
 * where to start, never a claim of evidence, and the UI labels it that way.
 */

import catalog from "@/data/simulations-catalog.json";

export type Availability = "available" | "in-development";
/**
 * Lowercase on purpose. `EXPERIMENTAL` is also a MATURITY level in the registry,
 * meaning "may not even run" — the opposite of the tier, which means "runs, but
 * is rough". The public payload uses a separate lowercase vocabulary so the two
 * can never be read as the same statement.
 */
export type CurationTier = "flagship" | "recommended" | "experimental";

export type NamedRef = { id: string; name: string; note?: string | null };

export type SimulationCard = {
  id: string;
  title: string;
  summary: string;
  whatStudentsDo: string;
  track: NamedRef | null;
  subject: NamedRef | null;
  concepts: NamedRef[];
  contexts: NamedRef[];
  gradeBands: string[];
  gradeLabel: string | null;
  durationBucket: string | null;
  durationLabel: string | null;
  format: {
    setting: NamedRef[];
    grouping: NamedRef[];
    devices?: string | null;
  } | null;
  instructorNeed: string | null;
  availability: Availability;
  label: string;
  playUrl: string | null;
  tier?: CurationTier | null;
  educatorResources: { label: string; url: string }[];
};

export type SimulationCatalog = {
  generated: string;
  label: { name: string; meaning: string };
  simulations: SimulationCard[];
};

const data = catalog as unknown as SimulationCatalog;

/**
 * Tier ordering for display. Anything untiered sorts last — an unreviewed
 * simulation is not a bad one, but it is not one we are pointing at either.
 */
const TIER_RANK: Record<string, number> = { flagship: 0, recommended: 1, experimental: 2 };

function rank(sim: SimulationCard): number {
  // Playable work always outranks work that cannot be opened, whatever its tier.
  const openable = sim.availability === "available" ? 0 : 10;
  return openable + (TIER_RANK[sim.tier ?? ""] ?? 3);
}

export function getSimulationCatalog(): SimulationCatalog {
  const simulations = [...data.simulations].sort(
    (a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title),
  );
  return { ...data, simulations };
}

export function getFlagships(): SimulationCard[] {
  return getSimulationCatalog().simulations.filter(
    (s) => s.tier === "flagship" && s.availability === "available",
  );
}

/** Facet values actually present in the data, so a filter never offers an empty result. */
export function getFacets(simulations: SimulationCard[]) {
  const collect = (pick: (s: SimulationCard) => (string | null | undefined)[]) => {
    const seen = new Map<string, number>();
    for (const sim of simulations) {
      for (const value of pick(sim)) {
        if (!value) continue;
        seen.set(value, (seen.get(value) ?? 0) + 1);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  };

  return {
    tracks: collect((s) => [s.track?.name]),
    grades: collect((s) => [s.gradeLabel]),
    durations: collect((s) => [s.durationLabel]),
    concepts: collect((s) => s.concepts.map((c) => c.name)),
    instructorNeeds: collect((s) => [s.instructorNeed]),
  };
}
