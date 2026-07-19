import { notFound } from "next/navigation";
import ProgramForm from "@/components/app/programs/ProgramForm";
import { requireStaff } from "@/lib/dal";
import { getProgram, getProgramFormOptions } from "@/lib/operations";

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const detail = getProgram(id);
  if (!detail) notFound();
  const options = getProgramFormOptions();

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Programs · Operating plan</span>
          <h1 className="ops-title">Edit {detail.program.name}</h1>
          <p className="ops-summary">Update the source facts. Launch readiness will recalculate from the complete operating record.</p>
        </div>
      </header>
      <ProgramForm options={options} initial={detail.program} />
    </main>
  );
}
