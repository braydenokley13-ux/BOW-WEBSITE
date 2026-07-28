"use server";

/* ============================================================
 * Public, unauthenticated forms that feed BOW HQ. General and
 * partnership inquiries become durable demand records with canonical
 * contact topology, activity, accountable Work, and staff alerts.
 * ============================================================ */

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { logActivity, listStaffUserIds } from "@/lib/hiring";
import { createNotification } from "@/lib/notifications";
import { ensureInquiryTopology } from "@/lib/partner-intake";
import { clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";
import { addCanonicalDays, canonicalDateInZone, DEFAULT_TIME_ZONE, formatCanonicalDate } from "@/lib/timezone";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export type PublicInquirySource = "get_involved" | "sign_up" | "contact";

export interface PublicInquiryInput {
  requestKey: string;
  source: PublicInquirySource;
  name: string;
  email: string;
  type: string;
  orgName?: string;
  summary: string;
}

const PUBLIC_INQUIRY_SOURCE_META: Record<PublicInquirySource, { code: string; label: string }> = {
  get_involved: { code: "involved", label: "Get Involved" },
  sign_up: { code: "signup", label: "program sign-up" },
  contact: { code: "contact", label: "contact page" },
};

interface InquiryReplayRow {
  name: string;
  email: string;
  type: string;
  org_name: string;
  summary: string;
}

function validRequestKey(value: string): boolean {
  return value.length >= 12 && value.length <= 120 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function matchesPublicInquiryReplay(
  replay: InquiryReplayRow,
  payload: { name: string; email: string; type: string; orgName: string; summary: string },
): boolean {
  return replay.name === payload.name
    && replay.email === payload.email
    && replay.type === payload.type
    && replay.org_name === payload.orgName
    && replay.summary === payload.summary;
}

function isLearnerAcquisitionInquiry(source: PublicInquirySource, type: string): boolean {
  const normalized = type.trim().toLowerCase();
  if (source === "sign_up") return normalized === "student" || normalized === "parent";
  if (source === "get_involved") return normalized === "join as a student or family";
  return normalized === "family";
}

async function recordPublicLearnerTouchpoint(
  db: ReturnType<typeof getDb>,
  input: {
    inquiryId: string;
    personId: string;
    source: PublicInquirySource;
    type: string;
    summary: string;
    occurredAt: number;
  },
): Promise<void> {
  if (!isLearnerAcquisitionInquiry(input.source, input.type)) return;
  const touchpointId = `sat-web-${createHash("sha256").update(input.inquiryId).digest("hex").slice(0, 20)}`;
  (await db.prepare(
        `INSERT INTO student_acquisition_touchpoints
      (id, person_id, student_id, channel_id, campaign_id, contributor_id, touchpoint_type,
       occurred_at, occurred_on, timezone, external_key, detail, recorded_by_user_id, source_type, source_id,
       voided_at, voided_by_user_id, void_reason, created_at)
     VALUES (?, ?, NULL, 'gch-direct-inquiry', NULL, NULL, 'inquiry', ?, ?, ?, ?, ?, NULL,
             'public_inquiry', ?, NULL, NULL, NULL, ?)`,
      ).run(
        touchpointId,
        input.personId,
        input.occurredAt,
        canonicalDateInZone(input.occurredAt, DEFAULT_TIME_ZONE),
        DEFAULT_TIME_ZONE,
        `public-inquiry:${input.inquiryId}`,
        `${PUBLIC_INQUIRY_SOURCE_META[input.source].label}: ${input.type}. ${input.summary}`.slice(0, 2000),
        input.inquiryId,
        input.occurredAt,
      ));
}

/**
 * PUBLIC — one durable intake path for the general marketing forms. A browser
 * request key is stable across retries, while every operational side effect
 * commits with the inquiry in one writer transaction.
 */
export async function submitPublicInquiry(input: PublicInquiryInput): Promise<ActionResult> {
  const requestKey = typeof input?.requestKey === "string" ? input.requestKey.trim() : "";
  const source = typeof input?.source === "string" ? input.source : "";
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const type = typeof input?.type === "string" ? input.type.trim() : "";
  const submittedOrgName = typeof input?.orgName === "string" ? input.orgName.trim() : "";
  const orgName = submittedOrgName || "—";
  const summary = typeof input?.summary === "string" ? input.summary.trim() : "";
  const sourceMeta = PUBLIC_INQUIRY_SOURCE_META[source as PublicInquirySource];

  if (!validRequestKey(requestKey)) return { ok: false, error: "Refresh the page and try this submission again." };
  if (!sourceMeta) return { ok: false, error: "Choose a valid inquiry source." };
  if (name.length < 2) return { ok: false, error: "Enter your name so the BOW team knows who to contact." };
  if (name.length > 120) return { ok: false, error: "Keep your name under 120 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (email.length > 200) return { ok: false, error: "Keep your email under 200 characters." };
  if (!type) return { ok: false, error: "Choose what you are reaching out about." };
  if (type.length > 80) return { ok: false, error: "Keep the inquiry type under 80 characters." };
  if (submittedOrgName.length > 200) return { ok: false, error: "Keep the organization name under 200 characters." };
  if (!summary) return { ok: false, error: "Add a short note about what you are looking for." };
  if (summary.length > 2000) return { ok: false, error: "Keep the inquiry details under 2,000 characters." };

  const inquiryId = `iq-web-${sourceMeta.code}-${createHash("sha256").update(requestKey).digest("hex").slice(0, 20)}`;
  const payload = { name, email, type, orgName, summary };
  const db = getDb();
  const replay = (await db.prepare(
      "SELECT name, email, type, org_name, summary FROM inquiries WHERE id = ?",
    ).get(inquiryId)) as InquiryReplayRow | undefined;
  if (replay) {
    return matchesPublicInquiryReplay(replay, payload)
      ? { ok: true }
      : { ok: false, error: "This retry no longer matches the original submission. Start a new form and send it again." };
  }

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("public-inquiry-network", address, {
          limit: 15,
          windowMs: 24 * 60 * 60 * 1000,
          blockMs: 24 * 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) {
      return { ok: false, error: "Too many inquiries were submitted from this network. Try again tomorrow." };
    }
  }
  const identityLimit = (await consumeRateLimit("public-inquiry-email", email, {
      limit: 4,
      windowMs: 7 * 24 * 60 * 60 * 1000,
      blockMs: 7 * 24 * 60 * 60 * 1000,
    }));
  if (!identityLimit.allowed) {
    return { ok: false, error: "This email has already sent several recent inquiries. Contact BOW directly if this is urgent." };
  }

  const now = Date.now();
  const followUpDate = addCanonicalDays(canonicalDateInZone(now), 3);
  const taskId = `wrk-intake-${createHash("sha256").update(inquiryId).digest("hex").slice(0, 16)}`;
  let organizationId: string | null = null;
  let wasReplay = false;
  let transactionOpen = false;
  try {
    (await db.exec("BEGIN IMMEDIATE"));
    transactionOpen = true;
    const lockedReplay = (await db.prepare(
          "SELECT name, email, type, org_name, summary FROM inquiries WHERE id = ?",
        ).get(inquiryId)) as InquiryReplayRow | undefined;
    if (lockedReplay) {
      if (!matchesPublicInquiryReplay(lockedReplay, payload)) throw new Error("request_key_mismatch");
      wasReplay = true;
    } else {
      const topology = (await ensureInquiryTopology(
              db,
              { organizationName: orgName, contactName: name, contactEmail: email },
              { now },
            ));
      organizationId = topology.organizationId;

      (await db.prepare(
                `INSERT INTO inquiries (id, organization_id, name, email, type, org_name, date, status, summary, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
              ).run(
                inquiryId,
                organizationId,
                name,
                email,
                type,
                orgName,
                formatCanonicalDate(canonicalDateInZone(now)),
                summary,
                now,
              ));
      (await recordPublicLearnerTouchpoint(db, {
                inquiryId,
                personId: topology.sourcePersonId,
                source: source as PublicInquirySource,
                type,
                summary,
                occurredAt: now,
              }));

      (await logActivity(
                "inquiry",
                inquiryId,
                "submitted",
                `${sourceMeta.label} inquiry received from ${name}${submittedOrgName ? ` at ${submittedOrgName}` : ""}.`,
                null,
              ));
      (await logActivity(
                "person",
                topology.sourcePersonId,
                "inquiry",
                `Submitted ${type} inquiry ${inquiryId} through the ${sourceMeta.label} form.`,
                null,
              ));
      if (organizationId) {
        (await logActivity(
                    "organization",
                    organizationId,
                    "inquiry",
                    `${type} inquiry from ${name} (${email}). ${summary.slice(0, 500)}`,
                    null,
                  ));
      }

      const subject = submittedOrgName || name;
      const defaultOwner = (await db.prepare(
              `SELECT id
           FROM users
          WHERE role IN ('growth','admin') AND status = 'active'
          ORDER BY CASE role WHEN 'growth' THEN 0 ELSE 1 END, id
          LIMIT 1`,
            ).get()) as { id: string } | undefined;
      const context = [
        `Source: ${sourceMeta.label}.`,
        `Contact: ${name} (${email}).`,
        submittedOrgName ? `Organization: ${submittedOrgName}.` : "",
        `Inquiry: ${summary}`,
      ].filter(Boolean).join(" ").slice(0, 2000);
      (await db.prepare(
                `INSERT INTO tasks
          (id, title, owner_user_id, due_at, due_on, status, kind, priority, context, recommended_action,
           entity_type, entity_id, handoff_to_founder, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'open', 'follow_up', 'high', ?, ?, ?, ?, 0, ?, ?)`,
              ).run(
                taskId,
                `Review and respond: ${type} — ${subject}`.slice(0, 200),
                defaultOwner?.id ?? null,
                now + 3 * 24 * 60 * 60 * 1000,
                followUpDate,
                context,
                `Review the inquiry and contact ${name} at ${email} with the correct next step.`,
                organizationId ? "organization" : "inquiry",
                organizationId ?? inquiryId,
                now,
                now,
              ));
      (await logActivity("task", taskId, "created", `Created from public inquiry ${inquiryId}.`, null));

      for (const staffId of (await listStaffUserIds())) {
        (await createNotification({
                    id: `ntf-public-inquiry-${inquiryId}-${staffId}`,
                    userId: staffId,
                    type: "partner_pipeline",
                    title: `New ${type} inquiry`,
                    body: `${subject} submitted through the ${sourceMeta.label} form. Follow-up Work is ready.`,
                    link: organizationId ? `/app/partners/${organizationId}#inquiry-${inquiryId}` : `/app/inquiries#inquiry-${inquiryId}`,
                  }));
      }
    }
    (await db.exec("COMMIT"));
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      try {
        (await db.exec("ROLLBACK"));
      } catch {
        // Preserve the original intake failure.
      }
    }
    return {
      ok: false,
      error: error instanceof Error && error.message === "request_key_mismatch"
        ? "This retry no longer matches the original submission. Start a new form and send it again."
        : "The inquiry could not be recorded. Nothing was added to the BOW operating system; please retry safely.",
    };
  }

  if (wasReplay) return { ok: true };
  revalidatePath("/app/inquiries");
  revalidatePath("/app/admin/inquiries");
  revalidatePath("/app/tasks");
  revalidatePath("/app/partners");
  if (organizationId) revalidatePath(`/app/partners/${organizationId}`);
  return { ok: true };
}

