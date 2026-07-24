/* ============================================================
 * Instructor growth — server data layer.
 *
 * Derives the canonical impact record, the referral attribution leaderboard,
 * and the program-staffing board from EXISTING operating tables
 * (class_instructors, class_sessions, class_enrollments, programs,
 * instructor_missions, growth_introductions, student_referrals, instructors).
 * No metric is invented or manually entered — every number is a query a human
 * can verify. Server-only.
 * ============================================================ */

import "server-only";

import { getDb } from "@/lib/db";
import {
  rankStaffingCandidates,
  type InstructorImpact,
  type RankedCandidate,
  type StaffingCandidate,
  type StaffingNeed,
} from "@/lib/instructor-growth-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_CLASS_STATUSES = "'planning','staffing','ready_to_launch','active','paused'";

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/* ---------------- impact record ---------------- */

/**
 * The instructor's truthful, derived record of accomplishment. Every figure
 * comes from a canonical relationship — sessions actually delivered, students
 * actually enrolled, missions actually completed, referrals that actually
 * reached the active stage.
 */
export async function getInstructorImpact(instructorId: string, now = Date.now()): Promise<InstructorImpact> {
  const db = getDb();
  const person = (await db.prepare("SELECT person_id FROM instructors WHERE id = ?").get(instructorId)) as
    | { person_id: string }
    | undefined;
  const personId = person?.person_id ?? null;

  const teaching = (await db
    .prepare(
      `SELECT
         (SELECT COUNT(DISTINCT cs.id) FROM class_instructors ci
            JOIN class_sessions cs ON cs.class_id = ci.class_id
           WHERE ci.instructor_id = ? AND cs.session_date <= ?
             AND cs.session_date >= ci.added_at
             AND (ci.removed_at IS NULL OR cs.session_date < ci.removed_at)) AS sessions_taught,
         (SELECT COUNT(DISTINCT c.program_id) FROM class_instructors ci
            JOIN classes c ON c.id = ci.class_id
           WHERE ci.instructor_id = ? AND c.program_id IS NOT NULL) AS programs_taught,
         (SELECT COUNT(DISTINCT c.program_id) FROM class_instructors ci
            JOIN classes c ON c.id = ci.class_id
           WHERE ci.instructor_id = ? AND ci.role = 'lead' AND c.program_id IS NOT NULL) AS programs_led,
         (SELECT COUNT(DISTINCT ce.student_id) FROM class_instructors ci
            JOIN class_enrollments ce ON ce.class_id = ci.class_id
           WHERE ci.instructor_id = ? AND ce.status = 'enrolled') AS students_reached,
         (SELECT COUNT(*) FROM instructor_missions m
           WHERE m.instructor_id = ? AND m.status = 'completed'
             AND m.completion_outcome IN ('delivered','partial')) AS missions_completed,
         (SELECT COUNT(*) FROM growth_introductions gi
           WHERE gi.introducer_type = 'instructor' AND gi.introducer_id = ?
             AND gi.target_kind IN ('partner','community')
             AND (gi.status = 'converted' OR gi.converted_organization_id IS NOT NULL)) AS partner_opportunities`,
    )
    .get(instructorId, now, instructorId, instructorId, instructorId, instructorId, instructorId)) as any;

  let instructorReferralsTotal = 0;
  let instructorReferralsActivated = 0;
  let studentReferrals = 0;
  if (personId) {
    // referred_by_person_id is additive (migration 014); tolerate its absence
    // so the impact record still renders on a not-yet-migrated schema.
    try {
      const referrals = (await db
        .prepare(
          `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE stage = 'active') AS active
             FROM instructors WHERE referred_by_person_id = ?`,
        )
        .get(personId)) as any;
      instructorReferralsTotal = num(referrals?.total);
      instructorReferralsActivated = num(referrals?.active);
    } catch {
      instructorReferralsTotal = 0;
      instructorReferralsActivated = 0;
    }
    const studentRef = (await db
      .prepare("SELECT COUNT(*) AS n FROM student_referrals WHERE referrer_person_id = ? AND voided_at IS NULL")
      .get(personId)) as any;
    studentReferrals = num(studentRef?.n);
  }

  return {
    programsTaught: num(teaching?.programs_taught),
    programsLed: num(teaching?.programs_led),
    sessionsTaught: num(teaching?.sessions_taught),
    studentsReached: num(teaching?.students_reached),
    missionsCompleted: num(teaching?.missions_completed),
    instructorReferralsActivated,
    instructorReferralsTotal,
    studentReferrals,
    partnerOpportunities: num(teaching?.partner_opportunities),
  };
}

