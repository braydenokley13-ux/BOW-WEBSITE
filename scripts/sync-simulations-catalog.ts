/* ============================================================
 * scripts/sync-simulations-catalog.ts — refresh the vendored simulation catalog.
 *
 * The registry lives in braydenokley13-ux/sim-library, and that repository —
 * not this one — decides what a stranger is allowed to click. It computes
 * public readiness from observable facts, strips every internal field, and
 * writes the result to `public/simulations.json`. This script copies that
 * published payload into `data/simulations-catalog.json`.
 *
 * It is a copy rather than a fetch-at-render for two reasons. The public
 * library exists to close a linking gap, so it must not acquire a new runtime
 * dependency that can fail — a page that 500s when GitHub is slow is worse
 * than the nothing it replaced. And vendoring puts the exact catalog under
 * review in the pull request that ships it, which is where a claim about what
 * BOW offers should be read.
 *
 * Usage: `npm run sync:simulations`
 * ============================================================ */

import { writeFileSync } from "node:fs";
import path from "node:path";

const SOURCE =
  process.env.SIM_LIBRARY_PAYLOAD_URL ??
  "https://raw.githubusercontent.com/braydenokley13-ux/sim-library/main/public/simulations.json";

const TARGET = path.join(process.cwd(), "data", "simulations-catalog.json");

/** Public-safe words only. The registry forbids these; we re-check on the way in. */
const FORBIDDEN = ["tested", "validated", "proven"];

async function main(): Promise<void> {
  const response = await fetch(SOURCE);
  if (!response.ok) {
    throw new Error(`[sync:simulations] ${SOURCE} returned HTTP ${response.status}`);
  }
  const payload = await response.json();

  const simulations = payload?.simulations;
  if (!Array.isArray(simulations) || simulations.length === 0) {
    throw new Error("[sync:simulations] payload has no simulations array");
  }

  // The registry asserts this on its own side. Asserting it again here means a
  // regression upstream cannot quietly publish an overstated claim through us.
  for (const sim of simulations) {
    const label = String(sim?.label ?? "").toLowerCase();
    const hit = FORBIDDEN.find((word) => label.includes(word));
    if (hit) {
      throw new Error(
        `[sync:simulations] "${sim.id}" carries the label "${sim.label}", which claims evidence that does not exist`,
      );
    }
    if (sim?.availability === "available" && !sim?.playUrl) {
      throw new Error(`[sync:simulations] "${sim.id}" is available but has no playUrl`);
    }
    if (sim?.availability !== "available" && sim?.playUrl) {
      throw new Error(`[sync:simulations] "${sim.id}" is not available yet still carries a playUrl`);
    }
  }

  writeFileSync(TARGET, `${JSON.stringify(payload, null, 2)}\n`);
  const available = simulations.filter((s: { availability?: string }) => s.availability === "available").length;
  console.log(
    `[sync:simulations] wrote ${simulations.length} simulations (${available} playable, ${simulations.length - available} in development) to data/simulations-catalog.json`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
