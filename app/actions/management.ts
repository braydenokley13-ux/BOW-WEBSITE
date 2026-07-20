"use server";

/* ============================================================
 * Management interventions — leadership-only mutations that act on
 * execution data: bulk assignment, rebalancing, escalation, and
 * missing-next-step creation. Every core is deterministic, capped,
 * and deduped by stable keys (see lib/management.ts).
 * ============================================================ */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import {
  bulkAssignUnownedCore,
  createNextStepCore,
  escalateToFounderCore,
  rebalanceWorkCore,
  type InterventionResult,
} from "@/lib/management";

function fail(error: unknown, fallback: string): InterventionResult {
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

function refresh(): void {
  revalidatePath("/app/growth");
  revalidatePath("/app/tasks");
}

/** Assign up to `limit` unowned open Work items to one contributor. */
export async function bulkAssignUnowned(input: { ownerUserId: string; limit?: number }): Promise<InterventionResult> {
  try {
    const viewer = await requireAdmin();
    const result = await bulkAssignUnownedCore(viewer.id, String(input?.ownerUserId ?? ""), Number(input?.limit) || 25);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return fail(error, "Bulk assignment failed.");
  }
}

/** Move the oldest overdue items from an overloaded contributor to another. */
export async function rebalanceWork(input: { fromUserId: string; toUserId: string; limit?: number }): Promise<InterventionResult> {
  try {
    const viewer = await requireAdmin();
    const result = await rebalanceWorkCore(
      viewer.id,
      String(input?.fromUserId ?? ""),
      String(input?.toUserId ?? ""),
      Number(input?.limit) || 10,
    );
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return fail(error, "Rebalance failed.");
  }
}

/** Escalate a stuck record into the founder decision queue (deduped). */
export async function escalateToFounder(input: { entityType: string; entityId: string; reason?: string }): Promise<InterventionResult> {
  try {
    const viewer = await requireAdmin();
    const result = await escalateToFounderCore(
      viewer.id,
      String(input?.entityType ?? ""),
      String(input?.entityId ?? ""),
      String(input?.reason ?? ""),
    );
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return fail(error, "Escalation failed.");
  }
}

/** Create the missing next step on a stalled warm record (deduped). */
export async function createNextStep(input: { entityType: string; entityId: string; ownerUserId?: string | null }): Promise<InterventionResult> {
  try {
    const viewer = await requireAdmin();
    const result = await createNextStepCore(
      viewer.id,
      String(input?.entityType ?? ""),
      String(input?.entityId ?? ""),
      input?.ownerUserId ? String(input.ownerUserId) : viewer.id,
    );
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return fail(error, "Could not create the next step.");
  }
}
