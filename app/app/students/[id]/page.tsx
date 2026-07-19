import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, SectionHeader } from "@/components/ds";
import { getDb } from "@/lib/db";
import { getStudentDetail, getStudentAttendanceHistory } from "@/lib/hiring";
import StudentDetailActions from "@/components/app/students/StudentDetailActions";

const cardStyle = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 } as const;
const labelStyle = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--bow-slate)" };
const valueStyle = { fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getStudentDetail(id);
  if (!detail) notFound();
  const { student, guardian, enrollments } = detail;

  const db = getDb();
  const classRows = enrollments.map((e) => {
    const cls = db.prepare("SELECT * FROM classes WHERE id = ?").get(e.classId) as any;
    return { enrollment: e, title: cls?.title ?? e.classId, status: cls?.status ?? "—" };
  });

  const attendance = getStudentAttendanceHistory(id);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Students" title={student.name} level={1} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Badge status={student.formStatus === "complete" ? "positive" : student.formStatus === "submitted" ? "warning" : "negative"}>
          Forms: {student.formStatus}
        </Badge>
        <Badge status={student.enrollmentStatus === "active" ? "positive" : "locked"}>{student.enrollmentStatus}</Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <span style={labelStyle}>Age / Grade</span>
          <p style={valueStyle}>{student.age ?? "—"} / {student.grade ?? "—"}</p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Student email</span>
          <p style={valueStyle}>{student.email ?? "—"}</p>
        </div>
        <div style={cardStyle}>
          <span style={labelStyle}>Guardian</span>
          <p style={valueStyle}>{guardian ? `${guardian.name} (${guardian.email})` : "—"}</p>
        </div>
      </div>

      {student.emergencyNotes && (
        <div style={cardStyle}>
          <span style={labelStyle}>Emergency notes</span>
          <p style={{ ...valueStyle, whiteSpace: "pre-wrap" }}>{student.emergencyNotes}</p>
        </div>
      )}

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Classes</span>
        {classRows.length === 0 && <p style={valueStyle}>Not enrolled in any classes.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {classRows.map((row) => (
            <div key={row.enrollment.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Link href={`/app/classes/${row.enrollment.classId}`} style={{ ...valueStyle, color: "var(--bow-blue)" }}>{row.title}</Link>
              <Badge status={row.enrollment.status === "enrolled" ? "positive" : "neutral"}>{row.enrollment.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <span style={{ ...labelStyle, display: "block", marginBottom: 12 }}>Attendance history</span>
        {attendance.length === 0 && <p style={valueStyle}>No attendance recorded yet.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {attendance.map((a: any) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={valueStyle}>
                {new Date(a.session_date).toLocaleDateString()} — {a.class_title}
              </span>
              <Badge status={a.present ? "positive" : "negative"}>{a.present ? "Present" : "Absent"}</Badge>
            </div>
          ))}
        </div>
      </div>

      <StudentDetailActions
        key={student.updatedAt}
        studentId={id}
        formStatus={student.formStatus}
        communicationNotes={student.communicationNotes ?? ""}
        enrollmentStatus={student.enrollmentStatus}
        expectedUpdatedAt={student.updatedAt}
      />
    </div>
  );
}
