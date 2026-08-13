/* ============================================================
 * Publishing a direct class.
 *
 * One transaction creates a Program, its delivery Class, every session, and
 * the public listing. The founder never sees the word "program": the split is
 * an architectural fact, not a decision anyone should make to run a six-week
 * class.
 *
 * Retry safety is the point of the request key. `programs.request_key` carries
 * a partial unique index (migration 026), so a second attempt after a dropped
 * connection either finds the first attempt's Program and returns it, or loses
 * the INSERT race and then finds it. Either way exactly one class exists.
 *
 * Both publication models are written together, deliberately. The CMS pair
 * (publication_status / registration_status) is what renders the public card;
 * the engine pair (is_public / public_status, plus capacity, registration mode
 * and waitlist settings) is what decideSeat reads when a family registers.
 * Writing only one produces a class that can either be seen but not joined, or
 * joined but never found.
 *
 * Server-only. Permission lives in app/actions/post-class.ts; this module
 * takes an already-authorised actor.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { getInstructorByUserId, logActivity } from "@/lib/hiring";
import { slugify } from "@/lib/slug";
import { DEFAULT_TIME_ZONE, isValidTimeZone, localDateTimeToEpoch, canonicalDateInZone } from "@/lib/timezone";
import { buildRun, gradeRangeLabel, gradeRangeValue, isValidCalendarDate, keptDates, runSummary } from "@/lib/class-schedule";
import { discardClassDraft, type ClassDraftPayload } from "@/lib/class-draft";
import { listCourseLessons } from "@/lib/curriculum-courses";

export interface PublishClassInput extends ClassDraftPayload {
  /**
   * Client-generated, stable for the life of one composer session. It is what
   * makes "tap Publish again" safe.
   */
  requestKey: string;
  description?: string | null;
}

export interface PublishClassResult {
  ok: boolean;
  error?: string;
  /** Set when a message belongs beside one field rather than at the top. */
  field?: "title" | "firstDate" | "schedule" | "grades";
  classId?: string;
  /** True when this call resolved to an earlier successful publish. */
  replayed?: boolean;
}

export interface PublishActor {
  id: string;
  name: string;
}

const REQUEST_KEY_PATTERN = /^[A-Za-z0-9._:-]{12,120}$/;

async function transaction<T>(work: () => Promise<T>): Promise<T> {
  const db = getDb();
  await db.exec("BEGIN IMMEDIATE");
  try {
    const result = await work();
    await db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      /* preserve the original error */
    }
    throw error;
  }
}

/** A slug nobody else holds. Public URLs are permanent, so collisions matter. */
async function uniqueSlug(base: string): Promise<string> {
  const db = getDb();
  const root = slugify(base).slice(0, 70) || "class";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const taken = await db.prepare("SELECT 1 FROM programs WHERE public_slug = ? LIMIT 1").get(candidate);
    if (!taken) return candidate;
  }
  return `${root}-${randomUUID().slice(0, 6)}`;
}

/** The class this request key already produced, if it produced one. */
async function classForRequestKey(scopedKey: string): Promise<string | null> {
  const row = (await getDb()
    .prepare(
      `SELECT c.id FROM classes c
         JOIN programs p ON p.id = c.program_id
        WHERE p.request_key = ?
        ORDER BY c.created_at, c.id LIMIT 1`,
    )
    .get(scopedKey)) as { id: string } | undefined;
  return row?.id ?? null;
}

