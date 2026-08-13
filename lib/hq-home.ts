/* ============================================================
 * HQ Home — the founder's daily operating surface.
 *
 * Home answers three questions and nothing else: what is happening today,
 * what needs me, and what is new. It is not a dashboard, so nothing here
 * computes a metric for its own sake.
 *
 * Every exception below is DERIVED from records that already exist —
 * follow-up tasks, waitlist offers, duplicate reviews, attendance, flagged
 * session reports. There is no exceptions table, and deliberately so: a
 * stored queue drifts from the thing it describes, and the operator acts on
 * what the queue says.
 *
 * Each item carries the action that RESOLVES it. There is no dismiss, because
 * dismissing an exception only hides a fact that is still true.
 *
 * Server-only. Browser-safe types live in lib/hq-home-shared.ts.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { canonicalDateInZone, DEFAULT_TIME_ZONE, addCanonicalDays } from "@/lib/timezone";
import type {
  HqHomeData,
  QueueAction,
  QueueItem,
  TickerItem,
  TodaySession,
  WeekDigest,
} from "@/lib/hq-home-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Offers inside this window are close enough to expiry to be worth a decision. */
const OFFER_WARNING_WINDOW_MS = 72 * HOUR_MS;

function hoursUntil(epoch: number, now: number): number {
  return Math.max(0, Math.round((epoch - now) / HOUR_MS));
}

function link(label: string, href: string): QueueAction {
  return { kind: "link", label, href };
}

/* ===================================================================== */
/* Today                                                                 */
/* ===================================================================== */

/**
 * Sessions happening today, in the class's own timezone. `session_on` is the
 * local calendar date recorded at creation, which is what makes "today" mean
 * the same thing to a founder in New York and a class scheduled elsewhere.
 */
export async function getTodaySessions(now = Date.now()): Promise<TodaySession[]> {
  const today = canonicalDateInZone(now, DEFAULT_TIME_ZONE);
  const rows = (await getDb()
    .prepare(
      `SELECT cs.id, cs.class_id, cs.session_date, cs.session_on, cs.timezone, cs.location,
              cs.meeting_link, cs.title, cs.lesson_id, cs.status,
              c.title AS class_title, c.schedule_timezone,
              (SELECT COUNT(*) FROM class_session_roster r WHERE r.session_id = cs.id) AS roster_count,
              (SELECT COUNT(*) FROM class_session_prep p
                WHERE p.session_id = cs.id AND p.status = 'ready') AS prep_ready,
              (SELECT COUNT(*) FROM class_instructors ci
                WHERE ci.class_id = cs.class_id AND ci.removed_at IS NULL
                  AND ci.assignment_status = 'accepted') AS instructor_count,
              (SELECT COUNT(*) FROM class_session_reports rep
                WHERE rep.session_id = cs.id AND rep.completed = 1) AS completed_count
         FROM class_sessions cs
         JOIN classes c ON c.id = cs.class_id
        WHERE cs.status = 'scheduled'
          AND cs.session_on = ?
        ORDER BY cs.session_date`,
    )
    .all(today)) as any[];

  return rows.map((row) => ({
    id: row.id,
    classId: row.class_id,
    classTitle: row.class_title,
    sessionDate: Number(row.session_date),
    timezone: row.timezone ?? row.schedule_timezone ?? DEFAULT_TIME_ZONE,
    location: row.location ?? null,
    meetingLink: row.meeting_link ?? null,
    title: row.title ?? null,
    lessonId: row.lesson_id ?? null,
    studentCount: Number(row.roster_count ?? 0),
    prepReady: Number(row.prep_ready ?? 0) > 0 && Number(row.prep_ready ?? 0) >= Number(row.instructor_count ?? 0),
    completed: Number(row.completed_count ?? 0) > 0,
  }));
}

/** The next scheduled session after today, so "tomorrow" can be a sentence. */
async function getNextSessionAfterToday(now: number): Promise<{ sessionOn: string; classTitle: string } | null> {
  const today = canonicalDateInZone(now, DEFAULT_TIME_ZONE);
  const row = (await getDb()
    .prepare(
      `SELECT cs.session_on, c.title AS class_title
         FROM class_sessions cs
         JOIN classes c ON c.id = cs.class_id
        WHERE cs.status = 'scheduled' AND cs.session_on > ?
        ORDER BY cs.session_date
        LIMIT 1`,
    )
    .get(today)) as any;
  return row ? { sessionOn: row.session_on, classTitle: row.class_title } : null;
}

