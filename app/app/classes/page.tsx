import { Badge, Button, SectionHeader, Tabs } from "@/components/ds";
import { getDb, rowToClass } from "@/lib/db";
import { classStatusFlags, listClassProposals, type Class, type ClassStatus } from "@/lib/hiring";

const STATUS_ORDER: ClassStatus[] = ["planning", "staffing", "ready_to_launch", "active", "completed", "cancelled"];
const STATUS_LABEL: Record<ClassStatus, string> = {
  planning: "Planning",
  staffing: "Staffing",
  ready_to_launch: "Ready to Launch",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_BADGE: Record<ClassStatus, "positive" | "warning" | "negative" | "info" | "neutral" | "locked"> = {
  planning: "neutral",
  staffing: "warning",
  ready_to_launch: "info",
  active: "positive",
  completed: "locked",
  cancelled: "negative",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ClassesPage() {
  const db = getDb();
  const classes: Class[] = (db.prepare("SELECT * FROM classes ORDER BY updated_at DESC").all() as any[]).map(rowToClass);

  const byStatus = new Map<ClassStatus, Class[]>();
  for (const s of STATUS_ORDER) byStatus.set(s, []);
  for (const c of classes) {
    if (!byStatus.has(c.status)) byStatus.set(c.status, []);
    byStatus.get(c.status)!.push(c);
  }

  const flagsFor = (cls: Class) => {
    const enrollmentCount = (
      db.prepare("SELECT COUNT(*) AS n FROM class_enrollments WHERE class_id = ? AND status = 'enrolled'").get(cls.id) as { n: number }
    ).n;
    const hasEligibleLead = !!(
      cls.leadInstructorId &&
      db.prepare("SELECT 1 FROM instructors WHERE id = ? AND eligibility_status = 'eligible'").get(cls.leadInstructorId)
    );
    return classStatusFlags(cls, hasEligibleLead, enrollmentCount);
  };

  const submittedProposalCount = listClassProposals().filter((p) => p.status === "submitted").length;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="BOW HQ" title="Classes" action={{ label: "New Class", href: "/app/classes/new" }} />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 640 }}>
        Class scheduling, staffing, and rosters. {classes.length} total.
      </p>

      <Tabs
        items={[
          { label: "Classes", href: "/app/classes" },
          { label: "Proposals", href: "/app/classes/proposals", count: submittedProposalCount },
        ]}
      />

      {STATUS_ORDER.filter((s) => (byStatus.get(s) ?? []).length > 0).map((status) => {
        const rows = byStatus.get(status) ?? [];
        return (
          <section key={status} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", letterSpacing: "0.02em", color: "var(--bow-ink)" }}>
                {STATUS_LABEL[status]}
              </h3>
              <Badge status={STATUS_BADGE[status]}>{rows.length}</Badge>
            </div>
            <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
                    {["Title", "Location", "Start", "Flags", ""].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const flags = flagsFor(c);
                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                        <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{c.title}</td>
                        <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{c.location || c.onlineFormat || "—"}</td>
                        <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{c.startDate || "—"}</td>
                        <td style={{ padding: "11px 12px" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {flags.needsInstructor && <Badge status="warning">No eligible lead</Badge>}
                            {flags.launchingSoonIncomplete && <Badge status="negative">Launching soon, incomplete</Badge>}
                          </div>
                        </td>
                        <td style={{ padding: "11px 12px", textAlign: "right" }}>
                          <Button href={`/app/classes/${c.id}`} variant="secondary" size="sm">View</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {classes.length === 0 && (
        <div style={{ background: "var(--bow-white)", border: "1px dashed var(--border-rule)", borderRadius: 6, padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>No classes yet.</p>
        </div>
      )}
    </div>
  );
}
