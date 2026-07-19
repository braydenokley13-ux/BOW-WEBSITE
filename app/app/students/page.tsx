import { Badge, Button, SectionHeader } from "@/components/ds";
import { listStudents } from "@/lib/hiring";

const FORM_BADGE: Record<string, "positive" | "warning" | "negative"> = {
  complete: "positive",
  submitted: "warning",
  missing: "negative",
};

export default function StudentsPage() {
  const students = listStudents();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="BOW HQ" title="Students" action={{ label: "New Student", href: "/app/students/new" }} level={1} />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 640 }}>
        Student and guardian records across every class. {students.length} total.
      </p>

      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
              {["Name", "Age", "Grade", "Form status", "Enrollment", ""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{s.name}</td>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{s.age ?? "—"}</td>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{s.grade ?? "—"}</td>
                <td style={{ padding: "11px 12px" }}><Badge status={FORM_BADGE[s.formStatus] ?? "neutral"}>{s.formStatus}</Badge></td>
                <td style={{ padding: "11px 12px" }}><Badge status={s.enrollmentStatus === "active" ? "positive" : "locked"}>{s.enrollmentStatus}</Badge></td>
                <td style={{ padding: "11px 12px", textAlign: "right" }}>
                  <Button href={`/app/students/${s.id}`} variant="secondary" size="sm">View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {students.length === 0 && (
        <div style={{ background: "var(--bow-white)", border: "1px dashed var(--border-rule)", borderRadius: 6, padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>No students yet.</p>
        </div>
      )}
    </div>
  );
}