/* ===================================================================== */
/* Needs you                                                             */
/* ===================================================================== */

/** Partner follow-ups that are due. Follow-ups are tasks; there is no separate store. */
async function followUpExceptions(now: number): Promise<QueueItem[]> {
  const today = canonicalDateInZone(now, DEFAULT_TIME_ZONE);
  const rows = (await getDb()
    .prepare(
      `SELECT t.id, t.title, t.due_on, t.context, t.entity_id,
              o.name AS org_name,
              (SELECT a.body FROM crm_activity a
                WHERE a.entity_type = 'organization' AND a.entity_id = t.entity_id AND a.kind = 'note'
                ORDER BY a.created_at DESC LIMIT 1) AS latest_note
         FROM tasks t
         LEFT JOIN organizations o ON o.id = t.entity_id
        WHERE t.status = 'open'
          AND t.kind = 'follow_up'
          AND t.entity_type = 'organization'
          AND t.due_on IS NOT NULL
          AND t.due_on <= ?
        ORDER BY t.due_on`,
    )
    .all(today)) as any[];

  return rows.map((row) => {
    const overdue = row.due_on < today;
    const note = (row.latest_note ?? "").trim();
    return {
      key: `follow-up:${row.id}`,
      kind: "follow_up" as const,
      tone: "attention" as const,
      title: row.org_name ? `${row.org_name} — ${row.title}` : row.title,
      context: [
        overdue ? `Due ${row.due_on}` : "Due today",
        note ? `last note: “${note.length > 90 ? `${note.slice(0, 87)}…` : note}”` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: row.entity_id ? `/app/partners/${row.entity_id}` : "/app/partners",
      dueAt: null,
      actions: [
        ...(row.entity_id ? [link("Open partner", `/app/partners/${row.entity_id}`)] : []),
        { kind: "complete-task", label: "Done", taskId: row.id },
        { kind: "snooze-task", label: "Snooze", taskId: row.id, days: 3 },
      ],
    };
  });
}

/** Waitlist offers close to expiring — the family loses the seat if nothing happens. */
async function waitlistOfferExceptions(now: number): Promise<QueueItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT w.id, w.registration_id, w.expires_at, w.program_id,
              s.name AS student_name, p.name AS program_name,
              (SELECT c.id FROM classes c WHERE c.program_id = w.program_id
                 AND c.status NOT IN ('completed','cancelled')
                ORDER BY c.created_at, c.id LIMIT 1) AS class_id
         FROM waitlist_offers w
         JOIN program_registrations r ON r.id = w.registration_id
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = w.program_id
        WHERE w.status = 'sent' AND w.expires_at <= ?
        ORDER BY w.expires_at`,
    )
    .all(now + OFFER_WARNING_WINDOW_MS)) as any[];

  return rows.map((row) => {
    const hours = hoursUntil(Number(row.expires_at), now);
    return {
      key: `offer:${row.id}`,
      kind: "waitlist_offer" as const,
      tone: "attention" as const,
      title: `${row.student_name}'s waitlist offer expires soon`,
      context: `${row.program_name} · expires in ${hours}h`,
      href: row.class_id ? `/app/classes/${row.class_id}` : null,
      dueAt: Number(row.expires_at),
      actions: [
        { kind: "extend-offer", label: "Extend 48h", offerId: row.id, hours: 48 },
        ...(row.class_id ? [link("View", `/app/classes/${row.class_id}`)] : []),
      ],
    };
  });
}

/**
 * Possible duplicate children. These are never merged automatically — the
 * queue exists precisely so a person decides.
 */
