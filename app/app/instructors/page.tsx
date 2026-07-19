import Link from "next/link";
import { Badge, Button } from "@/components/ds";
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

export default async function InstructorsPage() {
  const instructors = (await listInstructors());
  const ownerNames = new Map(
    ((await getDb().prepare("SELECT id, name FROM users").all()) as { id: string; name: string }[])
      .map((owner) => [owner.id, owner.name] as const),
  );
  const byStage = new Map<InstructorStage, typeof instructors>();
  for (const stage of STAGE_ORDER) byStage.set(stage, []);
  for (const i of instructors) {
    if (!byStage.has(i.stage)) byStage.set(i.stage, []);
    byStage.get(i.stage)!.push(i);
  }

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">BOW HQ · Hiring</span>
          <h1 className="ops-title">Instructors</h1>
          <p className="ops-summary">
            The instructor pipeline, grouped by stage — applied through active. {instructors.length} total.
          </p>
        </div>
        <div className="ops-actions">
          <Button href="/app/instructors/new" variant="emphasis">New Applicant</Button>
        </div>
      </header>

      {instructors.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No instructors in the pipeline yet.</h2>
          <p className="ops-empty__body">
            <Link className="ops-inline-link" href="/app/instructors/new">Add one manually</Link> or wait for a public application.
          </p>
        </section>
      ) : (
        STAGE_ORDER.filter((s) => (byStage.get(s) ?? []).length > 0).map((stage) => {
          const rows = byStage.get(stage) ?? [];
          return (
            <section key={stage} className="ops-panel ops-panel--flat">
              <div className="ops-section-head">
                <div>
                  <span className="ops-label">{STAGE_LABEL[stage]}</span>
                  <h2 className="ops-section-title">{rows.length} instructor{rows.length === 1 ? "" : "s"}</h2>
                </div>
                <Badge status={STAGE_BADGE[stage]}>{STAGE_LABEL[stage]}</Badge>
              </div>
              <div className="ops-list">
                {rows.map((i) => (
                  <article className="ops-list-row" key={i.id}>
                    <div>
                      <Link className="ops-record-name" href={`/app/instructors/${i.id}`}>{i.person?.name ?? "—"}</Link>
                      <span className="ops-record-meta">{i.person?.email ?? "—"}</span>
                    </div>
                    <div>
                      <span className="ops-label">Source</span>
                      <span className="ops-value">{i.source ?? "—"}</span>
                    </div>
                    <div>
                      <span className="ops-label">Owner</span>
                      <span className="ops-value">{i.ownerUserId ? ownerNames.get(i.ownerUserId) ?? "Owner unavailable" : "Unassigned"}</span>
                    </div>
                    <div>
                      <span className="ops-label">Days in stage</span>
                      <span className="ops-value">{daysInStage(i.updatedAt)}d</span>
                    </div>
                    <Button href={`/app/instructors/${i.id}`} variant="secondary" size="sm">View</Button>
                  </article>
                ))}
              </div>
            </section>
          );
        })
      )}
    </main>
  );
}
