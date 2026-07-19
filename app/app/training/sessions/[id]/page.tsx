import { notFound } from "next/navigation";
import { Badge, SectionHeader } from "@/components/ds";
import { getDb } from "@/lib/db";
import { rowToTrainingSession, rowToInstructor, rowToPerson } from "@/lib/db";
import type { Instructor, Person } from "@/lib/hiring";
import AttendanceGrid from "@/components/app/training/AttendanceGrid";
import FacilitatorNotesForm from "@/components/app/training/FacilitatorNotesForm";
import { formatDateTimeInZone } from "@/lib/timezone";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function TrainingSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const now = Number((db.prepare("SELECT unixepoch('now') * 1000 AS now").get() as { now: number }).now);
  const row = db.prepare("SELECT * FROM training_sessions WHERE id = ?").get(id) as any;
  if (!row) notFound();
  const session = rowToTrainingSession(row);
  const facilitator = session.facilitatorUserId
    ? db.prepare("SELECT name FROM users WHERE id = ?").get(session.facilitatorUserId) as { name: string } | undefined
    : undefined;

  const registered = new Set(
    (db.prepare("SELECT instructor_id FROM training_session_registrations WHERE session_id = ?").all(id) as { instructor_id: string }[]).map(
      (r) => r.instructor_id,
    ),
  );
  const attendance = new Map(
    (db.prepare("SELECT instructor_id, attended, recorded_at FROM training_session_attendance WHERE session_id = ?").all(id) as {
      instructor_id: string;
      attended: number;
      recorded_at: number;
    }[]).map((r) => [r.instructor_id, { attended: r.attended === 1, recordedAt: r.recorded_at }]),
  );

  // Instructors relevant to this session: registered, plus anyone still in
  // onboarding/training/practice_evaluation who could register.
  const candidateRows = db
    .prepare("SELECT * FROM instructors WHERE stage IN ('onboarding','training','practice_evaluation') OR id IN (SELECT instructor_id FROM training_session_registrations WHERE session_id = ?)")
    .all(id) as any[];
  const instructors: (Instructor & { person: Person | null })[] = candidateRows.map((r) => {
    const instructor = rowToInstructor(r);
    const personRow = db.prepare("SELECT * FROM people WHERE id = ?").get(instructor.personId) as any;
    return { ...instructor, person: personRow ? rowToPerson(personRow) : null };
  });

  const attendedCount = [...attendance.values()].filter((evidence) => evidence.attended).length;
  const attendanceEvidenceVersion = Math.max(0, ...[...attendance.values()].map((evidence) => evidence.recordedAt));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Training" title={session.title} level={1} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {session.required && <Badge status="negative">Required</Badge>}
        <Badge status="info">{formatDateTimeInZone(session.scheduledAt, session.timeZone)}</Badge>
        <Badge status="neutral">
          {attendedCount}/{registered.size} attended
        </Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <span style={labelStyle}>Location</span>
          <p style={valueStyle}>{session.location || "—"}</p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Meeting link</span>
          <p style={valueStyle}>
            {session.meetingLink && /^https:\/\//i.test(session.meetingLink)
              ? <a href={session.meetingLink} target="_blank" rel="noreferrer" style={{ color: "var(--bow-blue)" }}>Open secure meeting link</a>
              : session.meetingLink || "—"}
          </p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Facilitator</span>
          <p style={valueStyle}>{facilitator?.name || "Unassigned"}</p>
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 14 }}>Attendance</span>
        <AttendanceGrid
          key={`${id}:${registered.size}:${attendanceEvidenceVersion}`}
          sessionId={id}
          canRecordAttendance={session.scheduledAt <= now}
          instructors={instructors.map((i) => ({
            id: i.id,
            name: i.person?.name ?? i.id,
            registered: registered.has(i.id),
            attended: attendance.get(i.id)?.attended ?? null,
            recordedAt: attendance.get(i.id)?.recordedAt ?? null,
          }))}
        />
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 14 }}>Facilitator notes</span>
        <FacilitatorNotesForm
          key={`${id}:${session.updatedAt}`}
          sessionId={id}
          initialNotes={session.facilitatorNotes ?? ""}
          initialUpdatedAt={session.updatedAt}
        />
      </div>
    </div>
  );
}
