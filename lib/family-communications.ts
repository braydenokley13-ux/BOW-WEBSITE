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
  // Seat is HELD, not confirmed — it has a deadline and can be lost, so its
  // label and copy must never read like a confirmation. See deliverNotification.
  seat_reserved: { label: "Seat held (action required)", urgent: true },
  registration_confirmed: { label: "Registration confirmed", urgent: false },
  registration_waitlisted: { label: "Waitlisted", urgent: false },
  interest_recorded: { label: "Interest recorded", urgent: false },
  activation_invitation: { label: "Parent account activation", urgent: false },
  // Distinct from a parent's own activation invite: a student invitation
  // grants the student their own sign-in, not guardian access.
  student_invitation: { label: "Student account invitation", urgent: false },
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
  // A location change is its own kind (not folded into schedule_change) so it
  // can always be treated as an emergency send, independent of how a given
  // schedule change happens to be routed upstream.
  location_change: { label: "Location change", urgent: true },
  session_cancelled: { label: "Session cancelled", urgent: true },
  program_cancelled: { label: "Program cancelled", urgent: true },
  first_session_reminder: { label: "First session reminder", urgent: false },
  withdrawal_processed: { label: "Withdrawal processed", urgent: false },
  transfer_requested: { label: "Transfer request received", urgent: false },
  transfer_approved: { label: "Transfer approved", urgent: false },
  transfer_declined: { label: "Transfer declined", urgent: false },
  absence_acknowledged: { label: "Absence notice received", urgent: false },
  program_completed: { label: "Program complete", urgent: false },
  certificate_issued: { label: "Certificate available", urgent: false },
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
  // Emergency location change — a family showing up at the wrong place is the
  // exact failure this override exists to prevent.
  "location_change",
  "class_placement",
  "waitlist_offer",
  "offer_reminder",
  "offer_expired",
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
  email_status: string;
  guardian_email: string | null;
  guardian_name: string | null;
  student_name: string | null;
  program_name: string | null;
  registration_status: string | null;
  offer_status: string | null;
  reservation_expires_at: string | null;
}

/**
 * Kinds whose action link points at a state that can go stale between the
 * moment the notification was written and the moment it is (re)sent — a
 * waitlist offer that has since expired or been responded to, or a
 * reservation that has since been confirmed or released. Sending the button
 * anyway would invite the family to act on a link that no longer does what it
 * says, so these are re-checked against the live record at send time.
 */
const LINK_CHECKED_KINDS: ReadonlySet<string> = new Set([
  "waitlist_offer",
  "offer_reminder",
  "seat_reserved",
  "reservation_reminder",
]);

/**
 * Whether this notification's action link is still safe to send, given the
 * *current* state of the registration/offer it points at. Never re-derives
 * business state — only reads it.
 */
function actionLinkStillValid(row: PendingRow, now: number): boolean {
  if (!LINK_CHECKED_KINDS.has(row.kind)) return true;
  if (row.kind === "waitlist_offer" || row.kind === "offer_reminder") {
    return row.offer_status === "sent";
  }
  if (row.kind === "seat_reserved" || row.kind === "reservation_reminder") {
    if (!["seat_reserved", "requirements_pending"].includes(row.registration_status ?? "")) return false;
    const expiresAt = row.reservation_expires_at ? Number(row.reservation_expires_at) : null;
    return expiresAt == null || expiresAt > now;
  }
  return true;
}

/**
 * Send one notification and record the delivery outcome.
 *
 * Returns the resulting `email_status`. A missing provider configuration is
 * recorded as `skipped`, not `failed`: a development environment with no mail
 * key should not fill the admin retry queue with false alarms.
 *
 * Every call — success, failure, or skip — is one delivery attempt: the
 * counter and timestamp advance regardless of outcome, so the admin view can
 * always answer "how many times, and when last".
 */
