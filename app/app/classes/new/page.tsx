import { SectionHeader } from "@/components/ds";
import { listCurricula, listOrganizations } from "@/lib/hiring";
import NewClassForm from "@/components/app/classes/NewClassForm";

export default function NewClassPage() {
  const curricula = listCurricula();
  const organizations = listOrganizations();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Classes" title="New Class" />
      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
        <NewClassForm
          curricula={curricula.map((c) => ({ id: c.id, title: c.title }))}
          organizations={organizations.map((o) => ({ id: o.id, name: o.name }))}
        />
      </div>
    </div>
  );
}