/* ---------------- referral attribution ---------------- */

export interface ReferrerRow {
  personId: string;
  name: string;
  referredTotal: number;
  referredAccepted: number;
  referredActive: number;
}

export interface PendingInstructorReferral {
  id: string;
  introducerInstructorId: string;
  introducerPersonId: string;
  introducerName: string;
  targetName: string;
  status: string;
  ageDays: number;
}

/**
 * "Who is bringing strong instructor candidates into BOW, and how many became
 * active?" — read straight off the canonical referred_by link, plus the
 * instructor-submitted referrals still awaiting follow-up in the introduction
 * spine. No referrer ever sees a referred applicant's private data here; this
 * is aggregate attribution for the founder.
 */
export async function getReferralAttribution(now = Date.now()): Promise<{
  referrers: ReferrerRow[];
  pending: PendingInstructorReferral[];
}> {
  const db = getDb();
  let referrers: any[] = [];
  try {
    referrers = (await db
      .prepare(
        `SELECT ref.id AS person_id, ref.name,
                COUNT(*) AS referred_total,
                COUNT(*) FILTER (WHERE i.stage IN ('accepted','onboarding','training','practice_evaluation','eligible','active')) AS referred_accepted,
                COUNT(*) FILTER (WHERE i.stage = 'active') AS referred_active
           FROM instructors i
           JOIN people ref ON ref.id = i.referred_by_person_id
          WHERE i.referred_by_person_id IS NOT NULL
          GROUP BY ref.id, ref.name
          ORDER BY referred_active DESC, referred_accepted DESC, referred_total DESC
          LIMIT 50`,
      )
      .all()) as any[];
  } catch {
    referrers = [];
  }

  let pending: PendingInstructorReferral[] = [];
  try {
    const rows = (await db
      .prepare(
        `SELECT gi.id, gi.introducer_id, gi.target_name, gi.status, gi.created_at,
                p.id AS introducer_person_id, p.name AS introducer_name
           FROM growth_introductions gi
           JOIN instructors i ON i.id = gi.introducer_id
           JOIN people p ON p.id = i.person_id
          WHERE gi.introducer_type = 'instructor' AND gi.target_kind = 'instructor'
            AND gi.status IN ('suggested','contacted')
          ORDER BY gi.created_at
          LIMIT 50`,
      )
      .all()) as any[];
    pending = rows.map((row) => ({
      id: String(row.id),
      introducerInstructorId: String(row.introducer_id),
      introducerPersonId: String(row.introducer_person_id),
      introducerName: String(row.introducer_name),
      targetName: String(row.target_name),
      status: String(row.status),
      ageDays: Math.max(0, Math.floor((now - num(row.created_at)) / DAY_MS)),
    }));
  } catch {
    pending = [];
  }

  return {
    referrers: referrers.map((row) => ({
      personId: String(row.person_id),
      name: String(row.name),
      referredTotal: num(row.referred_total),
      referredAccepted: num(row.referred_accepted),
      referredActive: num(row.referred_active),
    })),
    pending,
  };
}

