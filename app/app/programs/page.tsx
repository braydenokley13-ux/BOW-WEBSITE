import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { listPrograms, programStageLabel, type ProgramSummary } from "@/lib/operations";

type View = "launching" | "active" | "paused" | "renewals" | "completed" | "closed" | "all";

const VIEW_LABELS: { value: View; label: string }[] = [
  { value: "launching", label: "Pipeline & Launch" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Recovery" },
  { value: "renewals", label: "Renewals" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All Programs" },
];

function matchesView(summary: ProgramSummary, view: View): boolean {
  const stage = summary.program.stage;
  if (view === "active") return stage === "active";
  if (view === "paused") return stage === "paused";
  if (view === "renewals") {
    return (
      stage === "renewal_review" ||
      stage === "renewed" ||
      summary.program.sourceType === "renewal" ||
      ["review_due", "in_review", "renewed"].includes(summary.program.renewalStatus)
    );
  }
  if (view === "completed") return stage === "completed";
  if (view === "closed") return stage === "closed";
  if (view === "launching") return !["active", "paused", "completed", "renewal_review", "renewed", "closed"].includes(stage);
  return true;
}

function stageTone(stage: string): "positive" | "warning" | "negative" | "info" | "neutral" | "locked" {
  if (stage === "active" || stage === "renewed") return "positive";
  if (stage === "ready_to_launch" || stage === "partner_confirmed") return "info";
  if (stage === "paused" || stage === "closed") return "negative";
  if (["staffing", "enrollment", "recruiting", "renewal_review"].includes(stage)) return "warning";
  if (stage === "completed") return "locked";
  return "neutral";
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireStaff();
  const requested = (await searchParams).view;
  const view: View = VIEW_LABELS.some((item) => item.value === requested) ? (requested as View) : "launching";
  const programs = (await listPrograms());
  const visible = programs.filter((program) => matchesView(program, view));
  const atRisk = programs.filter((program) => program.readiness.blockers.length > 0 && matchesView(program, "launching")).length;

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Operations · Programs</span>
          <h1 className="ops-title">Run every launch from demand to renewal.</h1>
          <p className="ops-summary">
            Programs connect partners, Locations, Curriculum, staffing, enrollment, Classes, and the next decision. {atRisk > 0 ? `${atRisk} launch${atRisk === 1 ? "" : "es"} currently have blockers.` : "No launching Program is blocked."}
          </p>
        </div>
        <div className="ops-actions">
          <Button href="/app/curriculum" variant="secondary">Curriculum</Button>
          <Button href="/app/programs/new" variant="emphasis">Create Program</Button>
        </div>
      </header>

      <nav className="ops-filters" aria-label="Program lifecycle views">
        {VIEW_LABELS.map((item) => {
          const count = programs.filter((program) => matchesView(program, item.value)).length;
          return (
            <Link key={item.value} href={`/app/programs?view=${item.value}`} className="ops-filter" aria-current={view === item.value ? "page" : undefined}>
              {item.label} <span>{count}</span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No Programs are in this lifecycle view.</h2>
          <p className="ops-empty__body">
            Create a Program when partner demand becomes a real operating plan. It will coordinate staffing, enrollment, launch readiness, delivery, and renewal in one place.
          </p>
          <div style={{ marginTop: 18 }}><Button href="/app/programs/new" variant="emphasis">Create the First Program</Button></div>
        </section>
      ) : (
        <section className="ops-list" aria-label={`${VIEW_LABELS.find((item) => item.value === view)?.label} Programs`}>
          {visible.map((summary) => (
            <article className="ops-list-row" key={summary.program.id}>
              <div>
                <Link className="ops-record-name" href={`/app/programs/${summary.program.id}`}>{summary.program.name}</Link>
                <span className="ops-record-meta">{summary.partnerName ?? "Partner not linked"} · {summary.locationName ?? (summary.program.deliveryFormat === "online" ? "Online" : "Location missing")}</span>
              </div>
              <div>
                <Badge status={stageTone(summary.program.stage)}>{programStageLabel(summary.program.stage)}</Badge>
                <span className="ops-record-meta">{summary.program.launchDate ? `Launch ${summary.program.launchDate}` : "Launch date missing"}</span>
              </div>
              <div>
                <span className="ops-label">Owner</span>
                <span className="ops-value">{summary.ownerName ?? "Unassigned"}</span>
                <span className="ops-record-meta">{summary.instructorCount} instructor{summary.instructorCount === 1 ? "" : "s"} · {summary.enrollmentCount} enrolled</span>
              </div>
              <div>
                {matchesView(summary, "launching") || summary.program.stage === "paused" ? (
                  <>
                    <div className="ops-readiness-mini">
                      <span className="ops-readiness-mini__number">{summary.readiness.percent}%</span>
                      <div className="ops-progress" role="progressbar" aria-label={`${summary.program.name} launch readiness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.readiness.percent}><span style={{ width: `${summary.readiness.percent}%` }} /></div>
                    </div>
                    <span className="ops-record-meta">{summary.readiness.primaryBlocker ?? (summary.readiness.warnings[0]?.detail || "Ready for launch")}</span>
                  </>
                ) : (
                  <>
                    <span className="ops-label">Lifecycle evidence</span>
                    <span className="ops-value">{summary.classCount} Class{summary.classCount === 1 ? "" : "es"} · {summary.enrollmentCount} students</span>
                    <span className="ops-record-meta">{summary.program.outcomeSummary ?? `Renewal status: ${summary.program.renewalStatus.replace(/_/g, " ")}`}</span>
                  </>
                )}
              </div>
              <Button href={`/app/programs/${summary.program.id}`} variant="secondary" size="sm">Open Program</Button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