export async function deliverNotification(
  notificationId: string,
  options?: { retriedByUserId?: string | null },
): Promise<"sent" | "failed" | "skipped"> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT n.id, n.kind, n.title, n.body, n.action_label, n.action_href, n.email_status,
              p.email AS guardian_email, p.name AS guardian_name,
              s.name AS student_name, pr.name AS program_name, r.status AS registration_status,
              r.reservation_expires_at,
              (SELECT o.status FROM waitlist_offers o
                WHERE o.registration_id = n.registration_id
                ORDER BY o.created_at DESC LIMIT 1) AS offer_status
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
  const alreadySent = row.email_status === "sent";

  const finish = async (status: "sent" | "failed" | "skipped", error?: string) => {
    await db
      .prepare(
        `UPDATE family_notifications
            SET email_status = ?, email_error = ?, updated_at = ?,
                delivery_attempts = delivery_attempts + 1, last_attempt_at = ?,
                last_retry_by_user_id = COALESCE(?, last_retry_by_user_id)
          WHERE id = ?`,
      )
      .run(status, error ?? null, now, now, options?.retriedByUserId ?? null, notificationId);
    return status;
  };

  if (!row.guardian_email) return finish("skipped", "No guardian email on file.");
  if (!transactionalEmailReady()) return finish("skipped", "Email delivery is not configured.");

  // Idempotency guard: this only ever re-sends a message, never re-runs the
  // state change that produced it. If the link this message points at is no
  // longer current (offer answered/expired, reservation confirmed/released),
  // sending it again would be actively misleading, so it is skipped rather
  // than delivered with a dead action.
  const linkValid = actionLinkStillValid(row, now);
  if (!linkValid) {
    return finish("skipped", "The linked action is no longer current; the registration has moved on since this was queued.");
  }

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

  // A retry of a message already marked 'sent' may be reaching a family who
  // already received it — say so plainly rather than pretending this is the
  // first attempt.
  const retryNote = alreadySent
    ? "You may have already received an earlier copy of this message; this is a resend requested by BOW staff."
    : null;

  try {
    const delivered = await sendTransactionalEmail({
      to: row.guardian_email,
      subject: `BOW Sports Capital — ${row.title}`,
      ...renderTransactionalEmail({
        preheader: row.body ?? row.title,
        heading: row.title,
        paragraphs: [row.guardian_name ? `Hi ${row.guardian_name},` : "Hello,", row.body ?? row.title].filter(
          Boolean,
        ),
        details,
        cta: actionUrl && row.action_label ? { label: row.action_label, url: actionUrl } : undefined,
        note: [retryNote, "Reply to this email or use the contact page if you need help with this."]
          .filter(Boolean)
          .join(" "),
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

/**
 * Retry one delivery from the admin communications view. Retry-safe by
 * construction: it never touches `program_registrations` or any other
 * business table, only the notification row and the outbound send — so a
 * retry can never re-run the seat/offer/requirement mutation that produced
 * the message, and calling it twice costs at most two emails, never two
 * seats. Allowed from any terminal state (`failed` or `sent`), not only
 * `failed`, so admins can knowingly resend a delivered message.
 */
export async function retryNotification(
  notificationId: string,
  retriedByUserId?: string | null,
): Promise<"sent" | "failed" | "skipped"> {
  return deliverNotification(notificationId, { retriedByUserId: retriedByUserId ?? null });
}

/* ===================================================================== */
/* Admin delivery visibility                                              */
/* ===================================================================== */

export interface DeliveryFeedRow {
  id: string;
  kind: string;
  kindLabel: string;
  title: string;
  urgency: string;
  createdAt: number;
  guardianEmail: string | null;
  guardianName: string | null;
  studentName: string | null;
  programName: string | null;
  channel: "email";
  emailStatus: string;
  emailError: string | null;
  deliveryAttempts: number;
  lastAttemptAt: number | null;
  lastRetriedByUserId: string | null;
  requiresAcknowledgment: boolean;
  acknowledgedAt: number | null;
}

interface DeliveryFeedDbRow {
  id: string;
  kind: string;
  title: string;
  urgency: string;
  created_at: string;
  guardian_email: string | null;
  guardian_name: string | null;
  student_name: string | null;
  program_name: string | null;
  email_status: string;
  email_error: string | null;
  delivery_attempts: number;
  last_attempt_at: string | null;
  last_retry_by_user_id: string | null;
  requires_acknowledgment: boolean;
  acknowledged_at: string | null;
}

/**
 * Read model for the admin communications view: every notification with what
 * was sent, to whom, how, and its delivery/retry state. Read-only — this
 * module never mutates on read.
 */
export async function listDeliveryFeed(options?: {
  emailStatus?: "not_sent" | "queued" | "sent" | "failed" | "skipped";
  limit?: number;
}): Promise<DeliveryFeedRow[]> {
  const db = getDb();
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const statusFilter = options?.emailStatus ? "AND n.email_status = ?" : "";
  const params: unknown[] = options?.emailStatus ? [options.emailStatus, limit] : [limit];
  const rows = (await db
    .prepare(
      `SELECT n.id, n.kind, n.title, n.urgency, n.created_at, n.email_status, n.email_error,
              n.delivery_attempts, n.last_attempt_at, n.last_retry_by_user_id,
              n.requires_acknowledgment, n.acknowledged_at,
              p.email AS guardian_email, p.name AS guardian_name,
              s.name AS student_name, pr.name AS program_name
         FROM family_notifications n
         LEFT JOIN people p ON p.id = n.person_id
         LEFT JOIN students s ON s.id = n.student_id
         LEFT JOIN programs pr ON pr.id = n.program_id
        WHERE 1 = 1 ${statusFilter}
        ORDER BY n.created_at DESC
        LIMIT ?`,
    )
    .all(...params)) as unknown as DeliveryFeedDbRow[];

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    kindLabel: notificationLabel(row.kind),
    title: row.title,
    urgency: row.urgency,
    createdAt: Number(row.created_at),
    guardianEmail: row.guardian_email,
    guardianName: row.guardian_name,
    studentName: row.student_name,
    programName: row.program_name,
    // Delivery is email-only: no SMS provider is configured, so no SMS
    // channel, status, or "we texted you" copy is ever surfaced here.
    channel: "email",
    emailStatus: row.email_status,
    emailError: row.email_error,
    deliveryAttempts: Number(row.delivery_attempts ?? 0),
    lastAttemptAt: row.last_attempt_at != null ? Number(row.last_attempt_at) : null,
    lastRetriedByUserId: row.last_retry_by_user_id,
    requiresAcknowledgment: row.requires_acknowledgment,
    acknowledgedAt: row.acknowledged_at != null ? Number(row.acknowledged_at) : null,
  }));
}
