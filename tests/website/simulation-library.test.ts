import assert from "node:assert/strict";
import test from "node:test";
import {
  getFacets,
  getFlagships,
  getSimulationCatalog,
  type SimulationCard,
} from "../../lib/simulations-catalog";

/* ============================================================
 * The public simulation library.
 *
 * The library's whole value is that a stranger can trust it, so the rules
 * tested here are the ones that would make it untrustworthy if they broke:
 *
 *   1. A Launch button never points at nothing, and a card that cannot launch
 *      never grows one. This is the failure that turns a working library into
 *      a worse-than-nothing one.
 *   2. Nothing claims evidence BOW does not have. No simulation has been run
 *      with students, so the words Tested, Validated and Proven must not
 *      appear in anything the page renders.
 *   3. Curation is an opinion about where to start, and an opinion may not
 *      promote something a visitor cannot open.
 * ============================================================ */

const catalog = getSimulationCatalog();
const sims = catalog.simulations;

test("the catalog is not empty — a silent sync failure would look like a working page", () => {
  assert.ok(sims.length > 0, "catalog has no simulations");
  assert.ok(
    sims.filter((s) => s.availability === "available").length > 0,
    "catalog has nothing playable",
  );
});

test("every playable simulation carries a launchable https URL", () => {
  for (const sim of sims.filter((s) => s.availability === "available")) {
    assert.ok(sim.playUrl, `${sim.id} is available with no playUrl`);
    assert.match(sim.playUrl as string, /^https:\/\//, `${sim.id} playUrl is not https`);
  }
});

test("a card that is still being built never carries a launch URL", () => {
  for (const sim of sims.filter((s) => s.availability !== "available")) {
    assert.equal(sim.playUrl, null, `${sim.id} is in development but has a playUrl`);
  }
});

test("availability is only ever one of the two states the UI can render", () => {
  for (const sim of sims) {
    assert.ok(
      sim.availability === "available" || sim.availability === "in-development",
      `${sim.id} has unrenderable availability "${sim.availability}"`,
    );
  }
});

test("no simulation claims student evidence that does not exist", () => {
  const forbidden = ["tested", "validated", "proven"];
  for (const sim of sims) {
    const rendered = [sim.label, sim.title, sim.summary].join(" ").toLowerCase();
    for (const word of forbidden) {
      assert.ok(!rendered.includes(word), `${sim.id} renders the word "${word}"`);
    }
  }
});

test("the published maturity label is the single one the registry allows", () => {
  // There is exactly one maturity word in public output — "Beta" — because
  // nothing has been student-tested and a richer vocabulary could only
  // overstate that. Work that cannot be opened is labelled by its state
  // instead, never by a maturity it has not reached.
  assert.equal(catalog.label.name, "Beta");
  for (const sim of sims) {
    const expected = sim.availability === "available" ? "Beta" : "In development";
    assert.equal(sim.label, expected, `${sim.id} carries the label "${sim.label}"`);
  }
});

test("ids are unique, so React keys and analytics cannot collide", () => {
  assert.equal(new Set(sims.map((s) => s.id)).size, sims.length);
});

test("every card has the copy the grid needs to render a useful tile", () => {
  for (const sim of sims) {
    assert.ok(sim.title.trim().length > 0, `${sim.id} has no title`);
    assert.ok(sim.summary.trim().length >= 20, `${sim.id} has a summary too thin to be useful`);
  }
});

test("flagships are always openable — a shortlist a teacher cannot act on is not one", () => {
  for (const sim of getFlagships()) {
    assert.equal(sim.availability, "available", `flagship ${sim.id} is not playable`);
    assert.ok(sim.playUrl, `flagship ${sim.id} has no playUrl`);
  }
});

test("curation tier, when present, is a tier the UI knows how to label", () => {
  const known = new Set(["FLAGSHIP", "RECOMMENDED", "EXPERIMENTAL"]);
  for (const sim of sims) {
    if (sim.tier == null) continue;
    assert.ok(known.has(sim.tier), `${sim.id} carries unknown tier "${sim.tier}"`);
  }
});

test("playable work sorts ahead of work that cannot be opened", () => {
  const lastPlayable = sims.map((s) => s.availability).lastIndexOf("available");
  const firstPending = sims.map((s) => s.availability).indexOf("in-development");
  if (firstPending !== -1) {
    assert.ok(
      lastPlayable < firstPending,
      "an in-development card sorts above a playable one, burying what visitors can use",
    );
  }
});

test("facets only offer values that exist, so no filter leads to an empty grid", () => {
  const facets = getFacets(sims);
  for (const [name, options] of Object.entries(facets)) {
    for (const { value, count } of options) {
      assert.ok(count > 0, `${name} facet offers "${value}" with no matching simulation`);
    }
  }
});

test("facet counts agree with the data they were derived from", () => {
  const { tracks } = getFacets(sims);
  for (const { value, count } of tracks) {
    const actual = sims.filter((s: SimulationCard) => s.track?.name === value).length;
    assert.equal(count, actual, `track "${value}" is counted ${count} but appears ${actual} times`);
  }
});
