import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { PageHeader, PageSection } from "@/components/ds";
import {
  createRequirement,
  deactivateRequirement,
  reorderRequirement,
  updateRequirement,
} from "@/app/actions/program-setup";
import { REQUIREMENT_KINDS, REQUIREMENT_KIND_LABELS } from "@/lib/enrollment-shared";
import type { ProgramRequirementRow } from "@/lib/enrollment";

export default async function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const db = getDb();
  const program = (await db.prepare("SELECT id, name, start_date FROM programs WHERE id = ?").get(id)) as
    | { id: string; name: string; start_date: string | null }
    | undefined;
  if (!program) notFound();

  const requirements = (await db
    .prepare("SELECT * FROM program_requirements WHERE program_id = ? AND active = true ORDER BY sort_order")
    .all(id)) as unknown as ProgramRequirementRow[];
  const inactive = (await db
    .prepare("SELECT * FROM program_requirements WHERE program_id = ? AND active = false ORDER BY updated_at DESC")
    .all(id)) as unknown as ProgramRequirementRow[];

  return (
    <div>
      <PageHeader
        eyebrow="Programs · Requirements"
        title={program.name}
        context="What families must complete before a seat confirms. Never exposed to families as database fields — only the prompt and help text below are ever shown."
        action={
          <Link href={`/app/programs/${id}/enrollment`} className="bow-button bow-button-secondary bow-button-sm">
            Back to enrollment
          </Link>
        }
      />

      <PageSection title="Active requirements" noRule>
        {requirements.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>No requirements yet — families will only be asked to submit the registration itself.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {requirements.map((r, i) => (
              <form
                key={r.id}
                action={async (formData: FormData) => {
                  "use server";
                  await updateRequirement(r.id, formData);
                }}
                style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: 14 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{REQUIREMENT_KIND_LABELS[r.kind as keyof typeof REQUIREMENT_KIND_LABELS] ?? r.kind}</strong>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      formAction={async () => {
                        "use server";
                        await reorderRequirement(r.id, "up");
                      }}
                      className="bow-button bow-button-ghost bow-button-sm"
                      disabled={i === 0}
                    >
                      Move up
                    </button>
                    <button
                      formAction={async () => {
                        "use server";
                        await reorderRequirement(r.id, "down");
                      }}
                      className="bow-button bow-button-ghost bow-button-sm"
                      disabled={i === requirements.length - 1}
                    >
                      Move down
                    </button>
                    <button
                      formAction={async () => {
                        "use server";
                        await deactivateRequirement(r.id);
                      }}
                      className="bow-button bow-button-ghost bow-button-sm"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
                <label style={{ display: "block", marginTop: 10, fontSize: 12, color: "var(--bow-slate)" }}>
                  Family-facing question
                  <textarea name="prompt" defaultValue={r.prompt} rows={2} style={inputStyle} />
                </label>
                <label style={{ display: "block", marginTop: 8, fontSize: 12, color: "var(--bow-slate)" }}>
                  Why it&apos;s needed (help text shown to the family)
                  <textarea name="helpText" defaultValue={r.help_text ?? ""} rows={2} style={inputStyle} />
                </label>
                {r.kind === "choice" && (
                  <label style={{ display: "block", marginTop: 8, fontSize: 12, color: "var(--bow-slate)" }}>
                    Choices (comma separated)
                    <input name="choices" defaultValue={r.choices ?? ""} style={inputStyle} />
                  </label>
                )}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                  <label style={checkboxLabel}>
                    <input type="checkbox" name="required" defaultChecked={r.required} /> Required
                  </label>
                  <label style={checkboxLabel}>
                    <input type="checkbox" name="blocksConfirmation" defaultChecked={r.blocks_confirmation} /> Blocks seat confirmation
                  </label>
                  <label style={checkboxLabel}>
                    <input type="checkbox" name="staffApprovalRequired" defaultChecked={r.staff_approval_required} /> Staff must approve the answer
                  </label>
                  <label style={{ fontSize: 12, color: "var(--bow-slate)" }}>
                    Who can see the answer
                    <select name="visibility" defaultValue={r.visibility} style={{ ...inputStyle, width: "auto", marginTop: 2 }}>
                      <option value="admin">Admin only</option>
                      <option value="admin_instructor">Admin + instructor (full)</option>
                      <option value="instructor_summary">Instructor (summary only)</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12, color: "var(--bow-slate)" }}>
                    Due (days before program start)
                    <input type="number" name="dueDaysBeforeStart" defaultValue={r.due_days_before_start ?? ""} style={{ ...inputStyle, width: 80, marginTop: 2 }} />
                  </label>
                  <button type="submit" className="bow-button bow-button-primary bow-button-sm">
                    Save
                  </button>
                </div>
              </form>
            ))}
          </div>
        )}
      </PageSection>

      <PageSection title="Add a requirement">
        <form
          action={async (formData: FormData) => {
            "use server";
            await createRequirement(id, formData);
          }}
          style={{ display: "grid", gap: 8, maxWidth: 640 }}
        >
          <label style={fieldLabel}>
            Type
            <select name="kind" required style={inputStyle}>
              {REQUIREMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {REQUIREMENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldLabel}>
            Family-facing question
            <textarea name="prompt" required rows={2} style={inputStyle} placeholder="e.g. Does your child have any allergies we should know about?" />
          </label>
          <label style={fieldLabel}>
            Why it&apos;s needed
            <textarea name="helpText" rows={2} style={inputStyle} placeholder="Shown to families so the question doesn't feel arbitrary." />
          </label>
          <label style={fieldLabel}>
            Choices (only used for multiple choice; comma separated)
            <input name="choices" style={inputStyle} />
          </label>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={checkboxLabel}>
              <input type="checkbox" name="required" defaultChecked /> Required
            </label>
            <label style={checkboxLabel}>
              <input type="checkbox" name="blocksConfirmation" /> Blocks seat confirmation
            </label>
            <label style={checkboxLabel}>
              <input type="checkbox" name="staffApprovalRequired" /> Staff must approve the answer
            </label>
          </div>
          <label style={fieldLabel}>
            Who can see the answer
            <select name="visibility" defaultValue="admin" style={inputStyle}>
              <option value="admin">Admin only</option>
              <option value="admin_instructor">Admin + instructor (full)</option>
              <option value="instructor_summary">Instructor (summary only)</option>
            </select>
          </label>
          <label style={fieldLabel}>
            Due (days before program start)
            <input type="number" name="dueDaysBeforeStart" style={inputStyle} />
          </label>
          <input type="hidden" name="scope" value="student" />
          <div>
            <button type="submit" className="bow-button bow-button-primary bow-button-sm">
              Add requirement
            </button>
          </div>
        </form>
      </PageSection>

      {inactive.length > 0 && (
        <PageSection title="Deactivated">
          <div style={{ display: "grid", gap: 6 }}>
            {inactive.map((r) => (
              <div key={r.id} style={{ fontSize: 13, color: "var(--bow-slate)" }}>
                {REQUIREMENT_KIND_LABELS[r.kind as keyof typeof REQUIREMENT_KIND_LABELS] ?? r.kind} — {r.prompt}
              </div>
            ))}
          </div>
        </PageSection>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: 8,
  border: "1px solid var(--border-rule)",
  borderRadius: 6,
  fontFamily: "inherit",
  fontSize: 14,
};

const fieldLabel: React.CSSProperties = { fontSize: 12, color: "var(--bow-slate)" };
const checkboxLabel: React.CSSProperties = { fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
