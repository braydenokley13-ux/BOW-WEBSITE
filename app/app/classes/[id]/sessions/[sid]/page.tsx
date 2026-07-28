import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader } from "@/components/ds";
import { getDb } from "@/lib/db";
import { formatDateTimeInZone } from "@/lib/timezone";
import { parseLessonSnapshot, resolveAttendanceStatus } from "@/lib/session-evidence";
import SessionAttendanceForm from "@/components/app/teach/SessionAttendanceForm";
import LessonGuide from "@/components/app/LessonGuide";
import SessionPlanForm from "@/components/app/classes/SessionPlanForm";
import { getSessionDetail } from "@/lib/delivery";
import { prepStatusLabel } from "@/lib/delivery-shared";

/**
 * Staff-guarded view of a class session (attendance grid + session
 * report). The /app/classes layout already runs requireStaff — staff
 * are also allowed by recordAttendance/submitSessionReport directly,
 * so this reuses the exact same client form as the instructor-facing
 * /app/teach/classes/[id]/sessions/[sid] route.
 */
export default async function StaffSessionDetailPage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;

  const db = getDb();
  const session = (await db.prepare(
      "SELECT session_date, timezone, location FROM class_sessions WHERE id = ? AND class_id = ?",
    ).get(sid, id)) as { session_date: number; timezone: string | null; location: string | null } | undefined;
  if (!session) notFound();

  const cls = (await db.prepare(
      `SELECT c.title, c.schedule_timezone, curriculum.title AS curriculum_title
       FROM classes c
       LEFT JOIN curricula curriculum ON curriculum.id = c.curriculum_id
      WHERE c.id = ?`,
    ).get(id)) as
    | { title: string; schedule_timezone: string | null; curriculum_title: string | null }
    | undefined;

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
    ).get(sid)) as {
    notes: string | null;
    flagged: number;
    flag_reason: string | null;
    completed: number;
    reported_at: number;
    lesson_id: string | null;
    lesson_snapshot: string | null;
  } | undefined;
  const storedLesson = report?.completed === 1
    ? parseLessonSnapshot(report.lesson_snapshot, report.lesson_id)
    : null;
  const sessionTimeZone = session.timezone ?? cls?.schedule_timezone;
  const detail = await getSessionDetail(sid);

  return (
    <main className="ops-page" style={{ maxWidth: 720 }}>
      <PageHeader
        eyebrow={<Link href={`/app/classes/${id}`} style={{ color: "var(--bow-blue)" }}>{cls?.title ?? "Session"}</Link>}
        title={formatDateTimeInZone(session.session_date, sessionTimeZone)}
        context={session.location ?? undefined}
      />
      {report?.flagged === 1 && (
        <div className="ops-status-line" style={{ marginTop: -8 }}>
          <Badge status="negative">Flagged: {report.flag_reason || "See notes"}</Badge>
        </div>
      )}
      {detail && (
        <div className="ops-panel">
          <span className="ops-label">Session plan</span>
          <div className="ops-meta-grid" style={{ marginTop: 8 }}>
            <div className="ops-meta"><span className="ops-label">Title</span><span className="ops-value">{detail.session.title ?? "Untitled"}</span></div>
            <div className="ops-meta"><span className="ops-label">Objective</span><span className="ops-value">{detail.session.objective ?? "Not set"}</span></div>
            <div className="ops-meta"><span className="ops-label">Agenda</span><span className="ops-value" style={{ whiteSpace: "pre-wrap" }}>{detail.session.agenda ?? "Not set"}</span></div>
            <div className="ops-meta"><span className="ops-label">Materials</span><span className="ops-value" style={{ whiteSpace: "pre-wrap" }}>{detail.session.materials ?? "Not set"}</span></div>
            <div className="ops-meta"><span className="ops-label">Meeting link</span><span className="ops-value">{detail.session.meetingLink ?? "Not set"}</span></div>
          </div>

          {detail.preps.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span className="ops-label">Instructor preparation</span>
              <div className="ops-list" style={{ marginTop: 6 }}>
                {detail.preps.map((prep) => (
                  <div className="ops-list-row ops-list-row--compact" key={prep.instructorId}>
                    <div>
                      <span className="ops-record-name">{prep.instructorName ?? "Unnamed"}</span>
                      {prep.blockers && <span className="ops-record-meta">{prep.blockers}</span>}
                    </div>
                    <Badge status={prep.status === "ready" ? "positive" : prep.status === "in_preparation" ? "warning" : "neutral"}>
                      {prepStatusLabel(prep.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <SessionPlanForm
              sessionId={sid}
              status={detail.session.status}
              plan={{
                title: detail.session.title ?? "",
                objective: detail.session.objective ?? "",
                agenda: detail.session.agenda ?? "",
                materials: detail.session.materials ?? "",
                meetingLink: detail.session.meetingLink ?? "",
                location: detail.session.location ?? "",
              }}
            />
          </div>
        </div>
      )}
      <div className="ops-panel">
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
      </div>
      {storedLesson ? (
        <>
          <div className="ops-alert" data-tone="info">
            <span className="ops-alert__title">Finalized curriculum evidence</span>
            <p className="ops-body" style={{ marginTop: 4 }}>
              {storedLesson.title} was snapshotted when this report was finalized; later curriculum edits cannot rewrite this delivery record.
            </p>
          </div>
          <LessonGuide lesson={storedLesson} />
        </>
      ) : report?.completed === 1 ? (
        <div className="ops-alert" data-tone="info">
          <span className="ops-alert__title">Legacy finalized record</span>
          <p className="ops-body" style={{ marginTop: 4 }}>
            This session predates immutable lesson snapshots. Its attendance and report remain authoritative, but no historical lesson version was captured.
          </p>
        </div>
      ) : (
        <p className="ops-body">{cls?.curriculum_title ?? "Class curriculum"} will be snapshotted when a verified legacy lesson is available at finalization.</p>
      )}
    </main>
  );
}
