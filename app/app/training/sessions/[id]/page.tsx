import { notFound } from "next/navigation";
import { Badge, SectionHeader } from "@/components/ds";
import { getDb } from "@/lib/db";
import { rowToTrainingSession, rowToInstructor, rowToPerson } from "@/lib/db";
import type { Instructor, Person } from "@/lib/hiring";
import AttendanceGrid from "@/components/app/training/AttendanceGrid";
import FacilitatorNotesForm from "@/components/app/training/FacilitatorNotesForm";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function TrainingSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM training_sessions WHERE id = ?").get(id) as any;
  if (!row) notFound();
  const session = rowToTrainingSession(row);

  const registered = new Set(
    (db.prepare("SELECT instructor_id FROM training_session_registrations WHERE session_id = ?").all(id) as { instructor_id: string }[]).map(
      (r) => r.instructor_id,
    ),
  );
  const attendance = new Map(
    (db.prepare("SELECT instructor_id, attended FROM training_session_attendance WHERE session_id = ?").all(id) as {
      instructor_id: string;
      attended: number;
    }[]).map((r) => [r.instructor_id, r.attended === 1]),
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

  const attendedCount = [...attendance.values()].filter(Boolean).length;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Training" title={session.title} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {session.required && <Badge status="negative">Required</Badge>}
        <Badge status="info">{new Date(session.scheduledAt).toLocaleString()}</Badge>
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
          <p style={valueStyle}>{session.meetingLink || "—"}</p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Facilitator</span>
          <p style={valueStyle}>{session.facilitatorUserId || "—"}</p>
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 14 }}>Attendance</span>
        <AttendanceGrid
          sessionId={id}
          instructors={instructors.map((i) => ({
            id: i.id,
            name: i.person?.name ?? i.id,
            registered: registered.has(i.id),
            attended: attendance.get(i.id) ?? null,
          }))}
        />
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 14 }}>Facilitator notes</span>
        <FacilitatorNotesForm sessionId={id} initialNotes={session.facilitatorNotes ?? ""} />
      </div>
    </div>
  );
}