async function duplicateExceptions(): Promise<QueueItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT d.id, d.detected_reason,
              a.name AS student_name, a.grade AS student_grade,
              b.name AS other_name
         FROM student_duplicate_reviews d
         JOIN students a ON a.id = d.student_id
         JOIN students b ON b.id = d.other_student_id
        WHERE d.status = 'open'
        ORDER BY d.created_at DESC`,
    )
    .all()) as any[];

  return rows.map((row) => ({
    key: `duplicate:${row.id}`,
    kind: "duplicate" as const,
    tone: "attention" as const,
    title: `Possible duplicate — ${row.student_name}${row.student_grade ? ` (Gr ${row.student_grade})` : ""} matches “${row.other_name}”`,
    context: row.detected_reason
      ? `${row.detected_reason} — duplicates are never merged automatically`
      : "Duplicates are never merged automatically",
    href: null,
    dueAt: null,
    actions: [{ kind: "review-duplicate", label: "Review", reviewId: row.id }],
  }));
}

/**
 * A child who has missed the last two sessions of a class. Two in a row is
 * where a founder's attention actually changes the outcome.
 */
async function absenceStreakExceptions(): Promise<QueueItem[]> {
  const rows = (await getDb()
    .prepare(
      `WITH recent AS (
         SELECT ar.student_id, cs.class_id, ar.status,
                ROW_NUMBER() OVER (PARTITION BY ar.student_id, cs.class_id
                                   ORDER BY cs.session_date DESC) AS rn
           FROM attendance_records ar
           JOIN class_sessions cs ON cs.id = ar.session_id
          WHERE cs.status <> 'cancelled'
       )
       SELECT r1.student_id, r1.class_id, s.name AS student_name, c.title AS class_title,
              CASE WHEN r3.status = 'absent' THEN 3 ELSE 2 END AS streak
         FROM recent r1
         JOIN recent r2 ON r2.student_id = r1.student_id AND r2.class_id = r1.class_id AND r2.rn = 2
         LEFT JOIN recent r3 ON r3.student_id = r1.student_id AND r3.class_id = r1.class_id AND r3.rn = 3
         JOIN students s ON s.id = r1.student_id
         JOIN classes c ON c.id = r1.class_id
        WHERE r1.rn = 1 AND r1.status = 'absent' AND r2.status = 'absent'
          AND c.status IN ('active', 'paused')
        ORDER BY s.name`,
    )
    .all()) as any[];

  return rows.map((row) => ({
    key: `absence:${row.student_id}:${row.class_id}`,
    kind: "absence_streak" as const,
    tone: "attention" as const,
    title: `Check in about ${row.student_name}`,
    context: `${row.streak} straight absences · ${row.class_title}`,
    href: `/app/classes/${row.class_id}`,
    dueAt: null,
    actions: [link("View roster", `/app/classes/${row.class_id}`)],
  }));
}

/** An instructor flagged something during a session and it has not been read. */
async function flaggedSessionExceptions(): Promise<QueueItem[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT rep.id, rep.session_id, rep.flag_reason, rep.reported_at,
              cs.class_id, c.title AS class_title
         FROM class_session_reports rep
         JOIN class_sessions cs ON cs.id = rep.session_id
         JOIN classes c ON c.id = cs.class_id
        WHERE rep.flagged = 1
          AND c.status IN ('active', 'paused')
        ORDER BY rep.reported_at DESC
        LIMIT 10`,
    )
    .all()) as any[];

  return rows.map((row) => ({
    key: `flag:${row.id}`,
    kind: "session_flag" as const,
    tone: "attention" as const,
    title: `Flagged after a session — ${row.class_title}`,
    context: (row.flag_reason ?? "An instructor flagged this session.").slice(0, 140),
    href: `/app/session/${row.session_id}`,
    dueAt: Number(row.reported_at),
    actions: [link("Open session", `/app/session/${row.session_id}`)],
  }));
}

/**
 * Everything that needs a person, in one list. Ordering is by consequence
 * timing — anything with a clock on it first, then the rest.
 */
export async function getNeedsYou(now = Date.now()): Promise<QueueItem[]> {
  const [followUps, offers, duplicates, absences, flags] = await Promise.all([
    followUpExceptions(now),
    waitlistOfferExceptions(now),
    duplicateExceptions(),
    absenceStreakExceptions(),
    flaggedSessionExceptions(),
  ]);
  const items = [...followUps, ...offers, ...duplicates, ...absences, ...flags];
  return items.sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return 0;
  });
}

/* ===================================================================== */
/* New                                                                   */
/* ===================================================================== */

