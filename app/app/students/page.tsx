import { Badge, Button } from "@/components/ds";
import { listStudents } from "@/lib/hiring";

const FORM_BADGE: Record<string, "positive" | "warning" | "negative"> = {
  complete: "positive",
  submitted: "warning",
  missing: "negative",
};

export default async function StudentsPage() {
  const students = (await listStudents());

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">BOW HQ · Students</span>
          <h1 className="ops-title">Student and guardian records.</h1>
          <p className="ops-summary">{students.length} student{students.length === 1 ? "" : "s"} total, across every class.</p>
        </div>
        <div className="ops-actions">
          <Button href="/app/students/new" variant="emphasis">New Student</Button>
        </div>
      </header>

      {students.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No students yet.</h2>
          <p className="ops-empty__body">Students appear here once they are enrolled in a Class.</p>
        </section>
      ) : (
        <section className="ops-list" aria-label="Students">
          {students.map((s) => (
            <article className="ops-list-row" key={s.id}>
              <div>
                <a className="ops-record-name" href={`/app/students/${s.id}`}>{s.name}</a>
                <span className="ops-record-meta">
                  {s.age ? `Age ${s.age}` : "Age unset"} · {s.grade ? `Grade ${s.grade}` : "Grade unset"}
                </span>
              </div>
              <Badge status={FORM_BADGE[s.formStatus] ?? "neutral"}>{s.formStatus}</Badge>
              <Badge status={s.enrollmentStatus === "active" ? "positive" : "locked"}>{s.enrollmentStatus}</Badge>
              <div />
              <Button href={`/app/students/${s.id}`} variant="secondary" size="sm">
                View
              </Button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
