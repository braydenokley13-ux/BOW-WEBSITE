"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole, requireStaff } from "@/lib/dal";
import { isPartnerOrgType, SELF_PACED_ORG_ID, type PartnerOrgType } from "@/lib/account";
import { logActivity } from "@/lib/hiring";
import { revalidateEntity } from "@/lib/routes";
import { clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const PARTNER_LIFECYCLE_STATUSES = ["prospect", "active", "paused", "closed"] as const;
const PARTNER_RISK_TITLE = "Restore partner readiness";
const PARTNER_RISK_RECOMMENDATION = "Reactivate the partner, or replan or close the Program before delivery continues.";
const PARTNER_ACCESS_RISK_TITLE = "Reconcile paused partner access";
const PARTNER_ACCESS_RISK_RECOMMENDATION = "Resume the partner, retire its legacy delivery, or migrate that delivery into an owned Program.";
const HISTORICAL_PROGRAM_STAGES = ["completed", "renewal_review", "renewed", "closed"] as const;

export type PartnerLifecycleStatus = (typeof PARTNER_LIFECYCLE_STATUSES)[number];

const PARTNER_LIFECYCLE_TRANSITIONS: Record<PartnerLifecycleStatus, readonly PartnerLifecycleStatus[]> = {
  prospect: ["active", "closed"],
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: [],
};

export interface PartnerLifecycleInput {
  organizationId: string;
  expectedStatus: PartnerLifecycleStatus;
  nextStatus: PartnerLifecycleStatus;
  reason?: string;
  confirmPermanent?: boolean;
}

export interface PartnerLifecycleResult extends ActionResult {
  status?: PartnerLifecycleStatus;
  riskWorkCreated?: number;
  riskWorkResolved?: number;
  sessionsRevoked?: number;
  invitationsRevoked?: number;
  profileConsentsRevoked?: number;
  passwordResetTokensConsumed?: number;
}

class PartnerLifecycleError extends Error {}

function isPartnerLifecycleStatus(value: unknown): value is PartnerLifecycleStatus {
  return typeof value === "string"
    && PARTNER_LIFECYCLE_STATUSES.includes(value as PartnerLifecycleStatus);
}

function partnerStatusLabel(status: PartnerLifecycleStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function closeBlockerMessage(programs: number, cohorts: number, classes: number): string {
  const parts = [
    programs ? `${programs} current Program${programs === 1 ? "" : "s"}` : null,
    cohorts ? `${cohorts} active or enrolling Cohort${cohorts === 1 ? "" : "s"}` : null,
    classes ? `${classes} current Class${classes === 1 ? "" : "es"}` : null,
  ].filter((part): part is string => Boolean(part));
  return `Close blocked: ${parts.join(", ")} still ${parts.length === 1 ? "relies" : "rely"} on this partner. Complete, cancel, or close that operating work first.`;
}

/**
 * Staff-owned Organization lifecycle. Access revocation, audit history, and
 * downstream Program Work commit with the status change under one writer lock.
 */
export async function transitionPartnerLifecycle(input: PartnerLifecycleInput): Promise<PartnerLifecycleResult> {
  const me = await requireStaff();
  const organizationId = typeof input?.organizationId === "string" ? input.organizationId.trim() : "";
  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
  if (!organizationId || organizationId.length > 100) return { ok: false, error: "Choose a valid partner." };
  if (!isPartnerLifecycleStatus(input?.expectedStatus) || !isPartnerLifecycleStatus(input?.nextStatus)) {
    return { ok: false, error: "Choose a valid partner status." };
  }
  if (reason.length > 1000) return { ok: false, error: "Keep the lifecycle reason to 1,000 characters or fewer." };
  if ((input.nextStatus === "paused" || input.nextStatus === "closed") && !reason) {
    return { ok: false, error: `Explain why this partnership is being ${input.nextStatus}.` };
  }
  if (input.nextStatus === "closed" && input.confirmPermanent !== true) {
    return { ok: false, error: "Confirm that closing this partner is permanent." };
  }
  if (!PARTNER_LIFECYCLE_TRANSITIONS[input.expectedStatus].includes(input.nextStatus)) {
    return {
      ok: false,
      error: input.expectedStatus === "closed"
        ? "Closed partner records are permanent history and cannot be reopened."
        : `A partner cannot move from ${input.expectedStatus} to ${input.nextStatus}.`,
    };
  }

  const db = getDb();
  const now = Date.now();
  let affectedProgramIds: string[] = [];
  let riskWorkCreated = 0;
  let riskWorkResolved = 0;
  let sessionsRevoked = 0;
  let invitationsRevoked = 0;
  let profileConsentsRevoked = 0;
  let passwordResetTokensConsumed = 0;
  let revokedPublicProfileSlugs: string[] = [];
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const organization = (await db.prepare(
          "SELECT id, name, type, status FROM organizations WHERE id = ?",
        ).get(organizationId)) as { id: string; name: string; type: string; status: string } | undefined;
    if (!organization) throw new PartnerLifecycleError("This partner no longer exists.");
    if (organization.id === SELF_PACED_ORG_ID || organization.type.trim().toLowerCase() === "bow") {
      throw new PartnerLifecycleError("BOW's own operating organization cannot be changed from the partner lifecycle.");
    }
    if (!isPartnerLifecycleStatus(organization.status)) {
      throw new PartnerLifecycleError("This organization has an unsupported lifecycle status.");
    }
    if (organization.status !== input.expectedStatus) {
      throw new PartnerLifecycleError(
        `This partner is now ${organization.status}. Refresh before changing it again.`,
      );
    }
    if (!PARTNER_LIFECYCLE_TRANSITIONS[organization.status].includes(input.nextStatus)) {
      throw new PartnerLifecycleError(
        organization.status === "closed"
          ? "Closed partner records are permanent history and cannot be reopened."
          : `A partner cannot move from ${organization.status} to ${input.nextStatus}.`,
      );
    }

    const affectedPrograms = (await db.prepare(
          `SELECT p.id, p.name, p.stage, p.owner_user_id,
              owner.role AS owner_role, owner.status AS owner_status
         FROM programs p
         LEFT JOIN users owner ON owner.id = p.owner_user_id
        WHERE p.partner_org_id = ?
          AND p.stage NOT IN (${HISTORICAL_PROGRAM_STAGES.map(() => "?").join(", ")})
        ORDER BY p.updated_at DESC`,
        ).all(organizationId, ...HISTORICAL_PROGRAM_STAGES)) as {
      id: string;
      name: string;
      stage: string;
      owner_user_id: string | null;
      owner_role: string | null;
      owner_status: string | null;
    }[];
    affectedProgramIds = affectedPrograms.map((program) => program.id);

    const activeCohorts = (await db.prepare(
          "SELECT COUNT(*) AS count FROM cohorts WHERE org_id = ? AND status IN ('active','enrolling')",
        ).get(organizationId)) as { count: number };
    const currentClasses = (await db.prepare(
          `SELECT COUNT(*) AS count
         FROM classes c
        WHERE c.status NOT IN ('completed','cancelled')
          AND (
            c.partner_org_id = ?
            OR EXISTS (
              SELECT 1 FROM programs p
               WHERE p.id = c.program_id AND p.partner_org_id = ?
            )
          )`,
        ).get(organizationId, organizationId)) as { count: number };
    const currentLegacyClasses = (await db.prepare(
          `SELECT COUNT(*) AS count
         FROM classes c
        WHERE c.partner_org_id = ?
          AND c.status NOT IN ('completed','cancelled')
          AND NOT EXISTS (
            SELECT 1 FROM programs p
             WHERE p.id = c.program_id AND p.partner_org_id = ?
          )`,
        ).get(organizationId, organizationId)) as { count: number };

    if (input.nextStatus === "closed") {
      if (affectedPrograms.length || activeCohorts.count || currentClasses.count) {
        throw new PartnerLifecycleError(
          closeBlockerMessage(affectedPrograms.length, activeCohorts.count, currentClasses.count),
        );
      }
    }

    const updated = (await db.prepare(
          "UPDATE organizations SET status = ? WHERE id = ? AND status = ?",
        ).run(input.nextStatus, organizationId, organization.status));
    if (updated.changes !== 1) throw new PartnerLifecycleError("This partner changed. Refresh and try again.");

    if (input.nextStatus === "paused" || input.nextStatus === "closed") {
      invitationsRevoked = Number((await db.prepare(
                  "UPDATE invitations SET status = 'revoked' WHERE org_id = ? AND status = 'pending'",
                ).run(organizationId)).changes);
      sessionsRevoked = Number((await db.prepare(
                  "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE org_id = ?)",
                ).run(organizationId)).changes);
      passwordResetTokensConsumed = Number((await db.prepare(
                  `UPDATE password_reset_tokens
            SET consumed_at = ?
          WHERE consumed_at IS NULL
            AND user_id IN (SELECT id FROM users WHERE org_id = ?)`,
                ).run(now, organizationId)).changes);
      revokedPublicProfileSlugs = ((await db.prepare(
              `SELECT c.public_slug
           FROM profile_sharing_consents c
           JOIN users u ON u.id = c.student_user_id
          WHERE c.revoked_at IS NULL AND u.org_id = ?`,
            ).all(organizationId)) as { public_slug: string }[]).map((row) => row.public_slug);
      profileConsentsRevoked = Number((await db.prepare(
                  `UPDATE profile_sharing_consents
            SET revoked_by_user_id = ?, revoked_at = ?, discoverable = 0,
                notes = CASE
                  WHEN notes IS NULL OR trim(notes) = '' THEN ?
                  ELSE notes || char(10) || ?
                END
          WHERE revoked_at IS NULL
            AND student_user_id IN (SELECT id FROM users WHERE org_id = ?)`,
                ).run(
                  me.id,
                  now,
                  `Revoked when partner was ${input.nextStatus}.`,
                  `Revoked when partner was ${input.nextStatus}.`,
                  organizationId,
                )).changes);

      for (const program of affectedPrograms) {
        const ownerUserId = program.owner_user_id
          && program.owner_status === "active"
          && (program.owner_role === "admin" || program.owner_role === "growth")
          ? program.owner_user_id
          : me.id;
        const existing = (await db.prepare(
                  `SELECT id
             FROM tasks
            WHERE entity_type = 'program' AND entity_id = ?
              AND status = 'open' AND kind = 'issue'
              AND title = ? AND recommended_action = ?
            LIMIT 1`,
                ).get(program.id, PARTNER_RISK_TITLE, PARTNER_RISK_RECOMMENDATION)) as { id: string } | undefined;
        const context = `${organization.name} is ${input.nextStatus}. ${reason}`;
        if (existing) {
          (await db.prepare(
                        "UPDATE tasks SET owner_user_id = ?, priority = 'high', context = ?, updated_at = ? WHERE id = ? AND status = 'open'",
                      ).run(ownerUserId, context, now, existing.id));
          continue;
        }
        const taskId = `wrk-${randomUUID().slice(0, 12)}`;
        (await db.prepare(
                    `INSERT INTO tasks
            (id, title, owner_user_id, due_at, status, kind, priority, context, recommended_action,
             entity_type, entity_id, handoff_to_founder, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'open', 'issue', 'high', ?, ?, 'program', ?, 0, ?, ?)`,
                  ).run(
                    taskId,
                    PARTNER_RISK_TITLE,
                    ownerUserId,
                    now + 3 * 24 * 60 * 60 * 1000,
                    context,
                    PARTNER_RISK_RECOMMENDATION,
                    program.id,
                    now,
                    now,
                  ));
        riskWorkCreated += 1;
        (await logActivity(
                    "task",
                    taskId,
                    "created",
                    `Created automatically because ${organization.name} moved to ${input.nextStatus}.`,
                    me.id,
                  ));
        (await logActivity(
                    "program",
                    program.id,
                    "partner_risk",
                    `${organization.name} moved to ${input.nextStatus}. Owned partner-readiness Work was created.`,
                    me.id,
                  ));
      }
      if (input.nextStatus === "paused" && (activeCohorts.count > 0 || currentLegacyClasses.count > 0)) {
        const existingAccessWork = (await db.prepare(
                  `SELECT id
             FROM tasks
            WHERE entity_type = 'organization' AND entity_id = ?
              AND status = 'open' AND kind = 'issue'
              AND title = ? AND recommended_action = ?
            LIMIT 1`,
                ).get(organizationId, PARTNER_ACCESS_RISK_TITLE, PARTNER_ACCESS_RISK_RECOMMENDATION)) as
          | { id: string }
          | undefined;
        const accessContext = `${organization.name} is paused. ${activeCohorts.count} active or enrolling Cohort${activeCohorts.count === 1 ? "" : "s"} and ${currentLegacyClasses.count} current legacy Class${currentLegacyClasses.count === 1 ? "" : "es"} require an explicit operating decision. Reason: ${reason}`;
        if (existingAccessWork) {
          (await db.prepare(
                        "UPDATE tasks SET owner_user_id = ?, priority = 'high', context = ?, updated_at = ? WHERE id = ? AND status = 'open'",
                      ).run(me.id, accessContext, now, existingAccessWork.id));
        } else {
          const taskId = `wrk-${randomUUID().slice(0, 12)}`;
          (await db.prepare(
                        `INSERT INTO tasks
              (id, title, owner_user_id, due_at, status, kind, priority, context, recommended_action,
               entity_type, entity_id, handoff_to_founder, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'open', 'issue', 'high', ?, ?, 'organization', ?, 0, ?, ?)`,
                      ).run(
                        taskId,
                        PARTNER_ACCESS_RISK_TITLE,
                        me.id,
                        now + 3 * 24 * 60 * 60 * 1000,
                        accessContext,
                        PARTNER_ACCESS_RISK_RECOMMENDATION,
                        organizationId,
                        now,
                        now,
                      ));
          riskWorkCreated += 1;
          (await logActivity(
                        "task",
                        taskId,
                        "created",
                        `Created automatically because ${organization.name} paused with legacy delivery access to reconcile.`,
                        me.id,
                      ));
        }
      }
      if (input.nextStatus === "closed") {
        const retiredLifecycleTasks = (await db.prepare(
                  `SELECT t.id, t.entity_id
             FROM tasks t
             JOIN programs p ON p.id = t.entity_id AND t.entity_type = 'program'
            WHERE p.partner_org_id = ?
              AND t.status = 'open' AND t.kind = 'issue'
              AND t.title = ? AND t.recommended_action = ?`,
                ).all(organizationId, PARTNER_RISK_TITLE, PARTNER_RISK_RECOMMENDATION)) as {
          id: string;
          entity_id: string;
        }[];
        affectedProgramIds = [...new Set([
          ...affectedProgramIds,
          ...retiredLifecycleTasks.map((task) => task.entity_id),
        ])];
        for (const task of retiredLifecycleTasks) {
          const completed = (await db.prepare(
                      `UPDATE tasks
                SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
              WHERE id = ? AND status = 'open'`,
                    ).run(now, `${organization.name} closed after its delivery records became historical.`, now, task.id));
          if (completed.changes !== 1) throw new PartnerLifecycleError("Partner-readiness Work changed. Refresh and try again.");
          riskWorkResolved += 1;
          (await logActivity("task", task.id, "completed", `${organization.name} closed with no current delivery work.`, me.id));
          (await logActivity("program", task.entity_id, "partner_risk_resolved", `${organization.name} closed after delivery became historical.`, me.id));
        }
        const retiredAccessTasks = (await db.prepare(
                  `SELECT id
             FROM tasks
            WHERE entity_type = 'organization' AND entity_id = ?
              AND status = 'open' AND kind = 'issue'
              AND title = ? AND recommended_action = ?`,
                ).all(organizationId, PARTNER_ACCESS_RISK_TITLE, PARTNER_ACCESS_RISK_RECOMMENDATION)) as { id: string }[];
        for (const task of retiredAccessTasks) {
          const completed = (await db.prepare(
                      `UPDATE tasks
                SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
              WHERE id = ? AND status = 'open'`,
                    ).run(now, `${organization.name} closed after its legacy delivery became historical.`, now, task.id));
          if (completed.changes !== 1) throw new PartnerLifecycleError("Partner-access Work changed. Refresh and try again.");
          riskWorkResolved += 1;
          (await logActivity("task", task.id, "completed", `${organization.name} closed with no current legacy delivery.`, me.id));
        }
      }
    } else if (input.nextStatus === "active") {
      const lifecycleTasks = (await db.prepare(
              `SELECT t.id, t.entity_id
           FROM tasks t
           JOIN programs p ON p.id = t.entity_id AND t.entity_type = 'program'
          WHERE p.partner_org_id = ?
            AND t.status = 'open' AND t.kind = 'issue'
            AND t.title = ? AND t.recommended_action = ?`,
            ).all(organizationId, PARTNER_RISK_TITLE, PARTNER_RISK_RECOMMENDATION)) as {
        id: string;
        entity_id: string;
      }[];
      affectedProgramIds = [...new Set([...affectedProgramIds, ...lifecycleTasks.map((task) => task.entity_id)])];
      for (const task of lifecycleTasks) {
        const completed = (await db.prepare(
                  `UPDATE tasks
              SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
            WHERE id = ? AND status = 'open'`,
                ).run(now, `${organization.name} reactivated; the lifecycle risk is cleared.`, now, task.id));
        if (completed.changes !== 1) throw new PartnerLifecycleError("Partner-readiness Work changed. Refresh and try again.");
        riskWorkResolved += 1;
        (await logActivity("task", task.id, "completed", `${organization.name} reactivated.`, me.id));
        (await logActivity("program", task.entity_id, "partner_risk_resolved", `${organization.name} reactivated.`, me.id));
      }
      const accessTasks = (await db.prepare(
              `SELECT id
           FROM tasks
          WHERE entity_type = 'organization' AND entity_id = ?
            AND status = 'open' AND kind = 'issue'
            AND title = ? AND recommended_action = ?`,
            ).all(organizationId, PARTNER_ACCESS_RISK_TITLE, PARTNER_ACCESS_RISK_RECOMMENDATION)) as { id: string }[];
      for (const task of accessTasks) {
        const completed = (await db.prepare(
                  `UPDATE tasks
              SET status = 'done', completed_at = ?, completion_note = ?, updated_at = ?
            WHERE id = ? AND status = 'open'`,
                ).run(now, `${organization.name} reactivated; legacy partner access can resume.`, now, task.id));
        if (completed.changes !== 1) throw new PartnerLifecycleError("Partner-access Work changed. Refresh and try again.");
        riskWorkResolved += 1;
        (await logActivity("task", task.id, "completed", `${organization.name} reactivated.`, me.id));
      }
    }

    const accessSummary = input.nextStatus === "paused" || input.nextStatus === "closed"
      ? ` Revoked ${sessionsRevoked} session${sessionsRevoked === 1 ? "" : "s"}, ${invitationsRevoked} pending invitation${invitationsRevoked === 1 ? "" : "s"}, ${passwordResetTokensConsumed} password-reset link${passwordResetTokensConsumed === 1 ? "" : "s"}, and ${profileConsentsRevoked} public-profile consent${profileConsentsRevoked === 1 ? "" : "s"}.${riskWorkResolved ? ` Resolved ${riskWorkResolved} retired partner-readiness Work item${riskWorkResolved === 1 ? "" : "s"}.` : ""}`
      : riskWorkResolved
        ? ` Resolved ${riskWorkResolved} partner-readiness Work item${riskWorkResolved === 1 ? "" : "s"}.`
        : "";
    (await logActivity(
            "organization",
            organizationId,
            "lifecycle",
            `Partner moved from ${partnerStatusLabel(organization.status)} to ${partnerStatusLabel(input.nextStatus)}.${reason ? ` Reason: ${reason}` : ""}${accessSummary}`,
            me.id,
          ));

    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    if (error instanceof PartnerLifecycleError) return { ok: false, error: error.message };
    throw error;
  }

  revalidateEntity("organization", organizationId);
  revalidatePath("/app/programs");
  revalidatePath("/app/classes");
  revalidatePath("/app/locations");
  for (const programId of affectedProgramIds) revalidatePath(`/app/programs/${programId}`);
  for (const publicSlug of revokedPublicProfileSlugs) revalidatePath(`/profile/${publicSlug}`);
  revalidatePath("/app/inquiries");
  return {
    ok: true,
    status: input.nextStatus,
    riskWorkCreated,
    riskWorkResolved,
    sessionsRevoked,
    invitationsRevoked,
    profileConsentsRevoked,
    passwordResetTokensConsumed,
  };
}

/* ============================================================
 * Partner / school landing pages — server actions (Feature 5).
 *
 * `submitDemoRequest` is PUBLIC (no auth): it's the "Request a Demo"
 * form on every partner page. It validates its own bounded payload; the
 * general marketing forms use `submitPublicInquiry` in public-forms.ts. It
 * never sends email — it just records the request for the admin inbox.
 *
 * `createPartnerOrg` is admin-only and is imported by the admin
 * "Partners" tab to spin up a new branded landing page.
 * ============================================================ */

/**
 * Public — submitted from the "Request a Demo" form on a partner page.
 * Validates the requester's name + email and confirms the org slug
 * exists, then records the request. Does NOT send any email.
 */
export async function submitDemoRequest(
  orgSlug: string,
  requesterName: string,
  requesterEmail: string,
  message: string,
): Promise<{ ok: boolean }> {
  const slug = (orgSlug || "").trim().toLowerCase();
  const name = (requesterName || "").trim();
  const email = (requesterEmail || "").trim().toLowerCase();
  const cleanMessage = (message || "").trim();
  if (!slug || !name || !/.+@.+\..+/.test(email)) return { ok: false };
  if (slug.length > 120 || name.length > 120 || email.length > 200 || cleanMessage.length > 2000) return { ok: false };

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("demo-request-network", address, {
          limit: 15,
          windowMs: 24 * 60 * 60 * 1000,
          blockMs: 24 * 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return { ok: false };
  }
  const identityLimit = (await consumeRateLimit("demo-request-email", email, {
      limit: 4,
      windowMs: 7 * 24 * 60 * 60 * 1000,
      blockMs: 7 * 24 * 60 * 60 * 1000,
    }));
  if (!identityLimit.allowed) return { ok: false };

  const db = getDb();
  const org = (await db.prepare("SELECT 1 FROM partner_orgs WHERE slug = ?").get(slug));
  if (!org) return { ok: false };

  const id = `dr-${randomUUID().slice(0, 12)}`;
  (await db.prepare(
        "INSERT INTO demo_requests (id, org_slug, requester_name, requester_email, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, slug, name, email, cleanMessage, Date.now()));

  // Surface the new request in the staff Partners workflow.
  revalidatePath("/app/partners");
  return { ok: true };
}

export interface NewPartnerOrgInput {
  name: string;
  slug: string;
  orgType: string;
  contactName?: string;
  contactEmail?: string;
  customHeadline: string;
  customBody: string;
}

export interface CreatePartnerOrgResult {
  ok: boolean;
  slug?: string;
  error?: "slug-taken" | "invalid";
}

/**
 * Admin-only — create a new branded partner landing page. Slugifies and
 * validates the slug (lowercase, `[a-z0-9-]`), ensures it's unique, and
 * validates the org type against the shared `PartnerOrgType` set.
 */
export async function createPartnerOrg(input: NewPartnerOrgInput): Promise<CreatePartnerOrgResult> {
  await requireRole("admin");

  const name = (input.name || "").trim();
  const slug = slugify(input.slug || input.name || "");
  const orgType = (input.orgType || "").trim();
  const customHeadline = (input.customHeadline || "").trim();
  const customBody = (input.customBody || "").trim();

  if (!name || !slug || !customHeadline || !customBody || !isPartnerOrgType(orgType)) {
    return { ok: false, error: "invalid" };
  }

  const db = getDb();
  const existing = (await db.prepare("SELECT 1 FROM partner_orgs WHERE slug = ?").get(slug));
  if (existing) return { ok: false, error: "slug-taken" };

  const id = `po-${randomUUID().slice(0, 12)}`;
  (await db.prepare(
        "INSERT INTO partner_orgs (id, name, slug, org_type, contact_name, contact_email, custom_headline, custom_body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        name,
        slug,
        orgType as PartnerOrgType,
        (input.contactName || "").trim(),
        (input.contactEmail || "").trim(),
        customHeadline,
        customBody,
        Date.now(),
      ));

  revalidatePath("/admin");
  return { ok: true, slug };
}

/** Lowercase, hyphenate, and strip a string down to a URL-safe `[a-z0-9-]` slug. */
function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Staff. Creates a follow-up task from a website "Request a Demo"
 * submission and marks it dispositioned so it drops out of the
 * pending queue on /app/partners. If an `organizations` row matches
 * the demo request's org_slug (via partner_orgs.name) the task links
 * to that organization; otherwise it's created unlinked.
 */
export async function createFollowUpFromDemoRequest(demoRequestId: string): Promise<ActionResult & { taskId?: string }> {
  const me = await requireStaff();
  const id = typeof demoRequestId === "string" ? demoRequestId.trim() : "";
  if (!id || id.length > 100) return { ok: false, error: "Choose a valid demo request." };
  const db = getDb();
  let entityId: string | null = null;
  const taskId = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const request = (await db.prepare("SELECT * FROM demo_requests WHERE id = ?").get(id)) as
      | { id: string; org_slug: string; requester_name: string; requester_email: string; dispositioned: number }
      | undefined;
    if (!request) throw new PartnerLifecycleError("This demo request no longer exists.");
    if (request.dispositioned) throw new PartnerLifecycleError("This demo request was already dispositioned.");

    const partnerOrg = (await db.prepare("SELECT name FROM partner_orgs WHERE slug = ?").get(request.org_slug)) as { name: string } | undefined;
    if (partnerOrg) {
      const org = (await db.prepare("SELECT id FROM organizations WHERE lower(trim(name)) = lower(trim(?))").get(partnerOrg.name)) as
        | { id: string }
        | undefined;
      entityId = org?.id ?? null;
    }

    (await db.prepare(
            "INSERT INTO tasks (id, title, owner_user_id, due_at, status, entity_type, entity_id, handoff_to_founder, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, ?, 0, ?, ?)",
          ).run(
            taskId,
            `Follow up: demo request from ${request.requester_name} (${request.requester_email})`,
            me.id,
            null,
            entityId ? "organization" : null,
            entityId,
            now,
            now,
          ));

    const dispositioned = (await db.prepare(
          "UPDATE demo_requests SET dispositioned = 1 WHERE id = ? AND dispositioned = 0",
        ).run(id));
    if (dispositioned.changes !== 1) throw new PartnerLifecycleError("This demo request changed. Refresh and try again.");
    (await logActivity("task", taskId, "created", "Created from a website demo request.", me.id));
    if (entityId) (await logActivity("organization", entityId, "note", `Follow-up task created from demo request (${request.requester_name}).`, me.id));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    if (error instanceof PartnerLifecycleError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/app/partners");
  revalidatePath("/app/tasks");
  if (entityId) revalidateEntity("organization", entityId);
  return { ok: true, taskId };
}
