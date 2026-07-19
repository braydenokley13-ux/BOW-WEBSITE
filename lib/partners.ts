/* ============================================================
 * Partner / school landing pages — read layer (Feature 5).
 *
 * Server-only helpers that read the system of record (the
 * `partner_orgs` and `demo_requests` tables) and hand fully
 * serializable shapes to the public partner pages, the dynamic OG
 * image, and the admin "Partners" tab. Mirrors lib/self-paced.ts /
 * lib/profile.ts: the DB is authoritative; these functions just shape
 * rows into typed objects.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { type PartnerOrgType } from "@/lib/account";

export interface PartnerOrg {
  id: string;
  name: string;
  slug: string;
  orgType: PartnerOrgType;
  contactName: string;
  contactEmail: string;
  customHeadline: string;
  customBody: string;
  createdAt: number;
}

export interface DemoRequest {
  id: string;
  orgSlug: string;
  requesterName: string;
  requesterEmail: string;
  message: string;
  createdAt: number;
  /** Relative label, e.g. "2 hours ago" — for the admin tab. */
  when: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToPartnerOrg(r: any): PartnerOrg {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    orgType: r.org_type as PartnerOrgType,
    contactName: r.contact_name ?? "",
    contactEmail: r.contact_email ?? "",
    customHeadline: r.custom_headline,
    customBody: r.custom_body,
    createdAt: Number(r.created_at) || 0,
  };
}

/** A single partner org by its public slug, or null when it doesn't exist. */
export async function getPartnerBySlug(slug: string): Promise<PartnerOrg | null> {
  const row = (await getDb().prepare("SELECT * FROM partner_orgs WHERE slug = ?").get(slug)) as any;
  return row ? rowToPartnerOrg(row) : null;
}

/** All partner orgs, newest first — for the admin "Partners" tab. */
export async function getAllPartnerOrgs(): Promise<PartnerOrg[]> {
  const rows = (await getDb()
      .prepare("SELECT * FROM partner_orgs ORDER BY created_at DESC, name ASC")
      .all()) as any[];
  return rows.map(rowToPartnerOrg);
}

/** Every demo request, newest first — for the admin "Partners" tab. */
export async function getDemoRequests(): Promise<DemoRequest[]> {
  const rows = (await getDb()
      .prepare("SELECT * FROM demo_requests ORDER BY created_at DESC")
      .all()) as any[];
  return rows.map((r) => {
    const createdAt = Number(r.created_at) || 0;
    return {
      id: r.id,
      orgSlug: r.org_slug,
      requesterName: r.requester_name,
      requesterEmail: r.requester_email,
      message: r.message ?? "",
      createdAt,
      when: relativeTime(createdAt),
    };
  });
}

/** Headline counts for the admin overview. */
export async function getPartnerCounts(): Promise<{ orgs: number; demoRequests: number }> {
  const db = getDb();
  const orgs = ((await db.prepare("SELECT COUNT(*) AS n FROM partner_orgs").get()) as { n: number }).n;
  const demoRequests = ((await db.prepare("SELECT COUNT(*) AS n FROM demo_requests").get()) as { n: number }).n;
  return { orgs: Number(orgs) || 0, demoRequests: Number(demoRequests) || 0 };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A compact relative-time label ("Just now", "3 hours ago", "5 days ago"). */
function relativeTime(ts: number, now: number = Date.now()): string {
  if (!ts) return "—";
  const diff = Math.max(0, now - ts);
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) {
    const n = Math.floor(diff / MINUTE);
    return `${n} ${n === 1 ? "minute" : "minutes"} ago`;
  }
  if (diff < DAY) {
    const n = Math.floor(diff / HOUR);
    return `${n} ${n === 1 ? "hour" : "hours"} ago`;
  }
  if (diff < 30 * DAY) {
    const n = Math.floor(diff / DAY);
    return `${n} ${n === 1 ? "day" : "days"} ago`;
  }
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
