/* ============================================================
 * Growth attribution — server data layer.
 *
 * The single cross-system answer to "who generates BOW's growth?" Derives,
 * per Person, their downstream impact across all three canonical referral
 * spines — instructor referrals (instructors.referred_by_person_id), family
 * referrals (student_referrals), and partner/community introductions
 * (growth_introductions) — plus the students actually reached downstream of
 * each. Nothing is stored or entered by hand; every figure is a query a human
 * can verify, using the same evidence rules as the rest of Growth (an
 * instructor "converts" at stage=active; a referred student converts at
 * verified attendance; an introduction converts when it produces a partner org).
 *
 * Each channel is independently fault-tolerant: an older schema missing one
 * spine (referred_by_person_id, student_referrals, or growth_introductions)
 * degrades that channel to nothing instead of breaking the founder view.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import "server-only";

import { getDb } from "@/lib/db";
import {
  buildAdvocate,
  rankAdvocates,
  type Advocate,
  type AttributionChannel,
  type AdvocateChannelStat,
} from "@/lib/growth-attribution-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const INSTRUCTOR_ADVANCED_STAGES = "'accepted','onboarding','training','practice_evaluation','eligible','active'";

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type Accumulator = Map<
  string,
  { name: string; channels: Partial<Record<AttributionChannel, Partial<AdvocateChannelStat>>>; lastActivityAt: number | null }
>;

function touch(acc: Accumulator, personId: string, name: string): { name: string; channels: Partial<Record<AttributionChannel, Partial<AdvocateChannelStat>>>; lastActivityAt: number | null } {
  const existing = acc.get(personId);
  if (existing) {
    if (!existing.name && name) existing.name = name;
    return existing;
  }
  const created = { name: name || "Unknown person", channels: {} as Partial<Record<AttributionChannel, Partial<AdvocateChannelStat>>>, lastActivityAt: null };
  acc.set(personId, created);
  return created;
}

function noteActivity(entry: { lastActivityAt: number | null }, at: number): void {
  if (at > 0 && (entry.lastActivityAt === null || at > entry.lastActivityAt)) entry.lastActivityAt = at;
}

/**
 * Fold the instructor-referral spine into the accumulator: who referred each
 * instructor, how many advanced past application, how many became active, and
 * the students those now-active referrals actually reached.
 */
async function foldInstructorReferrals(acc: Accumulator, personFilter: string | null): Promise<void> {
  const db = getDb();
  const where = personFilter ? "AND i.referred_by_person_id = ?" : "";
  const args = personFilter ? [personFilter] : [];
  try {
    const rows = (await db
      .prepare(
        `SELECT ref.id AS person_id, ref.name,
                COUNT(*) AS referred,
                COUNT(*) FILTER (WHERE i.stage IN (${INSTRUCTOR_ADVANCED_STAGES})) AS advanced,
                COUNT(*) FILTER (WHERE i.stage = 'active') AS converted,
                MAX(i.updated_at) AS last_at
           FROM instructors i
           JOIN people ref ON ref.id = i.referred_by_person_id
          WHERE i.referred_by_person_id IS NOT NULL ${where}
          GROUP BY ref.id, ref.name`,
      )
      .all(...args)) as any[];
    for (const row of rows) {
      const entry = touch(acc, String(row.person_id), String(row.name));
      entry.channels.instructor_referral = {
        channel: "instructor_referral",
        referred: num(row.referred),
        advanced: num(row.advanced),
        converted: num(row.converted),
        studentsReached: 0,
      };
      noteActivity(entry, num(row.last_at));
    }
  } catch {
    return;
  }

  // Downstream: distinct students enrolled in classes taught by the now-active
  // referred instructors, grouped by the referrer.
  try {
    const rows = (await db
      .prepare(
        `SELECT i.referred_by_person_id AS person_id, COUNT(DISTINCT ce.student_id) AS students
           FROM instructors i
           JOIN class_instructors ci ON ci.instructor_id = i.id
           JOIN class_enrollments ce ON ce.class_id = ci.class_id AND ce.status = 'enrolled'
          WHERE i.referred_by_person_id IS NOT NULL AND i.stage = 'active' ${where}
          GROUP BY i.referred_by_person_id`,
      )
      .all(...args)) as any[];
    for (const row of rows) {
      const entry = acc.get(String(row.person_id));
      if (entry?.channels.instructor_referral) entry.channels.instructor_referral.studentsReached = num(row.students);
    }
  } catch {
    return;
  }
}

