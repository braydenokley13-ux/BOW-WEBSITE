/* ============================================================
 * The partner Program record.
 *
 * A school runs several sections on a schedule somebody negotiated, and the
 * staffing may not be settled. That structure is real, so unlike a direct
 * class this record shows it — in the words the partner conversation uses.
 *
 * Readiness is reused, not rebuilt: `getProgramReadiness` already knows every
 * fact that has to be true before a Program can run. What changes here is the
 * editorial judgment about it. The old surface rendered a percentage, a
 * progress ring and eighteen rows of amber; this one shows the handful of
 * things that would genuinely stop the Program starting, and states the rest
 * as decisions nobody has made yet — because a partner Program can be
 * completely healthy with half of them open.
 *
 * Server-only. Types and language live in lib/partner-program-shared.ts.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { seatCounts } from "@/lib/enrollment";
import { getProgramReadiness } from "@/lib/operations";
import {
  blockerAppliesAtStage,
  programStatusLabel,
  programStatusLine,
  scheduleLine,
  type PartnerProgramRecord,
  type ProgramBlocker,
  type ProgramOpenQuestion,
  type ProgramSection,
} from "@/lib/partner-program-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const HISTORICAL_STAGES = ["completed", "renewal_review", "renewed", "closed"];

const SECTION_STATUS_LABEL: Record<string, string> = {
  active: "Running",
  planning: "Being planned",
  paused: "On hold",
  completed: "Finished",
  cancelled: "Cancelled",
};

/**
 * Readiness items the partner record deliberately never shows.
 *
 * Each is either internal machinery with no partner-facing meaning, or a fact
 * this page already states in plain words further down. Repeating them as
 * blockers is how a record becomes a compliance checklist.
 */
const SUPPRESSED_READINESS = new Set([
  "class_alignment",
  "staffing_clearance",
  "instructor_portal_access",
  "materials",
]);

