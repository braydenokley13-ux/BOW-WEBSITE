import { Badge, Button, PageHeader, Tabs } from "@/components/ds";
import { getDb, rowToClass } from "@/lib/db";
import { classStatusFlags, listClassProposals, type Class, type ClassStatus } from "@/lib/hiring";

const STATUS_ORDER: ClassStatus[] = ["planning", "staffing", "ready_to_launch", "active", "paused", "completed", "cancelled"];
const STATUS_LABEL: Record<ClassStatus, string> = {
  planning: "Planning",
  staffing: "Staffing",
  ready_to_launch: "Ready to Launch",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_BADGE: Record<ClassStatus, "positive" | "warning" | "negative" | "info" | "neutral" | "locked"> = {
  planning: "neutral",
  staffing: "warning",
  ready_to_launch: "info",
  active: "positive",
  paused: "warning",
  completed: "locked",
  cancelled: "negative",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ClassesPage() {
  const db = getDb();
  const classes: Class[] = ((await db.prepare("SELECT * FROM classes ORDER BY updated_at DESC").all()) as any[]).map(rowToClass);

  const byStatus = new Map<ClassStatus, Class[]>();
  for (const s of STATUS_ORDER) byStatus.set(s, []);
  for (const c of classes) {
    if (!byStatus.has(c.status)) byStatus.set(c.status, []);
    byStatus.get(c.status)!.push(c);
  }

  const flagsFor = async (cls: Class) => {
    const enrollmentCount = (
      (await db.prepare(
                `SELECT COUNT(*) AS n
           FROM class_enrollments ce
           JOIN students s ON s.id = ce.student_id
          WHERE ce.class_id = ? AND ce.status = 'enrolled' AND s.enrollment_status = 'active'`,
              ).get(cls.id)) as { n: number }
    ).n;
    const hasEligibleLead = !!(
      cls.leadInstructorId &&
      (await db.prepare("SELECT 1 FROM instructors WHERE id = ? AND eligibility_status = 'eligible' AND stage IN ('eligible','active')").get(cls.leadInstructorId))
    );
    return classStatusFlags(cls, hasEligibleLead, enrollmentCount);
  };

  const submittedProposalCount = (await listClassProposals()).filter((p) => p.status === "submitted").length;
  const flagsById = new Map(await Promise.all(classes.map(async (c) => [c.id, await flagsFor(c)] as const)));

  return (
    <main className="ops-page">
      <PageHeader
        eyebrow="Classes · all delivery, by status"
        title="Every class across every Program, triaged by status."
        context={`${classes.length} class${classes.length === 1 ? "" : "es"} total. Most work starts on the owning Program — open a Program's Classes tab for the full operating context.`}
        action={<Button href="/app/classes/new" variant="emphasis">New Class</Button>}
      />

      <Tabs
        items={[
          { label: "Classes", href: "/app/classes" },
          { label: "Proposals", href: "/app/classes/proposals", count: submittedProposalCount },
        ]}
      />

      {classes.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No classes yet.</h2>
          <p className="ops-empty__body">Classes appear here once a Program creates its first delivery.</p>
        </section>
      ) : (
        STATUS_ORDER.filter((s) => (byStatus.get(s) ?? []).length > 0).map((status) => {
          const rows = byStatus.get(status) ?? [];
          return (
            <section key={status} className="ops-anchor">
              <div className="ops-section-head">
                <h2 className="ops-section-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {STATUS_LABEL[status]} <Badge status={STATUS_BADGE[status]}>{rows.length}</Badge>
                </h2>
              </div>
              <div className="ops-list">
                {rows.map((c) => {
                  const flags = flagsById.get(c.id)!;
                  return (
                    <article className="ops-list-row ops-list-row--compact" key={c.id}>
                      <div>
                        <a className="ops-record-name" href={`/app/classes/${c.id}`}>{c.title}</a>
                        <span className="ops-record-meta">
                          {c.location || c.onlineFormat || "Location TBD"} · {c.startDate || "Start TBD"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {flags.needsInstructor && <Badge status="warning">No eligible lead</Badge>}
                        {flags.launchingSoonIncomplete && <Badge status="negative">Launching soon, incomplete</Badge>}
                      </div>
                      <Button href={`/app/classes/${c.id}`} variant="secondary" size="sm">View</Button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}