/**
 * Fold the family-referral spine: non-voided student referrals by referrer,
 * how many referred students registered (advanced), and how many reached
 * verified participation (converted) — the referred students themselves are the
 * students reached.
 */
async function foldFamilyReferrals(acc: Accumulator, personFilter: string | null): Promise<void> {
  const db = getDb();
  const where = personFilter ? "AND r.referrer_person_id = ?" : "";
  const args = personFilter ? [personFilter] : [];
  try {
    const rows = (await db
      .prepare(
        `SELECT r.referrer_person_id AS person_id, ref.name,
                COUNT(*) AS referred,
                COUNT(*) FILTER (
                  WHERE r.referred_student_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM class_enrollments ce WHERE ce.student_id = r.referred_student_id
                  )
                ) AS advanced,
                COUNT(*) FILTER (
                  WHERE r.referred_student_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM attendance_records ar
                     WHERE ar.student_id = r.referred_student_id AND ar.status IN ('present','late')
                  )
                ) AS converted,
                MAX(r.created_at) AS last_at
           FROM student_referrals r
           JOIN people ref ON ref.id = r.referrer_person_id
          WHERE r.voided_at IS NULL AND r.referrer_person_id IS NOT NULL ${where}
          GROUP BY r.referrer_person_id, ref.name`,
      )
      .all(...args)) as any[];
    for (const row of rows) {
      const entry = touch(acc, String(row.person_id), String(row.name));
      const converted = num(row.converted);
      entry.channels.family_referral = {
        channel: "family_referral",
        referred: num(row.referred),
        advanced: num(row.advanced),
        converted,
        // Each verified referred student IS a student reached downstream.
        studentsReached: converted,
      };
      noteActivity(entry, num(row.last_at));
    }
  } catch {
    return;
  }
}

/**
 * Fold the introduction spine for partner/community targets. The introducer id
 * resolves to a Person differently by type (instructor/student/contributor);
 * partner-originated introductions have no Person and are skipped. Converted
 * introductions carry a real organization, whose classes reach real students.
 */
async function foldPartnerIntroductions(acc: Accumulator, personFilter: string | null): Promise<void> {
  const db = getDb();
  const personCase = `CASE gi.introducer_type
      WHEN 'instructor' THEN (SELECT person_id FROM instructors WHERE id = gi.introducer_id)
      WHEN 'student' THEN (SELECT person_id FROM students WHERE id = gi.introducer_id)
      WHEN 'contributor' THEN (SELECT person_id FROM growth_contributors WHERE id = gi.introducer_id)
    END`;
  const having = personFilter ? "AND intro.person_id = ?" : "";
  const args = personFilter ? [personFilter] : [];
  try {
    const rows = (await db
      .prepare(
        `WITH intro AS (
           SELECT gi.id, gi.status, gi.converted_organization_id,
                  COALESCE(gi.resolved_at, gi.created_at) AS at,
                  ${personCase} AS person_id
             FROM growth_introductions gi
            WHERE gi.target_kind IN ('partner','community')
              AND gi.introducer_type IN ('instructor','student','contributor')
         )
         SELECT intro.person_id, p.name,
                COUNT(*) AS referred,
                COUNT(*) FILTER (WHERE intro.status IN ('contacted','converted') OR intro.converted_organization_id IS NOT NULL) AS advanced,
                COUNT(*) FILTER (WHERE intro.status = 'converted' OR intro.converted_organization_id IS NOT NULL) AS converted,
                MAX(intro.at) AS last_at
           FROM intro
           JOIN people p ON p.id = intro.person_id
          WHERE intro.person_id IS NOT NULL ${having}
          GROUP BY intro.person_id, p.name`,
      )
      .all(...args)) as any[];
    for (const row of rows) {
      const entry = touch(acc, String(row.person_id), String(row.name));
      entry.channels.partner_introduction = {
        channel: "partner_introduction",
        referred: num(row.referred),
        advanced: num(row.advanced),
        converted: num(row.converted),
        studentsReached: 0,
      };
      noteActivity(entry, num(row.last_at));
    }
  } catch {
    return;
  }

  // Downstream: distinct students enrolled in classes at the organizations these
  // introductions produced (class directly on the org, or via the program).
  try {
    const rows = (await db
      .prepare(
        `WITH intro AS (
           SELECT gi.converted_organization_id AS org_id,
                  ${personCase} AS person_id
             FROM growth_introductions gi
            WHERE gi.target_kind IN ('partner','community')
              AND gi.introducer_type IN ('instructor','student','contributor')
              AND gi.converted_organization_id IS NOT NULL
         )
         SELECT intro.person_id, COUNT(DISTINCT ce.student_id) AS students
           FROM intro
           JOIN classes c ON (
             c.partner_org_id = intro.org_id
             OR EXISTS (SELECT 1 FROM programs p WHERE p.id = c.program_id AND p.partner_org_id = intro.org_id)
           )
           JOIN class_enrollments ce ON ce.class_id = c.id AND ce.status = 'enrolled'
          WHERE intro.person_id IS NOT NULL ${having}
          GROUP BY intro.person_id`,
      )
      .all(...args)) as any[];
    for (const row of rows) {
      const entry = acc.get(String(row.person_id));
      if (entry?.channels.partner_introduction) entry.channels.partner_introduction.studentsReached = num(row.students);
    }
  } catch {
    return;
  }
}

