import { Badge, SectionHeader } from "@/components/ds";
import { listTasks } from "@/lib/hiring";
import TaskRowActions from "@/components/app/tasks/TaskRowActions";

const ENTITY_HREF: Record<string, (id: string) => string> = {
  instructor: (id) => `/app/instructors/${id}`,
  class: (id) => `/app/classes/${id}`,
  student: (id) => `/app/students/${id}`,
  organization: (id) => `/app/partners/${id}`,
};

function entityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  return ENTITY_HREF[entityType]?.(entityId) ?? null;
}

export default function TasksPage() {
  const tasks = listTasks();
  const open = tasks.filter((t) => t.status === "open");
  const handoffs = open.filter((t) => t.handoffToFounder);
  const done = tasks.filter((t) => t.status === "done");

  const renderRows = (rows: typeof tasks) => (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
            {["Title", "Owner", "Due", "Related", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const href = entityHref(t.entityType, t.entityId);
            return (
              <tr key={t.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>
                  {t.title} {t.handoffToFounder && <Badge status="negative">Founder</Badge>}
                </td>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{t.ownerUserId ?? "Unassigned"}</td>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                  {t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "—"}
                </td>
                <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12 }}>
                  {href ? <a href={href} style={{ color: "var(--bow-blue)" }}>{t.entityType}</a> : "—"}
                </td>
                <td style={{ padding: "11px 12px" }}>
                  {t.status === "open" ? <TaskRowActions taskId={t.id} /> : <Badge status="positive">Done</Badge>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 32 }}>
      <SectionHeader kicker="BOW HQ" title="Tasks" />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 640 }}>
        Follow-ups and founder handoffs across the pipeline. {open.length} open, {handoffs.length} awaiting founder.
      </p>

      {handoffs.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase" }}>Founder handoffs</h3>
          {renderRows(handoffs)}
        </section>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase" }}>Open tasks</h3>
        {open.length === 0 ? (
          <div style={{ background: "var(--bow-white)", border: "1px dashed var(--border-rule)", borderRadius: 6, padding: 32, textAlign: "center" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>Nothing open.</p>
          </div>
        ) : (
          renderRows(open)
        )}
      </section>

      {done.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase" }}>Completed</h3>
          {renderRows(done.slice(0, 25))}
        </section>
      )}
    </div>
  );
}
