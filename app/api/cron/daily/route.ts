/* ============================================================
 * Vercel Cron target — single daily job for the Hobby plan.
 *
 * Vercel's free plan only allows cron schedules that fire at most once
 * a day, so the previous separate nightly NBA ingest and hourly family
 * maintenance sweep are combined here into one daily invocation.
 *
 * Order matters: family maintenance (expiring reservations/offers and
 * delivering pending notifications) runs FIRST, each half in its own
 * try/catch, so a slow or hanging stats.nba.com request can never delay
 * or block that time-sensitive work. The NBA ingest runs last and is the
 * only part allowed to be slow.
 *
 * `dryRun=1` only exercises the NBA ingestion path (read-only against
 * stats.nba.com, and ingestSeasons itself skips writes in dry-run mode).
 * It must never touch production state, so recordDailySnapshot,
 * sweepExpirations, and deliverPending are all skipped entirely — not
 * just their side effects — on a dry run.
 *
 * Both maintenance operations are idempotent (sweepExpirations only
 * touches already-passed deadlines; recordDailySnapshot forces a
 * re-freeze of today's snapshot) so a duplicate or retried invocation
 * converges rather than double-sending emails or double-writing records.
 *
 * Node runtime required: ingest, sweep, and delivery all use node:sqlite
 * via lib/db.ts.
 * ============================================================ */

import { NextResponse, type NextRequest } from "next/server";
import { ingestSeasons, currentSeason } from "@/lib/nba-ingest";
import { recordDailySnapshot } from "@/lib/ledger-store";
import { sweepExpirations } from "@/lib/enrollment";
import { deliverPending } from "@/lib/family-communications";
import { validateEnvironment } from "@/lib/env-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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

  // --- Family maintenance first: expire reservations/offers and deliver
  // pending notifications before the potentially slow NBA ingest below.
  // Skipped entirely on a dry run — it must not mutate state or send mail.
  let sweep: Awaited<ReturnType<typeof sweepExpirations>> | { skipped: true } = { skipped: true };
  let sweepError: string | null = null;
  if (!dryRun) {
    try {
      sweep = await sweepExpirations();
    } catch (error) {
      sweepError = error instanceof Error ? error.message : "Sweep failed.";
      console.error("[cron/daily] sweep failed", error);
    }
  }

  let delivery: Awaited<ReturnType<typeof deliverPending>> | { skipped: true } = { skipped: true };
  let deliveryError: string | null = null;
  if (!dryRun) {
    try {
      delivery = await deliverPending(100);
    } catch (error) {
      deliveryError = error instanceof Error ? error.message : "Delivery failed.";
      console.error("[cron/daily] delivery failed", error);
    }
  }

  // --- NBA ingest last: the only part of this cron allowed to be slow.
  const ingestResults = await ingestSeasons(seasons, { dryRun });
  const ingestOk = ingestResults.every((r) => r.errors.length === 0);

  let ledger: { events: number } | { error: string } | { skipped: true } = { skipped: true };
  if (!dryRun) {
    try {
      const recorded = await recordDailySnapshot({ force: true });
      ledger = recorded ? { events: recorded.events.length } : { skipped: true };
    } catch (err) {
      ledger = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  const env = validateEnvironment();
  const envIssues = env.checks.filter((c) => c.status !== "ok");

  const ok = ingestOk && sweepError == null && deliveryError == null;
  return NextResponse.json(
    {
      ok,
      dryRun,
      seasons,
      familyMaintenance: {
        sweep,
        sweepError,
        delivery,
        deliveryError,
        retryable: { sweep: sweepError != null, delivery: deliveryError != null },
      },
      ingest: { ok: ingestOk, results: ingestResults },
      ledger,
      envIssues: envIssues.length ? envIssues : undefined,
    },
    { status: ok ? 200 : 502 },
  );
}
