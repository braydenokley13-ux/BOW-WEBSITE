import { Badge, SectionHeader } from "@/components/ds";
import { requireActiveInstructorSelf } from "@/lib/dal";
import { listClassProposalsForInstructor } from "@/lib/hiring";
import ProposalForm from "@/components/app/teach/ProposalForm";
import SubmitProposalButton from "@/components/app/teach/SubmitProposalButton";

const STATUS_BADGE: Record<string, "positive" | "warning" | "negative" | "neutral"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "positive",
  declined: "negative",
};

export default async function TeachProposalsPage() {
  const { instructor } = await requireActiveInstructorSelf();
  const proposals = (await listClassProposalsForInstructor(instructor.id));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="My BOW" title="Class Proposals" level={1} />

      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>
          New proposal
        </span>
        <ProposalForm instructorId={instructor.id} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {proposals.length === 0 && (
          <p style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>No proposals yet.</p>
        )}
        {proposals.map((p) => (
          <div key={p.id} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" }}>{p.title}</span>{" "}
              <Badge status={STATUS_BADGE[p.status]}>{p.status}</Badge>
            </div>
            {p.status === "draft" && <SubmitProposalButton proposalId={p.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
