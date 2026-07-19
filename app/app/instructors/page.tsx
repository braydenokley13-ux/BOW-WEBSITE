import Link from "next/link";
import { Badge, Button, SectionHeader } from "@/components/ds";
import { listInstructors, type InstructorStage } from "@/lib/hiring";
import { getDb } from "@/lib/db";

const STAGE_ORDER: InstructorStage[] = [
  "applied",
  "reviewing",
  "interview_scheduled",
  "interviewed",
  "founder_review",
  "onboarding",
  "training",
  "practice_evaluation",
  "eligible",
  "active",
  "inactive",
  "rejected",
];

const STAGE_LABEL: Record<InstructorStage, string> = {
  applied: "Applied",
  reviewing: "Reviewing",
  interview_scheduled: "Interview Scheduled",
  interviewed: "Interviewed",
  founder_review: "Founder Review",
  accepted: "Accepted",
  onboarding: "Onboarding",
  training: "Training",
  practice_evaluation: "Practice Evaluation",
  eligible: "Eligible",
  active: "Active",
  rejected: "Rejected",
  inactive: "Inactive",
};

const STAGE_BADGE: Record<InstructorStage, "positive" | "warning" | "negative" | "info" | "neutral" | "locked"> = {
  applied: "info",
  reviewing: "info",
  interview_scheduled: "info",
  interviewed: "info",
  founder_review: "warning",
  accepted: "positive",
  onboarding: "warning",
  training: "warning",
  practice_evaluation: "warning",
  eligible: "positive",
  active: "positive",
  rejected: "negative",
  inactive: "locked",
};

function daysInStage(updatedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - updatedAt) / 86400000));
}

export default function InstructorsPage() {
  const instructors = listInstructors();
  const ownerNames = new Map(
    (getDb().prepare("SELECT id, name FROM users").all() as { id: string; name: string }[])
      .map((owner) => [owner.id, owner.name] as const),
  );
  const byStage = new Map<InstructorStage, typeof instructors>();
  for (const stage of STAGE_ORDER) byStage.set(stage, []);
  for (const i of instructors) {
    if (!byStage.has(i.stage)) byStage.set(i.stage, []);
    byStage.get(i.stage)!.push(i);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="BOW HQ" title="Instructors" action={{ label: "New Applicant", href: "/app/instructors/new" }} level={1} />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 640, margin: 0 }}>
        The instructor pipeline, grouped by stage — applied through active. {instructors.length} total.
      </p>

      {STAGE_ORDER.filter((s) => (byStage.get(s) ?? []).length > 0).map((stage) => {
        const rows = byStage.get(stage) ?? [];
        return (
          <section key={stage} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: 16,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  color: "var(--bow-ink)",
                }}
              >
                {STAGE_LABEL[stage]}
              </h3>
              <Badge status={STAGE_BADGE[stage]}>{rows.length}</Badge>
            </div>
            <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
                    {["Name", "Email", "Source", "Owner", "Days in stage", ""].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          fontFamily: "var(--font-data)",
                          fontSize: 10,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--bow-slate)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                      <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>
                        {i.person?.name ?? "—"}
                      </td>
                      <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
                        {i.person?.email ?? "—"}
                      </td>
                      <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                        {i.source ?? "—"}
                      </td>
                      <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                        {i.ownerUserId ? ownerNames.get(i.ownerUserId) ?? "Owner unavailable" : "Unassigned"}
                      </td>
                      <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                        {daysInStage(i.updatedAt)}d
                      </td>
                      <td style={{ padding: "11px 12px", textAlign: "right" }}>
                        <Button href={`/app/instructors/${i.id}`} variant="secondary" size="sm">
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {instructors.length === 0 && (
        <div style={{ background: "var(--bow-white)", border: "1px dashed var(--border-rule)", borderRadius: 6, padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
            No instructors in the pipeline yet.{" "}
            <Link href="/app/instructors/new" style={{ color: "var(--bow-blue)" }}>
              Add one manually
            </Link>{" "}
            or wait for a public application.
          </p>
        </div>
      )}
    </div>
  );
}
