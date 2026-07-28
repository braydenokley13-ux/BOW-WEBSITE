/* ============================================================
 * Public program discovery — server-only reads for the finder and the
 * public program detail page.
 *
 * Read-only counterpart to lib/enrollment.ts: it never decides a seat or
 * writes a row, it only assembles what a family is allowed to see. Every
 * availability word it returns comes from publicAvailability() /
 * availabilityLabel() in lib/enrollment-shared.ts — this module never
 * invents its own vocabulary for a program's internal stage.
 * ============================================================ */

import "server-only";

import { getDb } from "@/lib/db";
import {
  availabilityLabel,
  gradeRangeLabel,
  publicAvailability,
  type PublicAvailability,
  type RegistrationProgram,
} from "@/lib/enrollment-shared";
import { loadRegistrationProgram, primaryClassFor, seatCounts } from "@/lib/enrollment";

/* ===================================================================== */
/* Shared shape                                                          */
/* ===================================================================== */

export interface DiscoveryProgram {
  id: string;
  name: string;
  shortDescription: string | null;
  longDescription: string | null;
  gradeMin: number | null;
  gradeMax: number | null;
  gradeRangeLabel: string;
  experienceLevel: string | null;
  deliveryFormat: string | null;
  scheduleLabel: string | null;
  scheduleDay: number | null;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  scheduleTimezone: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  availability: PublicAvailability;
  availabilityLabel: string;
  seatsRemaining: number | null;
}

const PROGRAM_ROW_COLUMNS = `id, name, short_description, long_description, grade_min, grade_max,
    experience_level, delivery_format, schedule_label, schedule_day, schedule_start_time,
    schedule_end_time, schedule_timezone, start_date, end_date, is_public, public_status,
    capacity, registration_mode, full_capacity_behavior, registration_deadline,
    registration_opens_at, reservation_enabled, reservation_hours, waitlist_mode,
    waitlist_offer_hours`;

interface ProgramRow extends RegistrationProgram {
  short_description: string | null;
  long_description: string | null;
  experience_level: string | null;
  delivery_format: string | null;
  schedule_label: string | null;
  schedule_day: number | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  end_date: string | null;
}

async function classLocation(programId: string): Promise<string | null> {
  const db = getDb();
  const row = (await db
    .prepare(
      `SELECT location FROM classes
        WHERE program_id = ? AND status NOT IN ('completed', 'cancelled')
        ORDER BY created_at LIMIT 1`,
    )
    .get(programId)) as { location: string | null } | undefined;
  return row?.location ?? null;
}

async function toDiscoveryProgram(row: ProgramRow): Promise<DiscoveryProgram> {
  const primary = await primaryClassFor(row.id);
  const counts = primary
    ? await seatCounts(primary.id, primary.capacity ?? row.capacity)
    : { remaining: row.capacity };
  const availability = publicAvailability(row, counts.remaining);
  return {
    id: row.id,
    name: row.name,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    gradeMin: row.grade_min,
    gradeMax: row.grade_max,
    gradeRangeLabel: gradeRangeLabel(row),
    experienceLevel: row.experience_level,
    deliveryFormat: row.delivery_format,
    scheduleLabel: row.schedule_label,
    scheduleDay: row.schedule_day,
    scheduleStartTime: row.schedule_start_time,
    scheduleEndTime: row.schedule_end_time,
    scheduleTimezone: row.schedule_timezone,
    startDate: row.start_date,
    endDate: row.end_date,
    location: await classLocation(row.id),
    availability,
    availabilityLabel: availabilityLabel(availability),
    seatsRemaining: counts.remaining,
  };
}

/**
 * Every public program, for the guided finder. Small program count expected
 * (dozens, not thousands) so matching happens in memory rather than pushing
 * the "interest" heuristic into SQL.
 */
export async function listDiscoveryPrograms(): Promise<DiscoveryProgram[]> {
  const db = getDb();
  const rows = (await db
    .prepare(`SELECT ${PROGRAM_ROW_COLUMNS} FROM programs WHERE is_public = true ORDER BY start_date NULLS LAST, name`)
    .all()) as unknown as ProgramRow[];
  return Promise.all(rows.map(toDiscoveryProgram));
}

/* ===================================================================== */
/* Public program detail page                                           */
/* ===================================================================== */

export interface DetailInstructor {
  name: string;
  role: string;
}

export interface DetailSession {
  date: string;
  title: string | null;
}

