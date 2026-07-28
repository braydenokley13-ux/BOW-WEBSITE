/* ============================================================
 * Vercel Cron target — the time-driven half of the registration lifecycle.
 *
 * Three things only clocks can do, run together because they chain: expire
 * seat reservations whose deadline passed, expire outstanding waitlist offers,
 * and refill the seats those releases freed by offering them to the next
 * eligible family. Then deliver whatever family notifications that produced.
 *
 * `sweepExpirations()` is idempotent — it selects on deadlines that have
 * already passed, so a duplicate invocation or a retry finds nothing left to
 * do rather than double-releasing a seat. That is what makes it safe to also
 * call opportunistically from the admin enrollment surface, so an environment
 * where this cron is not configured still converges instead of stranding seats
 * behind dead reservations.
 *
 * Node runtime required: the sweep uses lib/db.ts and real transactions.
 * ============================================================ */

import { NextResponse, type NextRequest } from "next/server";
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

  // The sweep and the delivery pass are two independent pieces of work; one
  // failing must never be reported as the other's success, and neither
  // failing may render as a quiet "nothing to do". Each is run and reported
  // separately so the cron dashboard can tell "no expired reservations" from
  // "the sweep query itself failed".
  const startedAt = Date.now();
  let sweep: Awaited<ReturnType<typeof sweepExpirations>> | null = null;
  let sweepError: string | null = null;
  try {
    sweep = await sweepExpirations();
  } catch (error) {
    sweepError = error instanceof Error ? error.message : "Sweep failed.";
    console.error("[family-maintenance] sweep failed", error);
  }

  let delivery: Awaited<ReturnType<typeof deliverPending>> | null = null;
  let deliveryError: string | null = null;
  try {
    // Delivery runs after the sweep so the notifications it just wrote go out
    // in the same invocation rather than waiting an hour for the next one.
    // Runs even if the sweep failed, so notifications already queued by
    // earlier admin/family actions still get delivered.
    delivery = await deliverPending(100);
  } catch (error) {
    deliveryError = error instanceof Error ? error.message : "Delivery failed.";
    console.error("[family-maintenance] delivery failed", error);
  }

  // Config problems (no mail key, no public app URL) make delivery report all
  // 'skipped' every run, which looks identical to "nothing was queued" unless
  // it is called out explicitly.
  const env = validateEnvironment();
  const envIssues = env.checks.filter((c) => c.status !== "ok");

  const ok = sweepError == null && deliveryError == null;
  return NextResponse.json(
    {
      ok,
      durationMs: Date.now() - startedAt,
      sweep,
      sweepError,
      delivery,
      deliveryError,
      // What may be retried: a sweep failure is safe to retry on the next
      // scheduled run (sweepExpirations is idempotent); a delivery failure is
      // retried per-message from the admin communications view.
      retryable: { sweep: sweepError != null, delivery: deliveryError != null },
      envIssues: envIssues.length ? envIssues : undefined,
    },
    { status: ok ? 200 : 500 },
  );
}
