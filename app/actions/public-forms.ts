"use server";

/* ============================================================
 * Public, unauthenticated forms that feed BOW HQ. Partnership
 * inquiries land as an organization + person + crm_activity note +
 * a staff follow-up task — same shape as the public instructor
 * application in app/actions/instructors.ts.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { logActivity, upsertPersonByEmail, listStaffUserIds } from "@/lib/hiring";
import { createNotification } from "@/lib/notifications";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface PartnershipInquiryInput {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  message?: string;
}

/** PUBLIC — submitted from a marketing partner/get-involved page. No auth guard. */
export async function submitPartnershipInquiry(input: PartnershipInquiryInput): Promise<ActionResult> {
  const orgName = (input.organizationName ?? "").trim();
  const contactName = (input.contactName ?? "").trim();
  const contactEmail = (input.contactEmail ?? "").trim().toLowerCase();
  const message = (input.message ?? "").trim();

  if (!orgName) return { ok: false, error: "Organization name is required." };
  if (orgName.length > 200) return { ok: false, error: "Organization name is too long." };
  if (!contactName) return { ok: false, error: "Contact name is required." };
  if (contactName.length > 120) return { ok: false, error: "Contact name is too long." };
  if (!/.+@.+\..+/.test(contactEmail)) return { ok: false, error: "A valid email is required." };
  if (contactEmail.length > 200) return { ok: false, error: "Email is too long." };
  if (message.length > 2000) return { ok: false, error: "Message is too long." };

  const db = getDb();
  let org = db.prepare("SELECT id FROM organizations WHERE lower(name) = ?").get(orgName.toLowerCase()) as { id: string } | undefined;
  if (!org) {
    const id = `org-${randomUUID().slice(0, 8)}`;
    db.prepare("INSERT INTO organizations (id, name, type, location, status) VALUES (?, ?, 'partner_inquiry', '', 'prospect')").run(
      id,
      orgName.slice(0, 200),
    );
    org = { id };
  }

  const personId = upsertPersonByEmail(contactName.slice(0, 120), contactEmail, "");

  logActivity(
    "organization",
    org.id,
    "note",
    `Partnership inquiry from ${contactName} (${contactEmail}).${message ? ` ${message.slice(0, 500)}` : ""}`,
    null,
  );

  const now = Date.now();
  const taskId = `pfx-${randomUUID().slice(0, 8)}`;
  db.prepare(
    "INSERT INTO tasks (id, title, owner_user_id, due_at, status, entity_type, entity_id, handoff_to_founder, created_at, updated_at) VALUES (?, ?, NULL, ?, 'open', 'organization', ?, 0, ?, ?)",
  ).run(taskId, `Follow up: ${orgName} partnership inquiry`, now + 3 * 24 * 60 * 60 * 1000, org.id, now, now);

  for (const staffId of listStaffUserIds()) {
    createNotification({
      id: `ntf-partner-inquiry-${org.id}-${staffId}-${taskId}`,
      userId: staffId,
      type: "instructor_pipeline",
      title: "New partnership inquiry",
      body: `${orgName} submitted a partnership inquiry.`,
      link: `/app/partners/${org.id}`,
    });
  }

  void personId;
  revalidatePath("/app/partners");
  revalidatePath("/app/tasks");
  return { ok: true };
}
