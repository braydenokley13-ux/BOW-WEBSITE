import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import CurriculumForm from "@/components/app/curriculum/CurriculumForm";

export default async function NewCurriculumPage() {
  const me = await getCurrentUser();
  if (me?.role !== "admin") redirect("/app/curriculum");

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Curriculum · New</span>
          <h1 className="ops-title">New Curriculum</h1>
          <p className="ops-summary">Publish a curriculum so classes have something to build on.</p>
        </div>
      </header>
      <CurriculumForm mode="create" />
    </main>
  );
}
