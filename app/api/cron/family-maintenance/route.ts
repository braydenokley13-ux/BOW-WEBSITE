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

  try {
    const sweep = await sweepExpirations();
    // Delivery runs after the sweep so the notifications it just wrote go out
    // in the same invocation rather than waiting an hour for the next one.
    const delivery = await deliverPending(100);
    return NextResponse.json({ ok: true, sweep, delivery });
  } catch (error) {
    // Surface the failure to the cron dashboard instead of reporting success:
    // a silently failing sweep looks exactly like a healthy one with no work.
    console.error("[family-maintenance] sweep failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sweep failed." },
      { status: 500 },
    );
  }
}
