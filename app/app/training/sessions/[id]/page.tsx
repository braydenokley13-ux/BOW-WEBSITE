import { notFound } from "next/navigation";
import { Badge } from "@/components/ds";
import { getDb } from "@/lib/db";
import { rowToTrainingSession, rowToInstructor, rowToPerson } from "@/lib/db";
import type { Instructor, Person } from "@/lib/hiring";
import AttendanceGrid from "@/components/app/training/AttendanceGrid";
import FacilitatorNotesForm from "@/components/app/training/FacilitatorNotesForm";
import { formatDateTimeInZone } from "@/lib/timezone";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function TrainingSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const now = Number(((await db.prepare("SELECT unixepoch('now') * 1000 AS now").get()) as { now: number }).now);
  const row = (await db.prepare("SELECT * FROM training_sessions WHERE id = ?").get(id)) as any;
  if (!row) notFound();
  const session = rowToTrainingSession(row);
  const facilitator = session.facilitatorUserId
    ? (await db.prepare("SELECT name FROM users WHERE id = ?").get(session.facilitatorUserId)) as { name: string } | undefined
    : undefined;

  const registered = new Set(
    ((await db.prepare("SELECT instructor_id FROM training_session_registrations WHERE session_id = ?").all(id)) as { instructor_id: string }[]).map(
      (r) => r.instructor_id,
    ),
  );
  const attendance = new Map(
    ((await db.prepare("SELECT instructor_id, attended, recorded_at FROM training_session_attendance WHERE session_id = ?").all(id)) as {
      instructor_id: string;
      attended: number;
      recorded_at: number;
    }[]).map((r) => [r.instructor_id, { attended: r.attended === 1, recordedAt: r.recorded_at }]),
  );

  // Instructors relevant to this session: registered, plus anyone still in
  // onboarding/training/practice_evaluation who could register.
  const candidateRows = (await db
      .prepare("SELECT * FROM instructors WHERE stage IN ('onboarding','training','practice_evaluation') OR id IN (SELECT instructor_id FROM training_session_registrations WHERE session_id = ?)")
      .all(id)) as any[];
  const instructors: (Instructor & { person: Person | null })[] = (await Promise.all(candidateRows.map(async (r) => {
      const instructor = rowToInstructor(r);
      const personRow = (await db.prepare("SELECT * FROM people WHERE id = ?").get(instructor.personId)) as any;
      return { ...instructor, person: personRow ? rowToPerson(personRow) : null };
    })));

  const attendedCount = [...attendance.values()].filter((evidence) => evidence.attended).length;
  const attendanceEvidenceVersion = Math.max(0, ...[...attendance.values()].map((evidence) => evidence.recordedAt));

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Training · Session</span>
          <h1 className="ops-title">{session.title}</h1>
          <div className="ops-status-line">
            {session.required && <Badge status="warning">Required</Badge>}
            <Badge status="neutral">{formatDateTimeInZone(session.scheduledAt, session.timeZone)}</Badge>
            <Badge status="neutral">{attendedCount}/{registered.size} attended</Badge>
          </div>
        </div>
      </header>

      <section className="ops-panel ops-panel--flat" aria-label="Session details">
        <div className="ops-meta-grid">
          <div className="ops-meta">
            <span className="ops-label">Location</span>
            <span className="ops-value">{session.location || "—"}</span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Meeting link</span>
            <span className="ops-value">
              {session.meetingLink && /^https:\/\//i.test(session.meetingLink)
                ? <a className="ops-inline-link" href={session.meetingLink} target="_blank" rel="noreferrer">Open secure meeting link</a>
                : session.meetingLink || "—"}
            </span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Facilitator</span>
            <span className="ops-value">{facilitator?.name || "Unassigned"}</span>
          </div>
        </div>
      </section>

      <section className="ops-panel ops-panel--flat" aria-labelledby="session-attendance-title">
        <div className="ops-section-head">
          <div><h2 id="session-attendance-title" className="ops-section-title">Attendance</h2></div>
        </div>
        <AttendanceGrid
          key={`${id}:${registered.size}:${attendanceEvidenceVersion}`}
          sessionId={id}
          canRecordAttendance={session.scheduledAt <= now}
          instructors={(await Promise.all(instructors.map(async (i) => ({
                      id: i.id,
                      name: i.person?.name ?? i.id,
                      registered: registered.has(i.id),
                      attended: (await attendance.get(i.id))?.attended ?? null,
                      recordedAt: (await attendance.get(i.id))?.recordedAt ?? null,
                    }))))}
        />
      </section>

      <section className="ops-panel ops-panel--flat" aria-labelledby="session-notes-title">
        <div className="ops-section-head">
          <div><h2 id="session-notes-title" className="ops-section-title">Facilitator notes</h2></div>
        </div>
        <FacilitatorNotesForm
          key={`${id}:${session.updatedAt}`}
          sessionId={id}
          initialNotes={session.facilitatorNotes ?? ""}
          initialUpdatedAt={session.updatedAt}
        />
      </section>
    </main>
  );
}