export interface PartnershipInquiryInput {
  requestKey: string;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  message?: string;
}

/** PUBLIC — submitted from a marketing partner/get-involved page. No auth guard. */
export async function submitPartnershipInquiry(input: PartnershipInquiryInput): Promise<ActionResult> {
  const requestKey = (input.requestKey ?? "").trim();
  const orgName = (input.organizationName ?? "").trim();
  const contactName = (input.contactName ?? "").trim();
  const contactEmail = (input.contactEmail ?? "").trim().toLowerCase();
  const message = (input.message ?? "").trim();

  if (requestKey.length < 12 || requestKey.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(requestKey)) {
    return { ok: false, error: "Refresh the page and try the inquiry again." };
  }
  if (!orgName) return { ok: false, error: "Organization name is required." };
  if (orgName.length > 200) return { ok: false, error: "Organization name is too long." };
  if (!contactName) return { ok: false, error: "Contact name is required." };
  if (contactName.length > 120) return { ok: false, error: "Contact name is too long." };
  if (!/.+@.+\..+/.test(contactEmail)) return { ok: false, error: "A valid email is required." };
  if (contactEmail.length > 200) return { ok: false, error: "Email is too long." };
  if (message.length > 2000) return { ok: false, error: "Message is too long." };

  // The browser keeps this opaque key stable across retries. Deriving the
  // primary key from it makes a double-click or interrupted response replay
  // the original successful intake instead of creating duplicate work.
  const inquiryId = `iq-p-${createHash("sha256").update(requestKey).digest("hex").slice(0, 24)}`;
  const summary = ["Partnership inquiry.", message].filter(Boolean).join(" ");
  const replay = (await getDb().prepare(
      "SELECT name, email, org_name, summary FROM inquiries WHERE id = ?",
    ).get(inquiryId)) as { name: string; email: string; org_name: string; summary: string } | undefined;
  if (replay) {
    return replay.name === contactName
      && replay.email === contactEmail
      && replay.org_name === orgName
      && replay.summary === summary
      ? { ok: true }
      : { ok: false, error: "This submission key belongs to different inquiry details. Refresh the page and try again." };
  }

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("partnership-inquiry-network", address, {
          limit: 15,
          windowMs: 24 * 60 * 60 * 1000,
          blockMs: 24 * 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return { ok: false, error: "Too many inquiries were submitted from this network. Try again later." };
  }
  const identityLimit = (await consumeRateLimit("partnership-inquiry-email", contactEmail, {
      limit: 4,
      windowMs: 7 * 24 * 60 * 60 * 1000,
      blockMs: 7 * 24 * 60 * 60 * 1000,
    }));
  if (!identityLimit.allowed) return { ok: false, error: "This email already submitted several recent inquiries." };

  const db = getDb();
  const now = Date.now();
  const taskId = `pfx-${randomUUID().slice(0, 8)}`;
  let organizationId: string | null = null;
  let wasReplay = false;
  let transactionOpen = false;
  try {
    (await db.exec("BEGIN IMMEDIATE"));
    transactionOpen = true;
    const lockedReplay = (await db.prepare(
          "SELECT name, email, org_name, summary FROM inquiries WHERE id = ?",
        ).get(inquiryId)) as { name: string; email: string; org_name: string; summary: string } | undefined;
    if (lockedReplay) {
      if (
        lockedReplay.name !== contactName
        || lockedReplay.email !== contactEmail
        || lockedReplay.org_name !== orgName
        || lockedReplay.summary !== summary
      ) {
        throw new Error("request_key_mismatch");
      }
      wasReplay = true;
    } else {
      const topology = (await ensureInquiryTopology(
              db,
              { organizationName: orgName, contactName, contactEmail },
              { now },
            ));
      organizationId = topology.organizationId;

      const submittedDate = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(now);
      (await db.prepare(
                `INSERT INTO inquiries (id, organization_id, name, email, type, org_name, date, status, summary, submitted_at)
         VALUES (?, ?, ?, ?, 'Partnership', ?, ?, 'new', ?, ?)`,
              ).run(inquiryId, organizationId, contactName, contactEmail, orgName, submittedDate, summary, now));

      if (organizationId) {
        (await logActivity(
                    "organization",
                    organizationId,
                    "inquiry",
                    `Partnership inquiry from ${contactName} (${contactEmail}).${message ? ` ${message.slice(0, 500)}` : ""}`,
                    null,
                  ));
      }
      (await logActivity("inquiry", inquiryId, "submitted", `Partnership inquiry received from ${orgName}.`, null));
      (await db.prepare(
                "INSERT INTO tasks (id, title, owner_user_id, due_at, status, entity_type, entity_id, handoff_to_founder, created_at, updated_at) VALUES (?, ?, NULL, ?, 'open', ?, ?, 0, ?, ?)",
              ).run(
                taskId,
                `${organizationId ? "Follow up" : "Resolve partner and follow up"}: ${orgName} partnership inquiry`,
                now + 3 * 24 * 60 * 60 * 1000,
                organizationId ? "organization" : "inquiry",
                organizationId ?? inquiryId,
                now,
                now,
              ));

      for (const staffId of (await listStaffUserIds())) {
        (await createNotification({
                    id: `ntf-partner-inquiry-${inquiryId}-${staffId}`,
                    userId: staffId,
                    type: "instructor_pipeline",
                    title: "New partnership inquiry",
                    body: `${orgName} submitted a partnership inquiry.`,
                    link: organizationId ? `/app/partners/${organizationId}#inquiry-${inquiryId}` : "/app/inquiries",
                  }));
      }
    }
    (await db.exec("COMMIT"));
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      try {
        (await db.exec("ROLLBACK"));
      } catch {
        // Preserve the intake failure.
      }
    }
    return {
      ok: false,
      error: error instanceof Error && error.message === "request_key_mismatch"
        ? "This submission key belongs to different inquiry details. Refresh the page and try again."
        : "The inquiry could not be recorded. No intake records were changed.",
    };
  }
  if (wasReplay) return { ok: true };
  revalidatePath("/app/partners");
  revalidatePath("/app/inquiries");
  revalidatePath("/app/admin/inquiries");
  if (organizationId) revalidatePath(`/app/partners/${organizationId}`);
  revalidatePath("/app/tasks");
  return { ok: true };
}
