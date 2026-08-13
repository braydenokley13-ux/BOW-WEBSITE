"use server";

/* ============================================================
 * Partner desk actions — notes, follow-ups, and turning an inquiry into a
 * partner without anyone retyping what the school already told us.
 *
 * Every write lands in a system that already exists: a note is `crm_activity`,
 * a follow-up is a `tasks` row with `kind='follow_up'`, a contact is
 * `organization_people` pointing at the one canonical `people` row. There is
 * no partner-notes table and no second follow-up store.
 *
 * The one rule worth stating out loud: attaching an inquiry to a partner is
 * always an explicit choice — create this new partner, or attach to that one.
 * `organizations` and `partner_orgs` are already joined by name string, and
 * that seam is not allowed to grow a mutation that decides identity by
 * fuzzy-matching a name somebody typed into a public form.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { logActivity, upsertPersonByEmail } from "@/lib/hiring";
import { canonicalDateInZone, DEFAULT_TIME_ZONE } from "@/lib/timezone";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function organizationExists(id: string): Promise<boolean> {
  return Boolean(await getDb().prepare("SELECT 1 FROM organizations WHERE id = ?").get(id));
}

function revalidatePartner(organizationId: string): void {
  revalidatePath("/app/partners");
  revalidatePath(`/app/partners/${organizationId}`);
  revalidatePath("/app");
}

/* ===================================================================== */

/** A note about a partner is `crm_activity`. There is no notes table. */
export async function addPartnerNote(organizationIdValue: string, bodyValue: string): Promise<ActionResult> {
  const me = await requireStaff();
  const organizationId = clean(organizationIdValue, 100);
  const body = clean(bodyValue, 4000);
  if (!organizationId || !(await organizationExists(organizationId))) {
    return { ok: false, error: "That partner no longer exists." };
  }
  if (body.length < 2) return { ok: false, error: "Write the note before saving it." };

  await logActivity("organization", organizationId, "note", body, me.id);
  revalidatePartner(organizationId);
  return { ok: true };
}

export interface FollowUpInput {
  title: string;
  /** Canonical YYYY-MM-DD. Follow-ups are dated in days. */
  dueOn: string;
}

/**
 * The next thing somebody promised to do about this partner.
 *
 * `tasks` with `kind='follow_up'` and `entity_type='organization'` is what HQ
 * Home's queue already reads, so a follow-up made here is the same row the
 * founder sees on Home the morning it comes due.
 */
export async function scheduleFollowUp(organizationIdValue: string, input: FollowUpInput): Promise<ActionResult> {
  const me = await requireStaff();
  const organizationId = clean(organizationIdValue, 100);
  const title = clean(input?.title, 200);
  const dueOn = clean(input?.dueOn, 10);

  if (!organizationId || !(await organizationExists(organizationId))) {
    return { ok: false, error: "That partner no longer exists." };
  }
  if (title.length < 3) return { ok: false, error: "Say what the follow-up is." };
  if (!DATE_PATTERN.test(dueOn)) return { ok: false, error: "Choose a date for the follow-up." };
  if (dueOn < "2000-01-01" || dueOn > "2100-12-31") return { ok: false, error: "Choose a realistic date." };

  const now = Date.now();
  await getDb()
    .prepare(
      `INSERT INTO tasks (id, title, owner_user_id, doer_user_id, assigner_user_id, due_on, status,
                          workflow_state, kind, priority, entity_type, entity_id, handoff_to_founder,
                          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', 'assigned', 'follow_up', 'normal', 'organization', ?, 0, ?, ?)`,
    )
    .run(`wrk-${randomUUID().slice(0, 12)}`, title, me.id, me.id, me.id, dueOn, organizationId, now, now);

  await logActivity("organization", organizationId, "assigned", `Follow-up set for ${dueOn}: ${title}`, me.id);
  revalidatePartner(organizationId);
  revalidatePath("/app/tasks");
  return { ok: true };
}

/* ===================================================================== */

export type InquiryTarget =
  | { kind: "new"; name: string; type?: string; location?: string }
  | { kind: "existing"; organizationId: string };

export interface ConvertInquiryResult extends ActionResult {
  organizationId?: string;
}

/**
 * An inquiry becomes a partner without anyone retyping it.
 *
 * The school already told us its name, who wrote in, their email, and what
 * they want. That becomes the organization, the `people` row, the
 * `organization_people` relationship, the first note, and a dated follow-up —
 * in one transaction, so a half-converted inquiry cannot exist.
 *
 * The operator chooses the target explicitly. Matching `organizations` by the
 * name typed into a public form is exactly the ambiguous-identity behaviour
 * this codebase is trying to stop spreading, so it is not offered.
 */
