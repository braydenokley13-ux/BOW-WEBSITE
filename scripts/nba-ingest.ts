#!/usr/bin/env -S npx tsx
/**
 * CLI wrapper over lib/nba-ingest.ts — cache curated-player advanced
 * stats from stats.nba.com into the site's SQLite database.
 *
 * Usage
 * -----
 *   npm run ingest                                  # current season
 *   npm run ingest -- --season 2025-26
 *   npm run ingest -- --seasons 2023-24,2024-25,2025-26   # backfill multiple seasons in one run
 *   npm run ingest -- --dry-run                      # fetch + print, no writes
 *   npm run ingest -- --csv path/to/contracts.csv     # curated-list fallback override
 *
 * Safe to re-run any time (idempotent upserts); the Vercel cron route
 * (app/api/cron/daily/route.ts) runs this same logic nightly.
 * Run from the repo root, or pass --csv for a non-default fallback path.
 */

import { ingestSeasons, currentSeason, type IngestResult } from "../lib/nba-ingest";

function parseArgs(argv: string[]) {
  const args: { season?: string; seasons?: string; csv?: string; dryRun: boolean } = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--season":
        args.season = argv[++i];
        break;
      case "--seasons":
        args.seasons = argv[++i];
        break;
      case "--csv":
        args.csv = argv[++i];
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--db":
        // Accepted for parity with the Python script's flag set; the site's
        // DB path is fixed by lib/db.ts (data/bow.db), not overridable here.
        console.warn("  note: --db is a no-op — the DB path is fixed by lib/db.ts (data/bow.db)");
        i++;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }
  return args;
}

function printHelp() {
  console.log(
    [
      "Usage: npm run ingest -- [options]",
      "",
      "  --season <label>     season to ingest, e.g. 2025-26 (default: current)",
      "  --seasons <a,b,c>    comma-separated seasons to backfill in one run (overrides --season)",
      "  --csv <path>         contracts.csv fallback for the curated list",
      "  --dry-run            fetch and print, write nothing",
    ].join("\n"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const seasons = args.seasons
    ? args.seasons
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [args.season ?? currentSeason()];

  console.log(`ingesting season(s): ${seasons.join(", ")}${args.dryRun ? " (dry run)" : ""}`);

  const results = await ingestSeasons(seasons, { dryRun: args.dryRun, csvPath: args.csv });

  let hadErrors = false;
  for (const r of results) {
    printResult(r);
    if (r.errors.length > 0) hadErrors = true;
  }

  if (hadErrors) {
    console.error("\ningest finished with errors (see above) — the site keeps serving cached/snapshot data.");
    process.exitCode = 1;
  } else {
    console.log("\ningest finished cleanly.");
  }
}

function printResult(r: IngestResult) {
  console.log(
    `season ${r.season}: matched=${r.matched} updated=${r.updated} skipped=${r.skipped} errors=${r.errors.length}`,
  );
  for (const e of r.errors) console.error(`  ! ${e}`);
}

main().catch((err) => {
  console.error("fatal:", err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
