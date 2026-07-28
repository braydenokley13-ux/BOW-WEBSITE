"use server";

/* ============================================================
 * Admin-facing server actions over family communications delivery.
 *
 * Read and retry only — this file never touches program_registrations,
 * waitlist_offers, or any other business table. The state change a
 * notification describes already happened when it was written by the
 * engine (lib/enrollment.ts); everything here is about whether the message
 * that describes it actually reached the family.
 * ============================================================ */

import { requireStaff } from "@/lib/dal";
import { listDeliveryFeed, retryNotification, type DeliveryFeedRow } from "@/lib/family-communications";

export interface RetryDeliveryResult {
  ok: boolean;
  status?: "sent" | "failed" | "skipped";
  error?: string;
}

/** Admin read: every notification, who it was for, and its delivery state. */
export async function getDeliveryFeed(options?: {
  emailStatus?: "not_sent" | "queued" | "sent" | "failed" | "skipped";
  limit?: number;
}): Promise<DeliveryFeedRow[]> {
  await requireStaff();
  return listDeliveryFeed(options);
}

/**
 * Resend one notification. Staff-only; records who requested the retry so a
 * message that may already have reached the family isn't a mystery resend.
 */
export async function retryDelivery(notificationId: string): Promise<RetryDeliveryResult> {
  const staff = await requireStaff();
  if (!notificationId) return { ok: false, error: "Missing notification id." };
  try {
    const status = await retryNotification(notificationId, staff.id);
    return { ok: true, status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Retry failed." };
  }
}
