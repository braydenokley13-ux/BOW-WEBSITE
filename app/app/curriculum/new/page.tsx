import { redirect } from "next/navigation";
import { SectionHeader } from "@/components/ds";
import { getCurrentUser } from "@/lib/dal";
import CurriculumForm from "@/components/app/curriculum/CurriculumForm";

export default async function NewCurriculumPage() {
  const me = await getCurrentUser();
  if (me?.role !== "admin") redirect("/app/curriculum");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="Curriculum" title="New Curriculum" />
      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
        <CurriculumForm mode="create" />
      </div>
    </div>
  );
}
