import "server-only";

import { after } from "next/server";
import { getDb } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { sendTransactionalEmail } from "@/lib/transactional-email";
import { renderPlainBodyEmail } from "@/lib/email-template";

/** Deliver a committed candidate message. The database state is never rolled back for an email failure. */
export function queueCandidateCommunication(communicationId: string, actorUserId: string): void {
  after(async () => {
    const db = getDb();
    try {
      const message = await db.prepare(
        `SELECT id, application_id, recipient, subject, body FROM candidate_communications
          WHERE id = ? AND status = 'queued'`,
      ).get(communicationId) as { id: string; application_id: string; recipient: string; subject: string; body: string } | undefined;
      if (!message) return;
      const sent = await sendTransactionalEmail({
        to: message.recipient,
        subject: message.subject,
        ...renderPlainBodyEmail(message.subject, message.body),
      });
      await db.prepare(
        `UPDATE candidate_communications SET status = ?, sent_at = ?, failure_detail = ?
          WHERE id = ? AND status = 'queued'`,
      ).run(sent ? "sent" : "failed", sent ? Date.now() : null, sent ? null : "Transactional email delivery was not accepted.", message.id);
      if (!sent) {
        await createNotification({
          id: `ntf-candidate-message-${message.id}`,
          userId: actorUserId,
          type: "instructor_pipeline",
          title: "Candidate email delivery failed",
          body: "Open the candidate cockpit to retry or contact the candidate another way.",
          link: `/app/hiring/applications/${message.application_id}`,
        });
      }
    } catch {
      try {
        await db.prepare(
          "UPDATE candidate_communications SET status = 'failed', failure_detail = ? WHERE id = ? AND status = 'queued'",
        ).run("Delivery worker failed before provider acceptance.", communicationId);
      } catch {
        // A database outage leaves the committed queued record available for an operator retry.
      }
    }
  });
}