export async function getPartnerProgramRecord(
  programId: string,
  now = Date.now(),
): Promise<PartnerProgramRecord | null> {
  const db = getDb();

  const row = (await db
    .prepare(
      `SELECT p.id, p.name, p.stage, p.partner_org_id, p.location_id, p.curriculum_id,
              p.delivery_format, p.is_public, p.start_date, p.end_date, p.schedule_label,
              p.schedule_start_time, p.schedule_end_time, p.schedule_timezone, p.capacity,
              p.source_type,
              o.name AS partner_name, l.name AS location_name, cur.title AS course_title
         FROM programs p
         LEFT JOIN organizations o ON o.id = p.partner_org_id
         LEFT JOIN locations l ON l.id = p.location_id
         LEFT JOIN curricula cur ON cur.id = p.curriculum_id
        WHERE p.id = ?`,
    )
    .get(programId)) as any;
  if (!row) return null;

  const classRows = (await db
    .prepare(
      `SELECT c.id, c.title, c.status, c.capacity, c.recurrence,
              c.schedule_start_time, c.schedule_end_time,
              (SELECT COUNT(*) FROM class_sessions s WHERE s.class_id = c.id AND s.status <> 'cancelled') AS sessions_total,
              (SELECT COUNT(*) FROM class_sessions s
                 JOIN class_session_reports r ON r.session_id = s.id AND r.completed = 1
                WHERE s.class_id = c.id) AS sessions_done
         FROM classes c
        WHERE c.program_id = ?
        ORDER BY c.start_date NULLS LAST, c.created_at, c.id`,
    )
    .all(programId)) as any[];

  const sections: ProgramSection[] = [];
  for (const classRow of classRows) {
    const [seats, instructors, nextSession] = await Promise.all([
      seatCounts(classRow.id, classRow.capacity ?? null),
      db
        .prepare(
          `SELECT pe.name
             FROM class_instructors ci
             JOIN instructors i ON i.id = ci.instructor_id
             LEFT JOIN people pe ON pe.id = i.person_id
            WHERE ci.class_id = ? AND ci.removed_at IS NULL AND ci.assignment_status = 'accepted'
            ORDER BY CASE ci.role WHEN 'lead' THEN 0 ELSE 1 END, pe.name`,
        )
        .all(classRow.id) as Promise<{ name: string | null }[]>,
      db
        .prepare(
          `SELECT id, session_on FROM class_sessions
            WHERE class_id = ? AND status = 'scheduled' AND session_date >= ?
            ORDER BY session_date LIMIT 1`,
        )
        .get(classRow.id, now) as Promise<{ id: string; session_on: string | null } | undefined>,
    ]);

    sections.push({
      id: classRow.id,
      title: classRow.title,
      scheduleLine: scheduleLine({
        label: classRow.recurrence ?? null,
        startTime: classRow.schedule_start_time ?? null,
        endTime: classRow.schedule_end_time ?? null,
      }),
      instructorNames: instructors.map((i) => i.name ?? "Unnamed"),
      seatsTaken: seats.taken,
      capacity: seats.capacity,
      sessionsTotal: Number(classRow.sessions_total ?? 0),
      sessionsDone: Number(classRow.sessions_done ?? 0),
      nextSessionId: nextSession?.id ?? null,
      nextSessionOn: nextSession?.session_on ?? null,
      status: classRow.status,
      statusLabel: SECTION_STATUS_LABEL[classRow.status] ?? classRow.status.replace(/_/g, " "),
    });
  }

  const readiness = await getProgramReadiness(programId);

  const blockers: ProgramBlocker[] = readiness
    ? readiness.blockers
        .filter((item) => !SUPPRESSED_READINESS.has(item.key) && blockerAppliesAtStage(item.key, row.stage))
        .map((item) => ({
          key: item.key,
          title: item.label,
          detail: item.detail,
          actionLabel: item.actionLabel,
          actionHref: item.actionHref,
        }))
    : [];

  /* ---- What has not been decided yet ----
     The same facts, before they are allowed to be failures. Stated rather
     than scored: an empty answer here is a normal early-conversation state. */
  const openQuestions: ProgramOpenQuestion[] = [
    { key: "course", label: "Course", value: row.course_title ?? null },
    {
      key: "sections",
      label: "Sections",
      value: sections.length ? `${sections.length}` : null,
    },
    {
      key: "schedule",
      label: "Schedule",
      // A Program-level schedule is what was negotiated; when nobody wrote one
      // down, the sections still know when they meet, and that is the honest
      // answer rather than "not decided" beside a section saying "Tuesdays".
      value:
        scheduleLine({
          label: row.schedule_label ?? null,
          startTime: row.schedule_start_time ?? null,
          endTime: row.schedule_end_time ?? null,
        })
        ?? (() => {
          const lines = [...new Set(sections.map((section) => section.scheduleLine).filter(Boolean))] as string[];
          return lines.length ? lines.join(" · ") : null;
        })(),
    },
    {
      key: "dates",
      label: "Dates",
      value: row.start_date ? `${row.start_date}${row.end_date ? ` – ${row.end_date}` : ""}` : null,
    },
    {
      key: "staffing",
      label: "Who teaches it",
      value: (() => {
        const names = [...new Set(sections.flatMap((section) => section.instructorNames))];
        return names.length ? names.join(", ") : null;
      })(),
    },
    {
      key: "where",
      label: "Where",
      value: row.delivery_format === "online" ? "Online" : (row.location_name ?? null),
    },
  ];

  const seatsTaken = sections.reduce((total, section) => total + section.seatsTaken, 0);
  const capacity = sections.reduce<number | null>(
    (total, section) => (section.capacity == null ? total : (total ?? 0) + section.capacity),
    null,
  );

  /* ---- The one next thing ----
     A session happening now outranks everything, then a real blocker, then
     whatever readiness already worked out. Nothing is invented here. */
  const todaySession = sections.find((section) => section.nextSessionOn && section.nextSessionOn === isoDate(now));
  const next = todaySession?.nextSessionId
    ? { label: "Open today's session", href: `/app/session/${todaySession.nextSessionId}` }
    : blockers.length > 0
      ? { label: blockers[0].actionLabel ?? "Resolve it", href: blockers[0].actionHref ?? `/app/programs/${programId}#blocked` }
      : sections.length === 0
        ? { label: "Add a section", href: `/app/classes/new?program=${programId}` }
        : readiness?.nextAction
          ? { label: readiness.nextAction.label, href: readiness.nextAction.href }
          : null;

  return {
    now,
    id: row.id,
    name: row.name,
    partnerId: row.partner_org_id ?? null,
    partnerName: row.partner_name ?? null,
    locationName: row.location_name ?? null,
    deliveryFormat: row.delivery_format ?? "in_person",
    stage: row.stage,
    statusLabel: programStatusLabel(row.stage),
    statusLine: programStatusLine({
      stage: row.stage,
      sections: sections.length,
      seatsTaken,
      blockers: blockers.length,
      startDate: row.start_date ?? null,
    }),
    courseId: row.curriculum_id ?? null,
    courseTitle: row.course_title ?? null,
    rosterSource: row.is_public ? "families" : "partner",
    scheduleLine: scheduleLine({
      label: row.schedule_label ?? null,
      startTime: row.schedule_start_time ?? null,
      endTime: row.schedule_end_time ?? null,
    }),
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    sections,
    seatsTaken,
    capacity,
    blockers,
    openQuestions,
    next,
    isHistorical: HISTORICAL_STAGES.includes(row.stage),
  };
}

function isoDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

/**
 * The delivery Class a direct-posted Program is really about.
 *
 * A class posted from the composer gets a Program because the schema needs
 * one, not because anyone decided to run a partner programme. Landing on its
 * Program record would show the operator the split V1 exists to hide, so the
 * page redirects to the class instead.
 */
export async function directClassForProgram(programId: string): Promise<string | null> {
  const row = (await getDb()
    .prepare(
      `SELECT c.id
         FROM programs p
         JOIN classes c ON c.program_id = p.id
        WHERE p.id = ? AND p.source_type = 'direct'
        ORDER BY c.created_at, c.id
        LIMIT 1`,
    )
    .get(programId)) as { id: string } | undefined;
  return row?.id ?? null;
}

/**
 * The class each direct-posted Program is really about, keyed by program id.
 *
 * A Programs index that lists a posted class as a "Program" is the split V1
 * hides leaking into the surface that names it. One query so the list can
 * render those rows as what they are — a class, linking to the class record.
 */
export async function directClassIdsByProgram(): Promise<Map<string, { classId: string; title: string }>> {
  const rows = (await getDb()
    .prepare(
      `SELECT DISTINCT ON (p.id) p.id AS program_id, c.id AS class_id, c.title
         FROM programs p
         JOIN classes c ON c.program_id = p.id
        WHERE p.source_type = 'direct'
        ORDER BY p.id, c.created_at, c.id`,
    )
    .all()) as { program_id: string; class_id: string; title: string }[];
  return new Map(rows.map((row) => [row.program_id, { classId: row.class_id, title: row.title }]));
}
