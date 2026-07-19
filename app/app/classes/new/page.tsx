import { SectionHeader } from "@/components/ds";
import { listCurricula, listOrganizations } from "@/lib/hiring";
import NewClassForm from "@/components/app/classes/NewClassForm";

export default async function NewClassPage() {
  const curricula = (await listCurricula());
  const organizations = (await listOrganizations());

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Programs" title="New Delivery" level={1} />
      <div className="ops-alert" data-tone="info">
        <span className="ops-alert__title">Every delivery belongs to a Program</span>
        <p className="ops-body" style={{ marginTop: 4 }}>This creates the operating Program and its first Class together, so demand, staffing, readiness, delivery, and renewal remain one continuous record.</p>
      </div>
      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
        <NewClassForm
          curricula={curricula.map((c) => ({ id: c.id, title: c.title }))}
          organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
        />
      </div>
    </div>
  );
}