export interface DetailRequirement {
  kind: string;
  prompt: string;
  required: boolean;
}

export interface PublicProgramDetail extends DiscoveryProgram {
  registrationDeadline: string | null;
  registrationOpensAt: string | null;
  registrationMode: "immediate" | "approval";
  waitlistMode: "disabled" | "automatic" | "manual";
  instructors: DetailInstructor[];
  upcomingSessions: DetailSession[];
  requirements: DetailRequirement[];
}

/**
 * A program's public detail row, or null if it doesn't exist or isn't
 * public. `is_public = true` is enforced in SQL, not just checked after —
 * a program row a family should never see is never fetched at all.
 */
export async function getPublicProgramDetail(id: string): Promise<PublicProgramDetail | null> {
  const db = getDb();
  const row = (await db
    .prepare(`SELECT ${PROGRAM_ROW_COLUMNS} FROM programs WHERE id = ? AND is_public = true`)
    .get(id)) as ProgramRow | undefined;
  if (!row) return null;

  const base = await toDiscoveryProgram(row);
  const primary = await primaryClassFor(row.id);

  // Only an *accepted* assignment is ever shown — a proposed-but-unanswered
  // instructor assignment is an internal staffing detail, not something a
  // family should see as "who is teaching this."
  const instructors = primary
    ? ((await db
        .prepare(
          `SELECT p.name, ci.role FROM class_instructors ci
             JOIN instructors i ON i.id = ci.instructor_id
             JOIN people p ON p.id = i.person_id
            WHERE ci.class_id = ? AND ci.assignment_status = 'accepted' AND ci.removed_at IS NULL
            ORDER BY ci.role, p.name`,
        )
        .all(primary.id)) as unknown as { name: string; role: string }[])
    : [];

  const upcomingSessions = primary
    ? ((await db
        .prepare(
          `SELECT session_date, title FROM class_sessions
            WHERE class_id = ? AND status <> 'cancelled'
            ORDER BY session_date LIMIT 12`,
        )
        .all(primary.id)) as unknown as { session_date: number; title: string | null }[])
    : [];

  const requirements = (await db
    .prepare(
      `SELECT kind, prompt, required FROM program_requirements
        WHERE program_id = ? AND active = true
        ORDER BY sort_order`,
    )
    .all(row.id)) as unknown as { kind: string; prompt: string; required: boolean }[];

  return {
    ...base,
    registrationDeadline: row.registration_deadline,
    registrationOpensAt: row.registration_opens_at,
    registrationMode: row.registration_mode,
    waitlistMode: row.waitlist_mode,
    instructors: instructors.map((i) => ({ name: i.name, role: i.role === "lead" ? "Lead instructor" : "Instructor" })),
    upcomingSessions: upcomingSessions.map((s) => ({
      date: new Date(s.session_date).toISOString().slice(0, 10),
      title: s.title,
    })),
    requirements: requirements.map((r) => ({ kind: r.kind, prompt: r.prompt, required: r.required })),
  };
}

/** Minimal shape for the registration wizard's program picker. */
export interface RegisterableProgram {
  id: string;
  name: string;
  gradeMin: number | null;
  gradeMax: number | null;
  gradeRangeLabel: string;
  startDate: string | null;
  deliveryFormat: string | null;
  availability: PublicAvailability;
  availabilityLabel: string;
}

export async function listRegisterablePrograms(): Promise<RegisterableProgram[]> {
  const programs = await listDiscoveryPrograms();
  return programs
    .filter((p) => p.availability !== "coming_soon" && p.availability !== "registration_closed")
    .map((p) => ({
      id: p.id,
      name: p.name,
      gradeMin: p.gradeMin,
      gradeMax: p.gradeMax,
      gradeRangeLabel: p.gradeRangeLabel,
      startDate: p.startDate,
      deliveryFormat: p.deliveryFormat,
      availability: p.availability,
      availabilityLabel: p.availabilityLabel,
    }));
}

export async function getRegisterableProgram(id: string): Promise<RegisterableProgram | null> {
  const all = await listRegisterablePrograms();
  return all.find((p) => p.id === id) ?? null;
}

/**
 * loadRegistrationProgram is re-exported so pages that need the pure
 * eligibility check (checkEligibility from lib/enrollment-shared) can load a
 * program's grade window without duplicating the query here.
 */
export { loadRegistrationProgram };
