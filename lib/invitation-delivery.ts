import "server-only";

import { after } from "next/server";
import { getDb } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { hashOpaqueToken } from "@/lib/security-tokens";
import {
  publicAppOrigin,
  sendTransactionalEmail,
  transactionalEmailReady,
} from "@/lib/transactional-email";

export type InvitationDeliveryState = "queued" | "manual_copy_required";

interface QueueInvitationDeliveryInput {
  invitationId: string;
  token: string;
  email: string;
  role: "student" | "instructor";
  actorUserId: string;
}

function recordDeliveryActivity(
  invitationId: string,
  credentialKey: string,
  actorUserId: string,
  kind: "email_delivered" | "email_delivery_failed",
  body: string,
): void {
  getDb().prepare(
    `INSERT OR IGNORE INTO crm_activity
      (id, entity_type, entity_id, kind, body, actor_user_id, created_at)
     VALUES (?, 'invitation', ?, ?, ?, ?, ?)`,
  ).run(`pfx-invite-${kind}-${credentialKey}`, invitationId, kind, body, actorUserId, Date.now());
}

function notifyDeliveryFailure(
  invitationId: string,
  tokenHash: string,
  actorUserId: string,
  role: "student" | "instructor",
): void {
  const credentialKey = tokenHash.slice(0, 10);
  try {
    recordDeliveryActivity(
      invitationId,
      credentialKey,
      actorUserId,
      "email_delivery_failed",
      "Automated invitation email delivery did not complete. Use the secure copy fallback and verify email configuration before resending.",
    );
  } catch {
    // Still attempt the more visible notification below.
  }
  try {
    createNotification({
      id: `ntf-invite-delivery-${invitationId}-${credentialKey}`,
      userId: actorUserId,
      type: role === "instructor" ? "instructor_pipeline" : "class_ops",
      title: "Invitation needs manual delivery",
      body: "Automated email delivery did not complete. Open Invitations, use the secure copy fallback, and verify email configuration before resending.",
      link: "/app/admin/invitations",
    });
  } catch {
    // The copy fallback was already returned. A database outage is the only
    // condition that can also prevent this staff-visible recovery record.
  }
}

/**
 * Register post-response invitation delivery after the issuing transaction has
 * committed. The callback re-proves that this exact credential is still the
 * current live invitation immediately before sending, so revoke, resend,
 * deletion/anonymization, or replacement makes stale outbound mail a no-op.
 */
export function queueInvitationDelivery(input: QueueInvitationDeliveryInput): InvitationDeliveryState {
  const normalizedEmail = input.email.trim().toLowerCase();
  const tokenHash = hashOpaqueToken(input.token);
  const readyAtQueueTime = transactionalEmailReady();

  after(async () => {
    try {
      const db = getDb();
      const current = db.prepare(
        `SELECT email, role
           FROM invitations
          WHERE id = ? AND token_hash = ? AND status = 'pending' AND expires_at > ?`,
      ).get(input.invitationId, tokenHash, Date.now()) as { email: string; role: string } | undefined;

      // This is an intentional cancellation, not a delivery failure. A revoked,
      // superseded, accepted, expired, or anonymized credential must not send.
      if (
        !current ||
        current.email.trim().toLowerCase() !== normalizedEmail ||
        current.role !== input.role
      ) {
        return;
      }

      const origin = publicAppOrigin();
      const invitationUrl = origin
        ? `${origin}/accept-invitation#token=${encodeURIComponent(input.token)}`
        : null;
      const delivered = Boolean(invitationUrl && await sendTransactionalEmail({
        to: normalizedEmail,
        subject: "Your BOW Sports Capital invitation",
        text:
          `You have been invited to join BOW Sports Capital as ${input.role === "instructor" ? "an instructor" : "a student"}.\n\n` +
          `Accept this invitation within 14 days:\n${invitationUrl}\n\n` +
          "If you were not expecting this invitation, you can ignore this message.",
      }));

      if (delivered) {
        try {
          recordDeliveryActivity(
            input.invitationId,
            tokenHash.slice(0, 10),
            input.actorUserId,
            "email_delivered",
            "Invitation email delivery was accepted by the transactional email provider.",
          );
        } catch {
          // Provider acceptance already happened; do not mislabel it as a
          // delivery failure merely because the audit database is unavailable.
        }
      } else {
        notifyDeliveryFailure(input.invitationId, tokenHash, input.actorUserId, input.role);
      }
    } catch {
      // If the invitation still exists, persist a staff-visible recovery path.
      // A database outage can prevent even that record, but never changes the
      // issuing action's already-committed invitation or leaks its bearer token.
      try {
        const stillCurrent = getDb().prepare(
          `SELECT 1 FROM invitations
            WHERE id = ? AND token_hash = ? AND status = 'pending' AND expires_at > ?
              AND lower(trim(email)) = ?`,
        ).get(input.invitationId, tokenHash, Date.now(), normalizedEmail);
        if (stillCurrent) notifyDeliveryFailure(input.invitationId, tokenHash, input.actorUserId, input.role);
      } catch {
        // No additional safe persistence path exists while the database itself
        // is unavailable. The operator still receives the copy fallback.
      }
    }
  });

  return readyAtQueueTime ? "queued" : "manual_copy_required";
}