export async function publishClass(actor: PublishActor, input: PublishClassInput): Promise<PublishClassResult> {
  const db = getDb();

  /* ---- Shape and sanity, in the order a person filled the form in ---- */

  const requestKey = (input.requestKey ?? "").trim();
  if (!REQUEST_KEY_PATTERN.test(requestKey)) {
    return { ok: false, error: "This composer session expired. Reload the page and try again." };
  }
  const scopedKey = `post-class:${requestKey}`;

  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Give the class a name families will recognise.", field: "title" };
  if (title.length > 160) return { ok: false, error: "That title is too long.", field: "title" };

  const grades = [...new Set((input.grades ?? []).map(Number).filter((n) => Number.isFinite(n) && n >= 1 && n <= 12))].sort(
    (a, b) => a - b,
  );
  if (grades.length === 0) return { ok: false, error: "Pick at least one grade.", field: "grades" };

  const timeZone = (input.timeZone ?? "").trim() || DEFAULT_TIME_ZONE;
  if (!isValidTimeZone(timeZone)) {
    return { ok: false, error: "That timezone is not one we can schedule in.", field: "schedule" };
  }

  const startTime = (input.startTime ?? "").trim();
  const endTime = (input.endTime ?? "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    return { ok: false, error: "Set a start and end time for the class.", field: "schedule" };
  }
  if (endTime <= startTime) {
    return { ok: false, error: "The class has to end after it starts.", field: "schedule" };
  }

  const firstDate = (input.firstDate ?? "").trim();
  if (!firstDate || !isValidCalendarDate(firstDate)) {
    return { ok: false, error: "Choose the date of the first session.", field: "firstDate" };
  }
  if (firstDate <= canonicalDateInZone(Date.now(), timeZone)) {
    const readable = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
      new Date(`${firstDate}T12:00:00Z`),
    );
    return { ok: false, error: `${readable} already happened — pick a first session after today.`, field: "firstDate" };
  }

  const weeks = Math.trunc(Number(input.weeks ?? 0));
  if (!Number.isFinite(weeks) || weeks < 1 || weeks > 16) {
    return { ok: false, error: "A run is between 1 and 16 sessions.", field: "schedule" };
  }

  const capacity = Math.trunc(Number(input.capacity ?? 0));
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 40) {
    return { ok: false, error: "Seats must be between 1 and 40." };
  }

  const run = buildRun({ firstDate, weeks, skipped: input.skipped ?? [] });
  const dates = keptDates(run);
  if (dates.length !== weeks) {
    return { ok: false, error: "That schedule leaves too many dates skipped. Adjust the run.", field: "schedule" };
  }

  const curriculumId = (input.curriculumId ?? "").trim() || null;
  if (curriculumId) {
    const course = await db.prepare("SELECT 1 FROM curricula WHERE id = ?").get(curriculumId);
    if (!course) return { ok: false, error: "That course is no longer available." };
  }

  /* ---- Replay: this key already produced a class ---- */

  const replayed = await classForRequestKey(scopedKey);
  if (replayed) {
    await discardClassDraft(actor.id);
    return { ok: true, classId: replayed, replayed: true };
  }

  /* ---- Everything the transaction needs, read before it opens ---- */

  const lessons = curriculumId ? await listCourseLessons(curriculumId) : [];
  const instructor = await getInstructorByUserId(actor.id);
  const assignSelf = Boolean(instructor && instructor.stage !== "rejected" && instructor.stage !== "inactive");
  const slug = await uniqueSlug(title);
  const gradeLabel = gradeRangeLabel(grades);
  const gradeValue = gradeRangeValue(grades);
  const meetingLink = (input.meetingLink ?? "").trim() || null;
  const scheduleLabel = runSummary(run, startTime, endTime);
  const description =
    (input.description ?? "").trim() || `${scheduleLabel}. Taught live by BOW Sports Capital.`;

  const sessionEpochs: { date: string; epoch: number }[] = [];
  for (const date of dates) {
    const resolved = localDateTimeToEpoch(`${date}T${startTime}`, timeZone);
    if (!resolved.ok) return { ok: false, error: resolved.error, field: "schedule" };
    sessionEpochs.push({ date, epoch: resolved.epoch });
  }

  const durationMinutes =
    Number(endTime.slice(0, 2)) * 60 +
    Number(endTime.slice(3)) -
    (Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3)));
  // schedule_day is stored 0=Sunday, matching the rest of the schema.
  const scheduleDay = new Date(`${dates[0]}T12:00:00Z`).getUTCDay();

  const programId = `prg-${randomUUID().slice(0, 12)}`;
  const classId = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();

  /* ---- The one transaction ---- */

  try {
    await transaction(async () => {
      await db
        .prepare(
          `INSERT INTO programs
             (id, request_key, name, curriculum_id, audience, delivery_format, stage,
              start_date, end_date, schedule_label, schedule_day, schedule_start_time, schedule_end_time,
              schedule_timezone, capacity, minimum_enrollment, owner_user_id, source_type,
              is_public, public_status, short_description, long_description, grade_range,
              registration_mode, full_capacity_behavior, waitlist_mode, grade_min, grade_max,
              publication_status, registration_status, public_slug, public_title,
              session_count, session_length_minutes, is_online, is_free,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'online', 'active',
                   ?, ?, ?, ?, ?, ?,
                   ?, ?, 1, ?, 'direct',
                   true, 'open', ?, ?, ?,
                   'immediate', 'waitlist', 'automatic', ?, ?,
                   'published', 'registration_open', ?, ?,
                   ?, ?, true, true,
                   ?, ?)`,
        )
        .run(
          programId,
          scopedKey,
          title,
          curriculumId,
          gradeLabel,
          dates[0],
          dates[dates.length - 1],
          scheduleLabel,
          scheduleDay,
          startTime,
          endTime,
          timeZone,
          capacity,
          actor.id,
          description,
          description,
          gradeValue,
          grades[0],
          grades[grades.length - 1],
          slug,
          title,
          dates.length,
          durationMinutes,
          now,
          now,
        );

      await db
        .prepare(
          `INSERT INTO classes
             (id, title, curriculum_id, location, online_format, start_date, end_date,
              recurrence, schedule_day, schedule_start_time, schedule_end_time, schedule_timezone,
              age_range, capacity, minimum_enrollment, lead_instructor_id, program_id, status,
              created_at, updated_at)
           VALUES (?, ?, ?, NULL, 'Online', ?, ?,
                   ?, ?, ?, ?, ?,
                   ?, ?, 1, ?, ?, 'active',
                   ?, ?)`,
        )
        .run(
          classId,
          title,
          curriculumId,
          dates[0],
          dates[dates.length - 1],
          scheduleLabel,
          scheduleDay,
          startTime,
          endTime,
          timeZone,
          gradeLabel,
          capacity,
          assignSelf && instructor ? instructor.id : null,
          programId,
          now,
          now,
        );

      if (assignSelf && instructor) {
        // The operator posting a direct class is teaching it — the default the
        // composer states out loud. Written inline rather than through
        // assignInstructorToClass so the whole publish stays one transaction,
        // and because a founder self-assigning does not need the staffing
        // recommendation machinery.
        await db
          .prepare(
            `INSERT INTO class_instructors
               (id, class_id, instructor_id, role, decision_reason, assigned_by, assignment_status, added_at)
             VALUES (?, ?, ?, 'lead', 'Posted this class and is teaching it.', ?, 'accepted', ?)`,
          )
          .run(`cin-${randomUUID().slice(0, 10)}`, classId, instructor.id, actor.id, now);
      }

      for (let index = 0; index < sessionEpochs.length; index += 1) {
        const { date, epoch } = sessionEpochs[index];
        const lesson = lessons[index] ?? null;
        await db
          .prepare(
            `INSERT INTO class_sessions
               (id, class_id, session_date, session_on, timezone, location, meeting_link,
                title, lesson_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 'scheduled', ?, ?)`,
          )
          .run(
            `pfx-${randomUUID().slice(0, 8)}`,
            classId,
            epoch,
            date,
            timeZone,
            meetingLink,
            lesson ? lesson.title : `Session ${index + 1}`,
            lesson ? lesson.id : null,
            now,
            now,
          );
      }

      await logActivity("program", programId, "created", `Class "${title}" published from the composer.`, actor.id);
      await logActivity("class", classId, "note", `${dates.length} sessions scheduled, ${capacity} seats.`, actor.id);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Losing the unique-index race means a concurrent retry already published.
    // From the operator's point of view that is success: one class exists.
    if (/uq_programs_request_key/i.test(message) || /duplicate key/i.test(message)) {
      const winner = await classForRequestKey(scopedKey);
      if (winner) {
        await discardClassDraft(actor.id);
        return { ok: true, classId: winner, replayed: true };
      }
    }
    if (/public_slug/i.test(message)) {
      return { ok: false, error: "That web address was just taken. Try publishing again." };
    }
    throw error;
  }

  await discardClassDraft(actor.id);
  return { ok: true, classId };
}
