import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

type BowDatabase = ReturnType<typeof getDb>;

export interface InquiryIdentity {
  organizationName: string;
  contactName: string;
  contactEmail: string;
}

interface EnsureInquiryTopologyOptions {
  selectedOrganizationId?: string | null;
  selectedPrimaryPersonId?: string | null;
  requireOperatingPartner?: boolean;
  now: number;
}

function usableOrganizationName(value: string): boolean {
  const normalized = value.trim();
  return Boolean(normalized && normalized !== "—" && normalized.toLowerCase() !== "not provided");
}

async function findOrganizationsByName(db: BowDatabase, name: string): Promise<{ id: string; status: string }[]> {
  return (await db
      .prepare(
        `SELECT id, status
         FROM organizations
        WHERE lower(trim(name)) = lower(trim(?))
        ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'prospect' THEN 1 ELSE 2 END, id`,
      )
      .all(name)) as { id: string; status: string }[];
}

async function upsertInquiryPerson(db: BowDatabase, identity: InquiryIdentity, now: number): Promise<string> {
  const email = identity.contactEmail.trim().toLowerCase();
  const existing = (await db
      .prepare("SELECT id FROM people WHERE lower(trim(email)) = ? ORDER BY updated_at DESC, id LIMIT 1")
      .get(email)) as { id: string } | undefined;
  if (existing) {
    (await db.prepare(
            `UPDATE people
          SET name = CASE WHEN trim(name) = '' THEN ? ELSE name END,
              updated_at = ?
        WHERE id = ?`,
          ).run(identity.contactName.trim(), now, existing.id));
    return existing.id;
  }

  const personId = `per-${randomUUID().slice(0, 12)}`;
  (await db.prepare(
        "INSERT INTO people (id, name, email, phone, user_id, created_at, updated_at) VALUES (?, ?, ?, '', NULL, ?, ?)",
      ).run(personId, identity.contactName.trim(), email, now, now));
  return personId;
}

async function connectInquiryContact(
  db: BowDatabase,
  organizationId: string,
  personId: string,
  now: number,
): Promise<void> {
  const hasPrimary = Boolean(
    (await db.prepare(
            `SELECT 1 FROM organization_people
        WHERE organization_id = ? AND active = 1 AND is_primary = 1
        LIMIT 1`,
          ).get(organizationId)),
  );
  const shouldBePrimary = hasPrimary ? 0 : 1;

  (await db.prepare(
        `UPDATE organization_people
        SET active = 1,
            is_primary = CASE WHEN ? = 1 THEN 1 ELSE is_primary END,
            updated_at = ?
      WHERE organization_id = ? AND person_id = ? AND relationship_type = 'inquiry_contact'`,
      ).run(shouldBePrimary, now, organizationId, personId));
  (await db.prepare(
        `INSERT INTO organization_people
      (id, organization_id, person_id, relationship_type, is_primary, active, created_at, updated_at)
     SELECT ?, ?, ?, 'inquiry_contact', ?, 1, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM organization_people
         WHERE organization_id = ? AND person_id = ? AND relationship_type = 'inquiry_contact'
      )`,
      ).run(
        `orp-${randomUUID().slice(0, 12)}`,
        organizationId,
        personId,
        shouldBePrimary,
        now,
        now,
        organizationId,
        personId,
      ));
}

/**
 * Converts a public inquiry identity into canonical Organization/Person
 * topology. The caller must hold a write transaction so name/email matching,
 * inserts, and relationship activation are one race-safe decision.
 */
export async function ensureInquiryTopology(
  db: BowDatabase,
  identity: InquiryIdentity,
  options: EnsureInquiryTopologyOptions,
): Promise<{ organizationId: string | null; sourcePersonId: string; primaryPersonId: string | null }> {
  const organizationName = identity.organizationName.trim();
  let organizationId = options.selectedOrganizationId?.trim() || null;
  if (organizationId) {
    const selected = (await db.prepare("SELECT status FROM organizations WHERE id = ?").get(organizationId)) as
      | { status: string }
      | undefined;
    if (!selected || (options.requireOperatingPartner && !["prospect", "active"].includes(selected.status))) {
      throw new Error("Inquiry partner is no longer available.");
    }
  }

  if (!organizationId && usableOrganizationName(organizationName)) {
    const matchedOrganizations = (await findOrganizationsByName(db, organizationName));
    const matchedOrganization = matchedOrganizations.length === 1 ? matchedOrganizations[0] : undefined;
    if (
      matchedOrganization
      && options.requireOperatingPartner
      && !["prospect", "active"].includes(matchedOrganization.status)
    ) {
      throw new Error("Inquiry partner is no longer available.");
    }
    organizationId = matchedOrganization?.id ?? null;
    // Never guess between same-named branches. Leave the inquiry unassigned so
    // an operator can make the canonical match explicitly. A truly new name
    // still becomes a prospect Organization immediately.
    if (!organizationId && matchedOrganizations.length === 0) {
      organizationId = `org-${randomUUID().slice(0, 12)}`;
      (await db.prepare(
                "INSERT INTO organizations (id, name, type, location, status) VALUES (?, ?, 'partner_inquiry', '', 'prospect')",
              ).run(organizationId, organizationName.slice(0, 200)));
    }
  }

  const sourcePersonId = (await upsertInquiryPerson(db, identity, options.now));
  if (organizationId) (await connectInquiryContact(db, organizationId, sourcePersonId, options.now));

  let primaryPersonId = options.selectedPrimaryPersonId?.trim() || null;
  if (primaryPersonId) {
    const relationship = organizationId
      ? (await db.prepare(
                `SELECT 1 FROM organization_people
          WHERE organization_id = ? AND person_id = ? AND active = 1
          LIMIT 1`,
              ).get(organizationId, primaryPersonId))
      : null;
    if (!relationship) throw new Error("Program contact is no longer connected to the partner.");
  } else if (organizationId) {
    primaryPersonId = sourcePersonId;
  }

  return { organizationId, sourcePersonId, primaryPersonId };
}
