/* ============================================================
 * The direct class record — one operational page.
 *
 * Everything here is assembled from the canonical systems: seats from
 * lib/enrollment (never recounted by hand), sessions from class_sessions,
 * roster from class_enrollments joined to the registrations that hold seats,
 * messages from family_notifications, exceptions from the same records HQ
 * Home's queue reads. Resolving something in either place resolves it in both,
 * because both are looking at the same row.
 *
 * The Program/Class split stays in the database. Nothing this module returns
 * names it.
 *
 * Server-only. Browser-safe types live in lib/class-record-shared.ts.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { seatCounts } from "@/lib/enrollment";
import { canonicalDateInZone, DEFAULT_TIME_ZONE } from "@/lib/timezone";
import type {
  ClassRecord,
  ClassRun,
  FamilyMessage,
  PrimaryAction,
  RosterEntry,
} from "@/lib/class-record-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The one loudest button, derived from where the class actually is.
 *
 * Order matters: a blocking exception outranks everything, then a session
 * happening now, then the lifecycle. Share-the-link is never permanently the
 * loudest thing — it stops being the next thing to do the moment the class is
 * full or the first session arrives.
 */
export function resolvePrimaryAction(input: {
  classId: string;
  status: string;
  isPublic: boolean;
  seatsRemaining: number | null;
  todaySessionId: string | null;
  nextSessionId: string | null;
  exceptionCount: number;
  publicSlug: string | null;
  ended: boolean;
}): PrimaryAction {
  if (input.todaySessionId) {
    return { kind: "open-session", label: "Open session sheet", href: `/app/session/${input.todaySessionId}` };
  }
  if (input.exceptionCount > 0) {
    return { kind: "resolve", label: "Resolve issue", href: `/app/classes/${input.classId}#needs-attention` };
  }
  if (input.ended) {
    return { kind: "close", label: "Close class", href: null };
  }
  if (input.status === "planning" || input.status === "staffing" || !input.isPublic) {
    return { kind: "open-registration", label: "Open registration", href: null };
  }
  if (input.seatsRemaining !== null && input.seatsRemaining <= 0) {
    return { kind: "view-waitlist", label: "Review the waitlist", href: `/app/classes/${input.classId}#roster` };
  }
  return {
    kind: "share",
    label: "Share registration link",
    href: input.publicSlug ? `/programs/p/${input.publicSlug}` : null,
  };
}