/** Registrations and inquiries since the operator last looked. Signal, not a log. */
export async function getRecentActivity(now = Date.now(), limit = 6): Promise<TickerItem[]> {
  const db = getDb();
  const since = now - 14 * DAY_MS;

  const registrations = (await db
    .prepare(
      `SELECT r.id, r.created_at, r.status, s.name AS student_name,
              p.name AS program_name, p.id AS program_id,
              (SELECT c.id FROM classes c WHERE c.program_id = p.id
                 AND c.status NOT IN ('completed','cancelled')
                ORDER BY c.created_at, c.id LIMIT 1) AS class_id
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         JOIN programs p ON p.id = r.program_id
        WHERE r.created_at >= ?
        ORDER BY r.created_at DESC
        LIMIT ?`,
    )
    .all(since, limit)) as any[];

  const inquiries = (await db
    .prepare(
      `SELECT i.id, i.org_name, i.name, i.submitted_at, i.created_at, i.organization_id, i.status
         FROM inquiries i
        WHERE i.status IN ('new', 'reviewing')
          AND COALESCE(i.submitted_at, i.created_at) >= ?
        ORDER BY COALESCE(i.submitted_at, i.created_at) DESC
        LIMIT ?`,
    )
    .all(since, limit)) as any[];

  const items: TickerItem[] = [
    ...registrations.map((row) => ({
      key: `registration:${row.id}`,
      kind: (row.status === "waitlisted" ? "waitlisted" : "registration") as TickerItem["kind"],
      title:
        row.status === "waitlisted"
          ? `${row.student_name} joined the waitlist`
          : `${row.student_name} registered`,
      context: row.program_name,
      at: Number(row.created_at),
      href: row.class_id ? `/app/classes/${row.class_id}` : `/app/programs/${row.program_id}`,
      inquiryId: null,
    })),
    ...inquiries.map((row) => ({
      key: `inquiry:${row.id}`,
      kind: "inquiry" as const,
      title: `Inquiry — ${row.org_name || row.name || "New enquiry"}`,
      context: "Partner inquiry form",
      at: Number(row.submitted_at ?? row.created_at ?? 0),
      href: row.organization_id ? `/app/partners/${row.organization_id}` : "/app/partners",
      inquiryId: row.id as string,
    })),
  ];

  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

/* ===================================================================== */
/* Week digest                                                           */
/* ===================================================================== */

/**
 * One quiet strip, not a KPI wall. Four facts a founder would otherwise ask
 * for out loud, and nothing that invites staring at it.
 */
export async function getWeekDigest(now = Date.now()): Promise<WeekDigest> {
  const db = getDb();
  const today = canonicalDateInZone(now, DEFAULT_TIME_ZONE);
  const weekEnd = addCanonicalDays(today, 7);

  const classes = (await db
    .prepare(`SELECT COUNT(*) AS n FROM classes WHERE status IN ('active','paused')`)
    .get()) as any;

  const seats = (await db
    .prepare(
      `SELECT COALESCE(SUM(c.capacity), 0) AS capacity,
              (SELECT COUNT(*) FROM class_enrollments ce
                JOIN classes c2 ON c2.id = ce.class_id
               WHERE ce.status = 'enrolled' AND c2.status IN ('active','paused')) AS taken
         FROM classes c
        WHERE c.status IN ('active','paused') AND c.capacity IS NOT NULL`,
    )
    .get()) as any;

  const sessions = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM class_sessions
        WHERE status = 'scheduled' AND session_on >= ? AND session_on < ?`,
    )
    .get(today, weekEnd)) as any;

  const inbox = (await db
    .prepare(`SELECT COUNT(*) AS n FROM inquiries WHERE status IN ('new','reviewing')`)
    .get()) as any;

  return {
    classesRunning: Number(classes?.n ?? 0),
    seatsTaken: Number(seats?.taken ?? 0),
    seatsCapacity: Number(seats?.capacity ?? 0),
    sessionsThisWeek: Number(sessions?.n ?? 0),
    inboxWaiting: Number(inbox?.n ?? 0),
  };
}

/* ===================================================================== */

/**
 * Everything Home renders, in one round of parallel reads.
 *
 * Returns the timestamp it used so the page can render relative times without
 * calling Date.now() during render, which React treats as impure.
 */
export async function getHqHomeData(now = Date.now()): Promise<HqHomeData> {
  const [today, nextSession, queue, ticker, digest] = await Promise.all([
    getTodaySessions(now),
    getNextSessionAfterToday(now),
    getNeedsYou(now),
    getRecentActivity(now),
    getWeekDigest(now),
  ]);

  return { now, today, nextSession, queue, ticker, digest };
}
