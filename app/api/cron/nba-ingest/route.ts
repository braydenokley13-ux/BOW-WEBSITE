/* ============================================================
 * Vercel Cron target — nightly refresh of the NBA analytics cache.
 *
 * Runs the exact same ingestion logic as `npm run ingest` (see
 * lib/nba-ingest.ts), scheduled via the `crons` entry in vercel.json.
 * Guarded so only Vercel's cron dispatcher (or a local dev request)
 * can trigger it — this hits stats.nba.com and writes to SQLite, so it
 * isn't something we want a random crawler invoking.
 *
 * Node runtime required: lib/nba-ingest.ts uses node:sqlite (via
 * lib/db.ts's getDb()) and node:fs, neither available on the edge
 * runtime. Not cached — every invocation should actually run the
 * ingest, so this is a plain dynamic GET (Next's default for route
 * handlers since v15; no `dynamic` export needed, but declared for
 * clarity to future editors).
 * ============================================================ */

import { NextResponse, type NextRequest } from "next/server";
import { ingestSeasons, currentSeason } from "@/lib/nba-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// stats.nba.com retries with backoff can take a while; give the cron
// invocation room to finish instead of racing a short default timeout.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  const isLocalDev = process.env.NODE_ENV !== "production";

  if (!isLocalDev && (!expected || authHeader !== `Bearer ${expected}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const seasonParam = request.nextUrl.searchParams.get("season");
  const seasonsParam = request.nextUrl.searchParams.get("seasons");
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  const seasons = seasonsParam
    ? seasonsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [seasonParam ?? currentSeason()];

  const results = await ingestSeasons(seasons, { dryRun });
  const ok = results.every((r) => r.errors.length === 0);

  return NextResponse.json({ ok, dryRun, results }, { status: ok ? 200 : 502 });
}
