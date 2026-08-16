/* ============================================================
 * The public simulation catalog.
 *
 * The data is GENERATED, not authored here. It comes from the BOW Simulation
 * Registry (github.com/braydenokley13-ux/sim-library), whose build emits a
 * deliberately narrow public payload: product fields only, allowlisted one by
 * one, with the internal half of every record — maturity, owner gaps, known
 * blockers, validation history — structurally unable to reach it.
 *
 * To refresh:
 *   1. in sim-library:  npm run check
 *   2. copy public/simulations.json → lib/simulation-library.data.json
 *
 * Two properties of that payload matter to this file and are asserted in
 * tests/website/simulation-library.test.ts rather than assumed:
 *
 *   - `available` always carries a playUrl; `in-development` never does. A
 *     Launch button therefore cannot appear without somewhere to go, and
 *     "In development" cannot appear beside a working link.
 *   - the only labels are "Beta" and "In development". Nothing claims to be
 *     tested, validated or proven, because no student run has been recorded
 *     for any BOW simulation and the registry will not let one be claimed.
 * ============================================================ */

import data from "@/lib/simulation-library.data.json";

export interface NamedRef {
  id: string;
  name: string;
}

export interface LibrarySimulation {
  id: string;
  title: string;
  summary: string;
  whatStudentsDo: string;
  track: { id: string; name: string; note: string } | null;
  subject: NamedRef;
  concepts: NamedRef[];
  contexts: NamedRef[];
  gradeBands: string[];
  gradeLabel: string | null;
  durationBucket: string | null;
  durationLabel: string | null;
  format: {
    setting: NamedRef[];
    grouping: NamedRef[];
    devices: string | null;
  };
  instructorNeed: string;
  availability: "available" | "in-development";
  label: string;
  playUrl: string | null;
  educatorResources: { kind: string; label: string; url: string }[];
}

export interface LibraryPayload {
  generated: string;
  label: { name: string; meaning: string };
  simulations: LibrarySimulation[];
}

const payload = data as LibraryPayload;

export const LIBRARY: LibraryPayload = payload;
export const SIMULATIONS: LibrarySimulation[] = payload.simulations;

export const PLAYABLE_COUNT = SIMULATIONS.filter((s) => s.availability === "available").length;
export const IN_DEVELOPMENT_COUNT = SIMULATIONS.length - PLAYABLE_COUNT;

/** Programs, in teaching order, with an honest count beside each. */
const TRACK_ORDER = [
  "pre-course", "track-101", "track-201", "track-301", "gauntlet",
  "analytics-lab", "bow-website", "highway-world", "front-office-city",
  "bonus-gm-sims", "decision-challenges", "entrepreneurship-lab",
];

/**
 * Tracks BOW is actively building. This is a statement about the PRODUCT, and
 * is deliberately independent of whether any individual simulation inside it is
 * finished — Track 301 has thirteen experiences a class can play today and is
 * still being extended, and both halves of that are true at once.
 */
const IN_DEVELOPMENT_TRACKS = new Set([
  "track-301", "highway-world", "front-office-city", "bonus-gm-sims",
  "decision-challenges", "entrepreneurship-lab",
]);

export interface ProgramSummary {
  id: string;
  name: string;
  note: string;
  playable: number;
  inDevelopment: number;
  /** True when BOW is still building the track, whatever it already ships. */
  building: boolean;
  stat: string;
}

export function programs(): ProgramSummary[] {
  const byId = new Map<string, ProgramSummary>();
  for (const sim of SIMULATIONS) {
    if (!sim.track) continue;
    if (!byId.has(sim.track.id)) {
      const building = IN_DEVELOPMENT_TRACKS.has(sim.track.id);
      byId.set(sim.track.id, {
        id: sim.track.id,
        name: sim.track.name,
        note: building ? `${sim.track.note} — actively being built` : sim.track.note,
        playable: 0,
        inDevelopment: 0,
        building,
        stat: "",
      });
    }
    const entry = byId.get(sim.track.id)!;
    if (sim.availability === "available") entry.playable += 1;
    else entry.inDevelopment += 1;
  }

  return [...byId.values()]
    .map((p) => ({
      ...p,
      // A program with nothing playable must not advertise "0 ready to play".
      stat: p.playable > 0 ? `${p.playable} ready to play` : `${p.inDevelopment} in development`,
    }))
    .sort((a, b) => {
      const ai = TRACK_ORDER.indexOf(a.id);
      const bi = TRACK_ORDER.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name);
    });
}