/** Active instructors offered as referrer options for staff attribution (keyed by Person). */
export async function listActiveInstructorOptions(): Promise<{ id: string; personId: string; name: string }[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT i.id, i.person_id, p.name FROM instructors i JOIN people p ON p.id = i.person_id
        WHERE i.stage IN ('eligible','active') ORDER BY p.name LIMIT 500`,
    )
    .all()) as any[];
  return rows.map((row) => ({ id: String(row.id), personId: String(row.person_id), name: String(row.name) }));
}

/* ---------------- ready for more responsibility ---------------- */

export interface ReadyForMoreRow {
  instructorId: string;
  personId: string;
  name: string;
  reason: string;
}

/**
 * Evidence that an instructor may be ready for greater responsibility — the
 * founder decides. Two verifiable signals: sustained teaching with no lead
 * role yet, and multiple referred instructors who became active.
 */
export async function getReadyForMoreResponsibility(): Promise<ReadyForMoreRow[]> {
  const db = getDb();
  let rows: any[] = [];
  try {
    rows = (await db
    .prepare(
      `WITH taught AS (
         SELECT ci.instructor_id,
                COUNT(DISTINCT cs.id) AS sessions,
                COUNT(DISTINCT CASE WHEN ci.role = 'lead' THEN c.program_id END) AS programs_led
           FROM class_instructors ci
           JOIN classes c ON c.id = ci.class_id
           LEFT JOIN class_sessions cs ON cs.class_id = ci.class_id
            AND cs.session_date >= ci.added_at
            AND (ci.removed_at IS NULL OR cs.session_date < ci.removed_at)
          GROUP BY ci.instructor_id
       ), referred AS (
         SELECT referred_by_person_id AS person_id, COUNT(*) FILTER (WHERE stage = 'active') AS active_refs
           FROM instructors WHERE referred_by_person_id IS NOT NULL GROUP BY referred_by_person_id
       )
       SELECT i.id AS instructor_id, i.person_id, p.name,
              COALESCE(t.sessions, 0) AS sessions,
              COALESCE(t.programs_led, 0) AS programs_led,
              COALESCE(r.active_refs, 0) AS active_refs
         FROM instructors i
         JOIN people p ON p.id = i.person_id
         LEFT JOIN taught t ON t.instructor_id = i.id
         LEFT JOIN referred r ON r.person_id = i.person_id
        WHERE i.stage IN ('eligible','active') AND i.eligibility_status = 'eligible'
          AND ((COALESCE(t.sessions, 0) >= 8 AND COALESCE(t.programs_led, 0) = 0)
               OR COALESCE(r.active_refs, 0) >= 2)
        ORDER BY COALESCE(r.active_refs, 0) DESC, COALESCE(t.sessions, 0) DESC
        LIMIT 25`,
    )
    .all()) as any[];
  } catch {
    rows = [];
  }
  return rows.map((row) => {
    const sessions = num(row.sessions);
    const activeRefs = num(row.active_refs);
    const reasons: string[] = [];
    if (sessions >= 8 && num(row.programs_led) === 0) reasons.push(`${sessions} sessions taught, not yet leading a program`);
    if (activeRefs >= 2) reasons.push(`referred ${activeRefs} instructors who became active`);
    return {
      instructorId: String(row.instructor_id),
      personId: String(row.person_id),
      name: String(row.name),
      reason: reasons.join(" · ") || "Sustained contribution",
    };
  });
}

/* ---------------- staffing board ---------------- */

export interface StaffingNeedRow {
  classId: string;
  title: string;
  programName: string | null;
  status: string;
  startDate: string | null;
  need: StaffingNeed;
  candidates: RankedCandidate[];
}

export interface StaffingBoard {
  needs: StaffingNeedRow[];
  unfilledSlots: number;
  readyInstructors: number;
  overloadedInstructors: number;
  totalHeadroom: number;
  capacityGap: number;
}

async function loadCandidatePool(now: number): Promise<StaffingCandidate[]> {
  const recent = now - 90 * DAY_MS;
  const cutoff180 = now - 180 * DAY_MS;
  const rows = (await getDb()
    .prepare(
      `SELECT i.id, i.person_id, p.name, i.max_weekly_classes,
              (SELECT COUNT(*) FROM class_instructors ci JOIN classes c ON c.id = ci.class_id
                WHERE ci.instructor_id = i.id AND ci.removed_at IS NULL
                  AND c.status IN (${ACTIVE_CLASS_STATUSES})) AS current_load,
              (SELECT COUNT(DISTINCT cs.id) FROM class_instructors ci JOIN class_sessions cs ON cs.class_id = ci.class_id
                WHERE ci.instructor_id = i.id AND cs.session_date <= ?
                  AND cs.session_date >= ci.added_at
                  AND (ci.removed_at IS NULL OR cs.session_date < ci.removed_at)) AS sessions_taught,
              (SELECT COUNT(*) FROM instructor_feedback f
                WHERE f.instructor_id = i.id AND f.created_at >= ?
                  AND f.organization_reliability IS NOT NULL AND f.organization_reliability <= 2) AS low_reliability,
              (SELECT AVG(f.curriculum_delivery) FROM instructor_feedback f
                WHERE f.instructor_id = i.id AND f.created_at >= ? AND f.curriculum_delivery IS NOT NULL) AS quality_avg,
              COALESCE((SELECT bool_or(q.value IN ('online','hybrid','all')) FROM instructor_qualifications q
                         WHERE q.instructor_id = i.id AND q.kind = 'format' AND q.status = 'approved'), true) AS online_capable,
              COALESCE((SELECT bool_or(q.value IN ('in_person','hybrid','all')) FROM instructor_qualifications q
                         WHERE q.instructor_id = i.id AND q.kind = 'format' AND q.status = 'approved'), true) AS in_person_capable
         FROM instructors i
         JOIN people p ON p.id = i.person_id
        WHERE i.stage IN ('eligible','active') AND i.eligibility_status = 'eligible'`,
    )
    .all(now, cutoff180, recent)) as any[];
  return rows.map((row) => ({
    instructorId: String(row.id),
    personId: String(row.person_id),
    name: String(row.name),
    currentLoad: num(row.current_load),
    maxWeeklyClasses: Number(row.max_weekly_classes) || 3,
    onlineCapable: row.online_capable !== false,
    inPersonCapable: row.in_person_capable !== false,
    lowReliabilitySignals: num(row.low_reliability),
    qualityAverage: row.quality_avg == null ? null : Number(row.quality_avg),
    sessionsTaught: num(row.sessions_taught),
  }));
}

/**
 * Connects upcoming program demand to the instructor base: which classes need
 * a lead, how big the capacity gap is, and — for each gap — a strong filtered
 * shortlist of available, suitable instructors. The founder decides; the
 * assignment still happens through the canonical Class flow.
 */
export async function getStaffingBoard(now = Date.now()): Promise<StaffingBoard> {
  const db = getDb();
  const pool = await loadCandidatePool(now);
  const totalHeadroom = pool.reduce((sum, candidate) => sum + Math.max(0, candidate.maxWeeklyClasses - candidate.currentLoad), 0);
  const overloadedInstructors = pool.filter((candidate) => candidate.currentLoad > candidate.maxWeeklyClasses).length;

  const needRows = (await db
    .prepare(
      `SELECT c.id, c.title, c.status, c.start_date, c.online_format, c.location_id, c.location, p.name AS program_name
         FROM classes c
         LEFT JOIN programs p ON p.id = c.program_id
        WHERE c.status IN ('planning','staffing','ready_to_launch')
          AND (c.lead_instructor_id IS NULL
               OR NOT EXISTS (SELECT 1 FROM instructors i WHERE i.id = c.lead_instructor_id
                               AND i.eligibility_status = 'eligible' AND i.stage IN ('eligible','active')))
        ORDER BY c.start_date NULLS LAST, c.updated_at
        LIMIT 12`,
    )
    .all()) as any[];

  const needs: StaffingNeedRow[] = needRows.map((row) => {
    const online = Boolean(row.online_format);
    const inPerson = Boolean(row.location_id) || Boolean(row.location) || !online;
    const need: StaffingNeed = { online, inPerson };
    return {
      classId: String(row.id),
      title: String(row.title),
      programName: row.program_name ?? null,
      status: String(row.status),
      startDate: row.start_date ?? null,
      need,
      candidates: rankStaffingCandidates(pool, need).slice(0, 3),
    };
  });

  const unfilledSlots = needRows.length;
  return {
    needs,
    unfilledSlots,
    readyInstructors: pool.length,
    overloadedInstructors,
    totalHeadroom,
    capacityGap: Math.max(0, unfilledSlots - totalHeadroom),
  };
}
