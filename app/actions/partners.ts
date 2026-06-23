"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { isPartnerOrgType, type PartnerOrgType } from "@/lib/account";

/* ============================================================
 * Partner / school landing pages — server actions (Feature 5).
 *
 * `submitDemoRequest` is PUBLIC (no auth): it's the "Request a Demo"
 * form on every partner page. It validates input like the public
 * `createInquiry` in app/actions/lms.ts (trim + email regex) and
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
  const email = (requesterEmail || "").trim();
  if (!slug || !name || !/.+@.+\..+/.test(email)) return { ok: false };

  const db = getDb();
  const org = db.prepare("SELECT 1 FROM partner_orgs WHERE slug = ?").get(slug);
  if (!org) return { ok: false };

  const id = `dr-${randomUUID().slice(0, 12)}`;
  db.prepare(
    "INSERT INTO demo_requests (id, org_slug, requester_name, requester_email, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, slug, name, email, (message || "").trim(), Date.now());

  // Surface the new request in the admin "Partners" inbox.
  revalidatePath("/admin");
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
  const existing = db.prepare("SELECT 1 FROM partner_orgs WHERE slug = ?").get(slug);
  if (existing) return { ok: false, error: "slug-taken" };

  const id = `po-${randomUUID().slice(0, 12)}`;
  db.prepare(
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
  );

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