export async function convertInquiryToPartner(
  inquiryIdValue: string,
  target: InquiryTarget,
): Promise<ConvertInquiryResult> {
  const me = await requireStaff();
  const inquiryId = clean(inquiryIdValue, 100);
  if (!inquiryId) return { ok: false, error: "Choose an inquiry." };

  const db = getDb();
  const inquiry = (await db
    .prepare("SELECT id, name, email, org_name, summary, message, status, organization_id FROM inquiries WHERE id = ?")
    .get(inquiryId)) as
    | {
        id: string;
        name: string | null;
        email: string | null;
        org_name: string | null;
        summary: string | null;
        message: string | null;
        status: string;
        organization_id: string | null;
      }
    | undefined;
  if (!inquiry) return { ok: false, error: "That inquiry no longer exists." };
  if (inquiry.organization_id) {
    return { ok: true, organizationId: inquiry.organization_id };
  }
  if (!["new", "reviewing", "contacted"].includes(inquiry.status)) {
    return { ok: false, error: "This inquiry has already been closed out." };
  }

  let organizationId: string;
  const created = target?.kind !== "existing";
  let newOrg: { name: string; type: string; location: string } | null = null;
  if (target?.kind === "existing") {
    organizationId = clean(target.organizationId, 100);
    if (!organizationId || !(await organizationExists(organizationId))) {
      return { ok: false, error: "Choose a partner to attach this to." };
    }
  } else {
    const name = clean(target?.name, 160) || clean(inquiry.org_name, 160);
    if (name.length < 2) return { ok: false, error: "Name the partner." };
    organizationId = `org-${randomUUID().slice(0, 12)}`;
    newOrg = {
      name,
      type: clean(target?.kind === "new" ? target.type : "", 60) || "School",
      location: clean(target?.kind === "new" ? target.location : "", 160),
    };
  }

  const now = Date.now();
  const today = canonicalDateInZone(now, DEFAULT_TIME_ZONE);
  const dueOn = addDays(today, 2);
  const sourceKey = `inquiry-convert:${inquiryId}`;

  await db.exec("BEGIN IMMEDIATE");
  try {
    const still = (await db.prepare("SELECT organization_id, status FROM inquiries WHERE id = ?").get(inquiryId)) as
      | { organization_id: string | null; status: string }
      | undefined;
    if (!still) throw new ConvertError("That inquiry no longer exists.");
    if (still.organization_id) throw new ConvertError("Someone already attached this inquiry.");

    // Creating the partner belongs inside the transaction: a rollback after
    // this point must not leave an organization nobody asked for.
    if (newOrg) {
      await db
        .prepare("INSERT INTO organizations (id, name, type, location, status) VALUES (?, ?, ?, ?, 'prospect')")
        .run(organizationId, newOrg.name, newOrg.type, newOrg.location);
    }

    // The person who wrote in is a Person, and becomes a contact on the
    // organization. One canonical identity, reached by email — the same
    // upsert the application pipeline uses.
    let personId: string | null = null;
    const email = clean(inquiry.email, 200).toLowerCase();
    if (email && /.+@.+\..+/.test(email)) {
      personId = await upsertPersonByEmail(clean(inquiry.name, 160) || email, email, "");
      const already = (await db
        .prepare("SELECT id FROM organization_people WHERE organization_id = ? AND person_id = ? AND relationship_type = 'contact'")
        .get(organizationId, personId)) as { id: string } | undefined;
      if (already) {
        await db.prepare("UPDATE organization_people SET active = 1, updated_at = ? WHERE id = ?").run(now, already.id);
      } else {
        await db
          .prepare(
            `INSERT INTO organization_people (id, organization_id, person_id, relationship_type, is_primary, active, created_at, updated_at)
             VALUES (?, ?, ?, 'contact', ?, 1, ?, ?)`,
          )
          .run(`orp-${randomUUID().slice(0, 12)}`, organizationId, personId, created ? 1 : 0, now, now);
      }
    }

    await db
      .prepare("UPDATE inquiries SET organization_id = ?, status = CASE WHEN status = 'new' THEN 'reviewing' ELSE status END WHERE id = ?")
      .run(organizationId, inquiryId);

    const said = clean(inquiry.summary || inquiry.message, 1000);
    await logActivity(
      "organization",
      organizationId,
      "note",
      `From the ${clean(inquiry.org_name, 120) || "partner"} inquiry${inquiry.name ? ` (${clean(inquiry.name, 120)})` : ""}: ${said || "no message"}`,
      me.id,
    );

    const open = (await db.prepare("SELECT id FROM tasks WHERE status = 'open' AND source_key = ?").get(sourceKey)) as
      | { id: string }
      | undefined;
    if (!open) {
      await db
        .prepare(
          `INSERT INTO tasks (id, title, owner_user_id, doer_user_id, assigner_user_id, due_on, status,
                              workflow_state, kind, priority, context, recommended_action,
                              entity_type, entity_id, handoff_to_founder, source_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'open', 'assigned', 'follow_up', 'normal', ?, ?, 'organization', ?, 0, ?, ?, ?)`,
        )
        .run(
          `wrk-${randomUUID().slice(0, 12)}`,
          `Reply to ${clean(inquiry.name, 120) || "the inquiry"}`,
          me.id,
          me.id,
          me.id,
          dueOn,
          said || null,
          "Answer what they asked and find out what they are actually deciding.",
          organizationId,
          sourceKey,
          now,
          now,
        );
    }
    await db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) await db.exec("ROLLBACK");
    if (error instanceof ConvertError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePartner(organizationId);
  revalidatePath("/app/inquiries");
  revalidatePath("/app/tasks");
  return { ok: true, organizationId };
}

class ConvertError extends Error {}

function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
