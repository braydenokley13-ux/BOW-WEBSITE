import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { guardianPersonForUser } from "@/lib/parent-activation";
import { loadRequirementForGuardian } from "@/lib/family-portal";
import RequirementForm from "@/components/family/RequirementForm";

export const metadata: Metadata = { title: "Complete a requirement" };

/**
 * `[id]` is the `registration_requirements.id`, scope-checked through
 * loadRequirementForGuardian() -> guardianCanAccessStudent(). A guessed or
 * copied id from another family renders the same 404 as a nonexistent one —
 * nothing distinguishes "not yours" from "does not exist".
 */
export default async function RequirementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireRole("parent");
  const personId = await guardianPersonForUser(me.id);
  if (!personId) notFound();

  const requirement = await loadRequirementForGuardian(id, personId);
  if (!requirement) notFound();

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ margin: "0 0 4px", fontFamily: "var(--font-data)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bow-slate, #6b6e75)" }}>
        {requirement.studentName} · {requirement.programName}
      </p>
      <h1 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24 }}>{requirement.prompt}</h1>
      {requirement.helpText && (
        <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate, #55585f)", lineHeight: 1.6 }}>
          {requirement.helpText}
        </p>
      )}
      <RequirementForm requirement={requirement} />
    </div>
  );
}
