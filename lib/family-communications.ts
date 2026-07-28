/* ============================================================
 * Family communications — delivery for the operational messages a program
 * generates. Not a marketing email product: every message here is tied to a
 * program event, addressed to one family, about one child.
 *
 * `family_notifications` is written synchronously by the engine as part of the
 * state change that caused it (so the dashboard is never out of step with the
 * record), and delivery happens here afterwards. That split is deliberate: a
 * mail provider outage must never roll back a confirmed seat, and a failed
 * send stays visible and retryable instead of vanishing.
 *
 * Server-only, not a "use server" module.
 * ============================================================ */

import "server-only";

import { getDb } from "@/lib/db";
import { renderTransactionalEmail } from "@/lib/email-template";
import { publicAppOrigin, sendTransactionalEmail, transactionalEmailReady } from "@/lib/transactional-email";

/**
 * Message types a program event can produce. Kept as one closed list so the
 * admin communications view can label anything it finds, and so a new event
 * cannot ship without deciding how it reads to a family.
 */
export const NOTIFICATION_KINDS: Record<string, { label: string; urgent: boolean }> = {
  registration_received: { label: "Registration received", urgent: false },
  seat_reserved: { label: "Seat reserved", urgent: false },
  registration_confirmed: { label: "Registration confirmed", urgent: false },
  registration_waitlisted: { label: "Waitlisted", urgent: false },
  interest_recorded: { label: "Interest recorded", urgent: false },
  activation_invitation: { label: "Account activation", urgent: false },
  reservation_reminder: { label: "Reservation reminder", urgent: true },
  reservation_extended: { label: "Reservation extended", urgent: false },
  reservation_expired: { label: "Reservation expired", urgent: true },
  requirement_missing: { label: "Missing requirement", urgent: true },
  requirement_approved: { label: "Requirement approved", urgent: false },
  requirement_correction: { label: "Requirement needs correction", urgent: true },
  waitlist_offer: { label: "Waitlist offer", urgent: true },
  offer_reminder: { label: "Offer reminder", urgent: true },
  offer_expired: { label: "Offer expired", urgent: true },
  offer_accepted: { label: "Offer accepted", urgent: false },
  class_placement: { label: "Class placement", urgent: false },
  schedule_change: { label: "Schedule change", urgent: true },
  session_cancelled: { label: "Session cancelled", urgent: true },
  program_cancelled: { label: "Program cancelled", urgent: true },
  first_session_reminder: { label: "First session reminder", urgent: false },
  withdrawal_processed: { label: "Withdrawal processed", urgent: false },
  transfer_result: { label: "Transfer result", urgent: false },
  program_completed: { label: "Program complete", urgent: false },
  certificate_issued: { label: "Certificate issued", urgent: false },
  next_recommendation: { label: "Next program", urgent: false },
};

export function notificationLabel(kind: string): string {
  return NOTIFICATION_KINDS[kind]?.label ?? "Update";
}

/**
 * Changes important enough to email regardless of a family's reminder
 * preferences. Routine reminders respect preferences; these do not, because a
 * family that misses one loses a seat or arrives at a cancelled session.
 */
const ALWAYS_EMAIL: ReadonlySet<string> = new Set([
  "program_cancelled",
  "session_cancelled",
  "schedule_change",
  "class_placement",
  "waitlist_offer",
  "offer_reminder",
  "reservation_reminder",
  "reservation_expired",
  "requirement_missing",
  "activation_invitation",
]);

export function mustEmail(kind: string): boolean {
  return ALWAYS_EMAIL.has(kind);
}

interface PendingRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  action_label: string | null;
  action_href: string | null;
  guardian_email: string | null;
  guardian_name: string | null;
  student_name: string | null;
  program_name: string | null;
  registration_status: string | null;
}

/**
 * Send one notification and record the delivery outcome.
 *
 * Returns the resulting `email_status`. A missing provider configuration is
 * recorded as `skipped`, not `failed`: a development environment with no mail
 * key should not fill the admin retry queue with false alarms.
 */
export async function deliverNotification(notificationId: string): Promise<"sent" | "failed" | "skipped"> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT n.id, n.kind, n.title, n.body, n.action_label, n.action_href,
              p.email AS guardian_email, p.name AS guardian_name,
              s.name AS student_name, pr.name AS program_name, r.status AS registration_status
         FROM family_notifications n
         LEFT JOIN people p ON p.id = n.person_id
         LEFT JOIN students s ON s.id = n.student_id
         LEFT JOIN programs pr ON pr.id = n.program_id
         LEFT JOIN program_registrations r ON r.id = n.registration_id
        WHERE n.id = ?`,
    )
    .get(notificationId)) as PendingRow | undefined;
  if (!row) return "failed";

  const now = Date.now();
  const finish = async (status: "sent" | "failed" | "skipped", error?: string) => {
    await db
      .prepare("UPDATE family_notifications SET email_status = ?, email_error = ?, updated_at = ? WHERE id = ?")
      .run(status, error ?? null, now, notificationId);
    return status;
  };

  if (!row.guardian_email) return finish("skipped", "No guardian email on file.");
  if (!transactionalEmailReady()) return finish("skipped", "Email delivery is not configured.");

  const origin = publicAppOrigin();
  const { registrationLabel } = await import("@/lib/enrollment-shared");

  // Every family-facing message carries the same four things: which child,
  // which program, where the registration currently stands, and one action.
  const details: { label: string; value: string }[] = [];
  if (row.student_name) details.push({ label: "Student", value: row.student_name });
  if (row.program_name) details.push({ label: "Program", value: row.program_name });
  if (row.registration_status) {
    details.push({ label: "Status", value: registrationLabel(row.registration_status) });
  }

  const actionUrl = row.action_href && origin ? new URL(row.action_href, origin).toString() : null;

  try {
    const delivered = await sendTransactionalEmail({
      to: row.guardian_email,
      subject: `BOW Sports Capital — ${row.title}`,
      ...renderTransactionalEmail({
        preheader: row.body ?? row.title,
        heading: row.title,
        paragraphs: [row.guardian_name ? `Hi ${row.guardian_name},` : "Hello,", row.body ?? row.title].filter(Boolean),
        details,
        cta: actionUrl && row.action_label ? { label: row.action_label, url: actionUrl } : undefined,
        note: "Reply to this email or use the contact page if you need help with this.",
      }),
    });
    return delivered ? finish("sent") : finish("failed", "The email provider rejected the message.");
  } catch (error) {
    return finish("failed", error instanceof Error ? error.message.slice(0, 300) : "Delivery failed.");
  }
}

/**
 * Deliver everything queued. Bounded per run so one sweep cannot stall a
 * request; the remainder is picked up by the next one.
 */
export async function deliverPending(limit = 50): Promise<{ sent: number; failed: number; skipped: number }> {
  const db = getDb();
  const rows = (await db
    .prepare(
      `SELECT id, kind FROM family_notifications
        WHERE email_status = 'not_sent'
        ORDER BY created_at
        LIMIT ?`,
    )
    .all(limit)) as unknown as { id: string; kind: string }[];

  const totals = { sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    const status = await deliverNotification(row.id);
    totals[status] += 1;
  }
  return totals;
}

/** Retry one failed delivery from the admin communications view. */
export async function retryNotification(notificationId: string): Promise<"sent" | "failed" | "skipped"> {
  const db = getDb();
  await db
    .prepare("UPDATE family_notifications SET email_status = 'not_sent', email_error = NULL, updated_at = ? WHERE id = ? AND email_status = 'failed'")
    .run(Date.now(), notificationId);
  return deliverNotification(notificationId);
}
