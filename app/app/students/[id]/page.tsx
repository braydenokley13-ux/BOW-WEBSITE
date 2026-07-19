import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ds";
import { getDb } from "@/lib/db";
import { getStudentDetail, getStudentAttendanceHistory } from "@/lib/hiring";
import StudentDetailActions from "@/components/app/students/StudentDetailActions";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = (await getStudentDetail(id));
  if (!detail) notFound();
  const { student, guardian, enrollments } = detail;

  const db = getDb();
  const classRows = (await Promise.all(enrollments.map(async (e) => {
      const cls = (await db.prepare("SELECT * FROM classes WHERE id = ?").get(e.classId)) as any;
      return { enrollment: e, title: cls?.title ?? e.classId, status: cls?.status ?? "—" };
    })));

  const attendance = (await getStudentAttendanceHistory(id));

  return (
    <main className="ops-page" style={{ maxWidth: 900 }}>
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Students</span>
          <h1 className="ops-title">{student.name}</h1>
          <div className="ops-status-line">
            <Badge status={student.formStatus === "complete" ? "positive" : student.formStatus === "submitted" ? "warning" : "negative"}>
              Forms: {student.formStatus}
            </Badge>
            <Badge status={student.enrollmentStatus === "active" ? "positive" : "locked"}>{student.enrollmentStatus}</Badge>
          </div>
        </div>
      </header>

      <section className="ops-panel">
        <div className="ops-meta-grid">
          <div className="ops-meta">
            <span className="ops-label">Age / Grade</span>
            <span className="ops-value">{student.age ?? "—"} / {student.grade ?? "—"}</span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Student email</span>
            <span className="ops-value">{student.email ?? "—"}</span>
          </div>
          <div className="ops-meta">
            <span className="ops-label">Guardian</span>
            <span className="ops-value">{guardian ? `${guardian.name} (${guardian.email})` : "—"}</span>
          </div>
        </div>
        {student.emergencyNotes && (
          <div className="ops-meta" style={{ borderBottom: 0 }}>
            <span className="ops-label">Emergency notes</span>
            <span className="ops-value" style={{ whiteSpace: "pre-wrap" }}>{student.emergencyNotes}</span>
          </div>
        )}
      </section>

      <section className="ops-panel--flat">
        <div className="ops-section-head">
          <h2 className="ops-section-title">Classes</h2>
        </div>
        {classRows.length === 0 && <p className="ops-body">Not enrolled in any classes.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {classRows.map((row) => (
            <div key={row.enrollment.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Link href={`/app/classes/${row.enrollment.classId}`} className="ops-inline-link">{row.title}</Link>
              <Badge status={row.enrollment.status === "enrolled" ? "positive" : "neutral"}>{row.enrollment.status}</Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="ops-panel--flat">
        <div className="ops-section-head">
          <h2 className="ops-section-title">Attendance history</h2>
        </div>
        {attendance.length === 0 && <p className="ops-body">No attendance recorded yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {attendance.map((a: any) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span className="ops-value">
                {new Date(a.session_date).toLocaleDateString()} — {a.class_title}
              </span>
              <Badge status={a.present ? "positive" : "negative"}>{a.present ? "Present" : "Absent"}</Badge>
            </div>
          ))}
        </div>
      </section>

      <StudentDetailActions
        key={student.updatedAt}
        studentId={id}
        formStatus={student.formStatus}
        communicationNotes={student.communicationNotes ?? ""}
        enrollmentStatus={student.enrollmentStatus}
        expectedUpdatedAt={student.updatedAt}
      />
    </main>
  );
}
