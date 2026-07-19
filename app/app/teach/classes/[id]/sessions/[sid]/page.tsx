import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, SectionHeader } from "@/components/ds";
import { requireActiveInstructorSelf } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { getLessonById, type Lesson } from "@/lib/lessons";
import { parseLessonSnapshot, resolveAttendanceStatus } from "@/lib/session-evidence";
import { formatDateTimeInZone } from "@/lib/timezone";
import LessonGuide from "@/components/app/LessonGuide";
import SessionAttendanceForm from "@/components/app/teach/SessionAttendanceForm";

interface ClassSessionRow {
  session_date: number;
  timezone: string | null;
  location: string | null;
}

interface ClassContextRow {
  title: string;
  schedule_timezone: string | null;
  curriculum_title: string | null;
}

interface LegacyCohortContextRow {
  name: string;
  track: string;
  current_lesson_id: string | null;
}

interface SessionReportRow {
  notes: string | null;
  flagged: number;
  flag_reason: string | null;
  completed: number;
  reported_at: number;
  lesson_id: string | null;
  lesson_snapshot: string | null;
}

export default async function TeachSessionDetailPage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const { instructor } = await requireActiveInstructorSelf();

  const db = getDb();
  const session = (await db.prepare(
      "SELECT session_date, timezone, location FROM class_sessions WHERE id = ? AND class_id = ?",
    ).get(sid, id)) as ClassSessionRow | undefined;
  if (!session) notFound();

  const isMember = (await db.prepare(
      "SELECT 1 FROM class_instructors WHERE class_id = ? AND instructor_id = ? AND removed_at IS NULL",
    ).get(id, instructor.id));
  if (!isMember) redirect("/app/teach/classes");
  const cls = (await db.prepare(
      `SELECT c.title, c.schedule_timezone, curriculum.title AS curriculum_title
       FROM classes c
       LEFT JOIN curricula curriculum ON curriculum.id = c.curriculum_id
      WHERE c.id = ?`,
    ).get(id)) as
    | ClassContextRow
    | undefined;
  if (!cls) notFound();

  // Cohorts and Classes share an id only for the explicit legacy projection.
  // Require the Program provenance as well so an unrelated Class can never
  // inherit curriculum context merely because its identifier happens to match.
  const legacyCohort = (await db.prepare(
      `SELECT cohort.name, cohort.track, cohort.current_lesson_id
       FROM cohorts cohort
       JOIN classes c ON c.id = cohort.id
       JOIN programs p ON p.id = c.program_id
      WHERE cohort.id = ?
        AND p.source_type = 'legacy_class'
        AND p.source_id = cohort.id
        AND cohort.org_id IS c.partner_org_id
        AND p.partner_org_id IS c.partner_org_id`,
    ).get(id)) as LegacyCohortContextRow | undefined;
  const lessonCandidate = legacyCohort?.current_lesson_id
    ? getLessonById(legacyCohort.current_lesson_id)
    : undefined;

  const roster = (await db
      .prepare(
        `SELECT csr.student_id, s.name
       FROM class_session_roster csr
       LEFT JOIN students s ON s.id = csr.student_id
       WHERE csr.session_id = ?
       ORDER BY s.name, csr.student_id`,
      )
      .all(sid)) as { student_id: string; name: string | null }[];
  const attendanceRows = (await db
      .prepare("SELECT student_id, present, status, note, recorded_at FROM attendance_records WHERE session_id = ?")
      .all(sid)) as { student_id: string; present: number; status: string | null; note: string | null; recorded_at: number }[];
  const attendanceMap = new Map(attendanceRows.map((row) => [row.student_id, row]));

  const students = roster.map((student) => ({
    id: student.student_id,
    name: student.name ?? student.student_id,
    status: attendanceMap.has(student.student_id)
      ? resolveAttendanceStatus(attendanceMap.get(student.student_id)?.status, attendanceMap.get(student.student_id)?.present)
      : null,
    note: attendanceMap.get(student.student_id)?.note ?? "",
    recordedAt: attendanceMap.get(student.student_id)?.recorded_at ?? null,
  }));

  const report = (await db.prepare(
      `SELECT notes, flagged, flag_reason, completed, reported_at, lesson_id, lesson_snapshot
       FROM class_session_reports WHERE session_id = ?`,
    ).get(sid)) as SessionReportRow | undefined;
  // The legacy Cohort stores only its mutable current lesson; it does not
  // snapshot a lesson/version on each Class session. That live context is
  // useful before finalization, but must never appear to be historical proof.
  const liveLesson: Lesson | null = report?.completed !== 1
    && lessonCandidate
    && lessonCandidate.track === legacyCohort?.track
    ? lessonCandidate
    : null;
  const storedLesson = report?.completed === 1
    ? parseLessonSnapshot(report.lesson_snapshot, report.lesson_id)
    : null;
  const lesson = storedLesson ?? liveLesson;
  const sessionTimeZone = session.timezone ?? cls.schedule_timezone;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <Link href={`/app/teach/classes/${id}`} style={{ width: "fit-content", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        ← {cls.title}
      </Link>
      <SectionHeader kicker={cls.title} title={formatDateTimeInZone(session.session_date, sessionTimeZone)} level={1} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge status="info">{cls.curriculum_title ?? "Curriculum not named"}</Badge>
        {session.location && <Badge status="neutral">{session.location}</Badge>}
      </div>

      <section aria-labelledby="session-delivery-record" style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
        <h2 id="session-delivery-record" style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Attendance &amp; delivery report
        </h2>
        <p style={{ margin: "0 0 18px", fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
          This is the authoritative record for this scheduled session. Its roster is fixed delivery evidence; finalizing locks attendance and the report.
        </p>
        <SessionAttendanceForm
          key={`${sid}:${report?.reported_at ?? "new"}`}
          sessionId={sid}
          sessionStartsAt={Number(session.session_date)}
          students={students}
          reportNotes={report?.notes ?? ""}
          reportFlagged={report?.flagged === 1}
          reportFlagReason={report?.flag_reason ?? ""}
          reportCompleted={report?.completed === 1}
          reportReportedAt={report?.reported_at ?? null}
        />
      </section>

      <section aria-labelledby="session-curriculum-context" style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          {storedLesson ? "Finalized lesson snapshot" : liveLesson ? "Current Cohort lesson context" : "Curriculum context"}
        </span>
        <h2 id="session-curriculum-context" style={{ margin: "8px 0 4px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", color: "var(--bow-ink)" }}>
          {lesson?.title ?? cls.curriculum_title ?? "Class curriculum"}
        </h2>
        {lesson ? (
          <>
            <p style={{ margin: "0 0 12px", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
              {lesson.trackLabel} · Module {String(lesson.moduleNumber).padStart(2, "0")} · {lesson.moduleTitle} · {lesson.duration}
            </p>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)" }}>
              <strong>Central question:</strong> {lesson.centralQuestion}
            </p>
            {storedLesson ? (
              <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 12, lineHeight: 1.5, color: "var(--bow-slate)" }}>
                Captured when this session was finalized. This immutable snapshot is the curriculum evidence for what was delivered.
              </p>
            ) : (
              <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 12, lineHeight: 1.5, color: "var(--bow-slate)" }}>
                This is the Cohort&rsquo;s current facilitation context. It becomes durable evidence only when the session is finalized.
              </p>
            )}
          </>
        ) : report?.completed === 1 ? (
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            This finalized record intentionally omits mutable Cohort lesson context because no lesson/version snapshot was captured for the session.
          </p>
        ) : (
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)" }}>
            No verified legacy current lesson is linked to this Class. Attendance and reporting remain available from the canonical session record above.
          </p>
        )}
      </section>

      {lesson && <LessonGuide lesson={lesson} />}
    </div>
  );
}
