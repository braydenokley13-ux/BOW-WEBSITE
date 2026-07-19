import { listCurricula, listOrganizations } from "@/lib/hiring";
import NewClassForm from "@/components/app/classes/NewClassForm";

export default async function NewClassPage() {
  const curricula = (await listCurricula());
  const organizations = (await listOrganizations());

  return (
    <main className="ops-page" style={{ maxWidth: 720 }}>
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Programs</span>
          <h1 className="ops-title">New Delivery</h1>
        </div>
      </header>
      <div className="ops-alert" data-tone="info">
        <span className="ops-alert__title">Every delivery belongs to a Program</span>
        <p className="ops-body" style={{ marginTop: 4 }}>This creates the operating Program and its first Class together, so demand, staffing, readiness, delivery, and renewal remain one continuous record.</p>
      </div>
      <div className="ops-panel">
        <NewClassForm
          curricula={curricula.map((c) => ({ id: c.id, title: c.title }))}
          organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
        />
      </div>
    </main>
  );
}