async function collectAdvocates(personFilter: string | null): Promise<Advocate[]> {
  const acc: Accumulator = new Map();
  // Sequential, not parallel: every fold touches the same connection pool and
  // the set is small (people who referred someone), so ordering keeps it simple.
  await foldInstructorReferrals(acc, personFilter);
  await foldFamilyReferrals(acc, personFilter);
  await foldPartnerIntroductions(acc, personFilter);

  const advocates: Advocate[] = [];
  for (const [personId, entry] of acc) {
    const advocate = buildAdvocate({ personId, name: entry.name, channels: entry.channels, lastActivityAt: entry.lastActivityAt });
    if (advocate.totalReferred > 0) advocates.push(advocate);
  }
  return advocates;
}

export interface GrowthAdvocatesSummary {
  advocates: Advocate[];
  totals: {
    advocates: number;
    activeInstructorsGenerated: number;
    partnersGenerated: number;
    verifiedFamilies: number;
    studentsReached: number;
    pendingReferrals: number;
  };
}

/**
 * The ranked "who generates our growth" board. Strongest verified downstream
 * outcome first. `limit` caps the returned rows; the totals always reflect the
 * full advocate set so the founder sees the true compounding picture.
 */
export async function getGrowthAdvocates(limit = 25): Promise<GrowthAdvocatesSummary> {
  const all = rankAdvocates(await collectAdvocates(null));
  const family = (advocate: Advocate) => advocate.channels.find((entry) => entry.channel === "family_referral");
  const totals = {
    advocates: all.length,
    activeInstructorsGenerated: all.reduce((sum, advocate) => sum + advocate.activeInstructorsGenerated, 0),
    partnersGenerated: all.reduce((sum, advocate) => sum + advocate.partnersGenerated, 0),
    verifiedFamilies: all.reduce((sum, advocate) => sum + (family(advocate)?.converted ?? 0), 0),
    studentsReached: all.reduce((sum, advocate) => sum + advocate.studentsReached, 0),
    pendingReferrals: all.reduce((sum, advocate) => sum + Math.max(0, advocate.totalReferred - advocate.totalConverted), 0),
  };
  return { advocates: all.slice(0, Math.max(0, limit)), totals };
}

/**
 * A single Person's cross-channel attribution, for their profile. Returns null
 * when the Person has generated nothing attributable, so callers can hide the
 * block entirely rather than render an empty record.
 */
export async function getPersonAttribution(personId: string): Promise<Advocate | null> {
  if (!personId) return null;
  const advocates = await collectAdvocates(personId);
  return advocates[0] ?? null;
}
