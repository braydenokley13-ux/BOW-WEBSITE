import { notFound } from "next/navigation";
import { SectionHeader, Badge } from "@/components/ds";
import { getDb } from "@/lib/db";
import SessionAttendanceForm from "@/components/app/teach/SessionAttendanceForm";

/**
 * Staff-guarded view of a class session (attendance grid + session
 * report). The /app/classes layout already runs requireStaff — staff
 * are also allowed by recordAttendance/submitSessionReport directly,
 * so this reuses the exact same client form as the instructor-facing
 * /app/teach/classes/[id]/sessions/[sid] route.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function StaffSessionDetailPage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;

  const db = getDb();
  const session = db.prepare("SELECT * FROM class_sessions WHERE id = ? AND class_id = ?").get(sid, id) as any;
  if (!session) notFound();

  const cls = db.prepare("SELECT title FROM classes WHERE id = ?").get(id) as { title: string } | undefined;

  const enrolled = db
    .prepare("SELECT student_id FROM class_enrollments WHERE class_id = ? AND status = 'enrolled'")
    .all(id) as { student_id: string }[];
  const attendanceRows = db
    .prepare("SELECT student_id, present FROM attendance_records WHERE session_id = ?")
    .all(sid) as { student_id: string; present: number }[];
  const attendanceMap = new Map(attendanceRows.map((r) => [r.student_id, r.present === 1]));

  const students = enrolled.map((e) => {
    const s = db.prepare("SELECT * FROM students WHERE id = ?").get(e.student_id) as any;
    return { id: e.student_id, name: s?.name ?? e.student_id, present: attendanceMap.has(e.student_id) ? attendanceMap.get(e.student_id)! : null };
  });

  const report = db.prepare("SELECT * FROM class_session_reports WHERE session_id = ?").get(sid) as any;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker={cls?.title ?? "Session"} title={new Date(session.session_date).toLocaleString()} />
      {session.location && (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>{session.location}</p>
      )}
      {report?.flagged === 1 && <Badge status="negative">Flagged: {report.flag_reason || "See notes"}</Badge>}
      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
        <SessionAttendanceForm sessionId={sid} students={students} reportNotes={report?.notes ?? ""} />
      </div>
    </div>
  );
}
