import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  SIMULATIONS,
  PLAYABLE_COUNT,
  IN_DEVELOPMENT_COUNT,
  LIBRARY,
  programs,
} from "../../lib/simulation-library";

/* ============================================================
 * The simulation library is generated data from another repository, so these
 * tests guard the SEAM. They assume nothing about the generator: if a future
 * copy of simulations.json breaks one of the promises the page renders, the
 * build fails here rather than a visitor finding out by clicking.
 * ============================================================ */

test("a launch link exists for everything the page will call playable, and for nothing else", () => {
  // The contradiction this page must never print: "Play now" with nowhere to
  // go, or "In development" beside a working link.
  for (const sim of SIMULATIONS) {
    if (sim.availability === "available") {
      assert.ok(sim.playUrl, `${sim.id} is available with no playUrl`);
      assert.match(sim.playUrl!, /^https:\/\//, `${sim.id} has a non-https playUrl`);
    } else {
      assert.equal(sim.playUrl, null, `${sim.id} is ${sim.availability} but carries ${sim.playUrl}`);
    }
  }
});

test("no launch link points at a source repository", () => {
  // Sending a teacher to source code and labelling it Play is the specific
  // failure the registry exists to prevent; the website must not reintroduce it.
  for (const sim of SIMULATIONS) {
    if (sim.playUrl) assert.doesNotMatch(sim.playUrl, /github\.com/, `${sim.id} links a repository`);
  }
});

test("nothing claims a maturity BOW has not earned", () => {
  // No BOW simulation has a recorded student run, so no public copy may imply
  // one. This checks the words, not a field.
  for (const sim of SIMULATIONS) {
    const prose = [sim.title, sim.summary, sim.whatStudentsDo, sim.label, sim.instructorNeed]
      .join(" ")
      .toLowerCase();
    for (const word of ["tested", "validated", "proven"]) {
      assert.doesNotMatch(prose, new RegExp(`\\b${word}\\b`), `${sim.id} claims "${word}"`);
    }
  }
});

test("the only two labels are Beta and In development", () => {
  const labels = new Set(SIMULATIONS.map((s) => s.label));
  for (const label of labels) {
    assert.ok(["Beta", "In development"].includes(label), `unexpected public label "${label}"`);
  }
});

test("every simulation can explain itself to a visitor", () => {
  for (const sim of SIMULATIONS) {
    assert.ok(sim.title.trim().length > 1, `${sim.id} has no title`);
    assert.ok(sim.summary.trim().length >= 20, `${sim.id} has no real summary`);
    assert.ok(sim.whatStudentsDo.trim().length >= 60, `${sim.id} does not say what students do`);
    assert.ok(sim.instructorNeed.trim().length > 0, `${sim.id} does not say what an instructor needs`);
  }
});

test("no internal registry field reaches the client bundle", () => {
  // The payload is imported into a client component, so anything in it ships to
  // the browser. The generator allowlists fields; this asserts the copy in this
  // repo was not taken from the internal build by mistake.
  const raw = readFileSync(path.join(process.cwd(), "lib/simulation-library.data.json"), "utf8");
  for (const key of [
    "governance", "provenance", "maturity", "owner", "productOwner", "knownBlockers",
    "validation", "health", "publicRelease", "visibility", "lastVerified", "notes",
  ]) {
    assert.doesNotMatch(raw, new RegExp(`"${key}"`), `internal key "${key}" is in the shipped payload`);
  }
});

test("simulation ids are unique, since React keys and analytics depend on them", () => {
  const ids = SIMULATIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("the catalog is not empty and the counts agree", () => {
  assert.ok(SIMULATIONS.length > 0, "the library shipped with no simulations");
  assert.equal(PLAYABLE_COUNT + IN_DEVELOPMENT_COUNT, SIMULATIONS.length);
  assert.ok(PLAYABLE_COUNT > 0, "nothing in the library can actually be played");
});

test("Track 301 is represented as a real track that is still being built", () => {
  // Track 301 is an active BOW product. A single thin repository inside it must
  // never be allowed to make the track look abandoned, and shipping simulations
  // must never make it look finished. Both halves are asserted here.
  const track301 = programs().find((p) => p.id === "track-301");
  assert.ok(track301, "Track 301 is missing from the programs strip");
  assert.equal(track301!.building, true, "Track 301 should read as actively being built");
  assert.ok(track301!.playable > 0, "Track 301 should show the simulations that already play");
  assert.match(track301!.note, /actively being built/);
});

test("a program with nothing playable never advertises zero", () => {
  for (const p of programs()) {
    if (p.playable === 0) assert.match(p.stat, /in development$/, `${p.id} reads "${p.stat}"`);
    else assert.match(p.stat, /ready to play$/, `${p.id} reads "${p.stat}"`);
  }
});

test("the payload records when it was generated", () => {
  assert.match(LIBRARY.generated, /^\d{4}-\d{2}-\d{2}$/);
});