export async function getClassRecord(classId: string, now = Date.now()): Promise<ClassRecord | null> {
  const db = getDb();

  const row = (await db
    .prepare(
      `SELECT c.*, p.id AS program_id, p.public_slug, p.is_public, p.name AS program_name,
              p.partner_org_id AS program_partner_org_id, p.registration_status,
              cur.title AS course_title, cur.id AS course_id,
              o.name AS partner_name
         FROM classes c
         LEFT JOIN programs p ON p.id = c.program_id
         LEFT JOIN curricula cur ON cur.id = COALESCE(c.curriculum_id, p.curriculum_id)
         LEFT JOIN organizations o ON o.id = COALESCE(c.partner_org_id, p.partner_org_id)
        WHERE c.id = ?`,
    )
    .get(classId)) as any;
  if (!row) return null;

  const seats = await seatCounts(classId, row.capacity ?? null);
  const today = canonicalDateInZone(now, row.schedule_timezone ?? DEFAULT_TIME_ZONE);

  /* ---- The run ---- */
  const sessionRows = (await db
    .prepare(
      `SELECT s.id, s.session_date, s.session_on, s.timezone, s.title, s.lesson_id, s.status,
              (SELECT COUNT(*) FROM class_session_reports r WHERE r.session_id = s.id AND r.completed = 1) AS completed,
              (SELECT COUNT(*) FROM class_session_reports r WHERE r.session_id = s.id AND r.flagged = 1) AS flagged
         FROM class_sessions s
        WHERE s.class_id = ?
        ORDER BY s.session_date`,
    )
    .all(classId)) as any[];

  const run: ClassRun[] = sessionRows.map((s, index) => ({
    id: s.id,
    index: index + 1,
    sessionOn: s.session_on,
    sessionDate: Number(s.session_date),
    timezone: s.timezone ?? row.schedule_timezone ?? DEFAULT_TIME_ZONE,
    title: s.title ?? null,
    status: s.status ?? "scheduled",
    completed: Number(s.completed ?? 0) > 0,
    flagged: Number(s.flagged ?? 0) > 0,
  }));

  const todaySession = run.find((s) => s.sessionOn === today && s.status === "scheduled") ?? null;
  const nextSession = run.find((s) => s.status === "scheduled" && s.sessionDate >= now) ?? null;
  const ended = run.length > 0 && run.every((s) => s.status !== "scheduled");

  /* ---- Roster ----
     Registrations are the source of truth for a seat's state; enrollments say
     who is on the class list. A confirmed child has both, so this reads from
     registrations and falls back to enrollment-only rows. */
  const rosterRows = (await db
    .prepare(
      `SELECT s.id AS student_id, s.name, s.grade,
              g.name AS guardian_name,
              r.status AS registration_status, r.id AS registration_id,
              (SELECT w.expires_at FROM waitlist_offers w
                WHERE w.registration_id = r.id AND w.status = 'sent' LIMIT 1) AS offer_expires_at,
              s.duplicate_review_status,
              ce.status AS enrollment_status
         FROM students s
         LEFT JOIN people g ON g.id = s.guardian_person_id
         LEFT JOIN class_enrollments ce ON ce.class_id = ? AND ce.student_id = s.id
         LEFT JOIN program_registrations r ON r.student_id = s.id AND r.program_id = ?
        WHERE (ce.id IS NOT NULL AND ce.status = 'enrolled')
           OR (r.id IS NOT NULL AND r.status NOT IN ('withdrawn','expired','declined','cancelled'))
        ORDER BY s.name`,
    )
    .all(classId, row.program_id)) as any[];

  const roster: RosterEntry[] = rosterRows.map((r) => ({
    studentId: r.student_id,
    name: r.name,
    grade: r.grade ?? null,
    guardianName: r.guardian_name ?? null,
    registrationId: r.registration_id ?? null,
    registrationStatus: r.registration_status ?? r.enrollment_status ?? "enrolled",
    offerExpiresAt: r.offer_expires_at ? Number(r.offer_expires_at) : null,
    needsIdentityReview: r.duplicate_review_status === "open",
  }));

  /* ---- Messages to families ---- */
  const messageRows = (await db
    .prepare(
      `SELECT n.id, n.title, n.created_at, COUNT(*) AS recipients,
              SUM(CASE WHEN n.status = 'sent' THEN 1 ELSE 0 END) AS delivered
         FROM family_notifications n
        WHERE n.program_id = ?
        GROUP BY n.id, n.title, n.created_at
        ORDER BY n.created_at DESC
        LIMIT 5`,
    )
    .all(row.program_id)
    .catch(() => [])) as any[];

  const messages: FamilyMessage[] = (messageRows ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    sentAt: Number(m.created_at),
    recipients: Number(m.recipients ?? 0),
    delivered: Number(m.delivered ?? 0),
  }));

  /* ---- Exceptions: the same records HQ Home's queue holds ---- */
  const exceptions: ClassRecord["exceptions"] = [];
  for (const entry of roster) {
    if (entry.offerExpiresAt && entry.offerExpiresAt - now < 72 * 60 * 60 * 1000) {
      exceptions.push({
        key: `offer:${entry.registrationId}`,
        title: `${entry.name}'s waitlist offer expires soon`,
        detail: `${Math.max(0, Math.round((entry.offerExpiresAt - now) / (60 * 60 * 1000)))}h left`,
      });
    }
    if (entry.needsIdentityReview) {
      exceptions.push({
        key: `duplicate:${entry.studentId}`,
        title: `${entry.name} may be a duplicate record`,
        detail: "Resolve from Home — duplicates are never merged automatically",
      });
    }
  }
  for (const session of run) {
    if (session.flagged) {
      exceptions.push({
        key: `flag:${session.id}`,
        title: `Session ${session.index} was flagged`,
        detail: "An instructor raised something after class",
      });
    }
  }

  const instructorRows = (await db
    .prepare(
      `SELECT p.name
         FROM class_instructors ci
         JOIN instructors i ON i.id = ci.instructor_id
         JOIN people p ON p.id = i.person_id
        WHERE ci.class_id = ? AND ci.removed_at IS NULL`,
    )
    .all(classId)) as { name: string }[];

  return {
    now,
    id: row.id,
    title: row.title,
    status: row.status,
    isPublic: Boolean(row.is_public),
    publicSlug: row.public_slug ?? null,
    partnerName: row.partner_name ?? null,
    courseId: row.course_id ?? null,
    courseTitle: row.course_title ?? null,
    gradeRange: row.age_range ?? null,
    startTime: row.schedule_start_time ?? null,
    endTime: row.schedule_end_time ?? null,
    timezone: row.schedule_timezone ?? DEFAULT_TIME_ZONE,
    scheduleLabel: row.recurrence ?? null,
    capacity: seats.capacity,
    seatsTaken: seats.taken,
    seatsRemaining: seats.remaining,
    waitlisted: roster.filter((r) => r.registrationStatus === "waitlisted").length,
    confirmed: roster.filter((r) => r.registrationStatus === "confirmed" || r.registrationStatus === "enrolled").length,
    instructorNames: instructorRows.map((i) => i.name),
    run,
    nextSessionId: nextSession?.id ?? null,
    todaySessionId: todaySession?.id ?? null,
    roster,
    messages,
    exceptions,
    primary: resolvePrimaryAction({
      classId: row.id,
      status: row.status,
      isPublic: Boolean(row.is_public),
      seatsRemaining: seats.remaining,
      todaySessionId: todaySession?.id ?? null,
      nextSessionId: nextSession?.id ?? null,
      exceptionCount: exceptions.length,
      publicSlug: row.public_slug ?? null,
      ended,
    }),
  };
}

export { DAY_MS };
