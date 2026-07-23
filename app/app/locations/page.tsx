import Link from "next/link";
import { Badge, Button, DataStrip, PageHeader } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { listLocations, programStageLabel, type LocationSummary } from "@/lib/operations";

type View = "pipeline" | "active" | "attention" | "paused" | "closed" | "all";

const VIEW_LABELS: { value: View; label: string }[] = [
  { value: "pipeline", label: "Expansion Pipeline" },
  { value: "active", label: "Active Markets" },
  { value: "attention", label: "Needs Attention" },
  { value: "paused", label: "Recovery" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All Locations" },
];

function matchesView(summary: LocationSummary, view: View): boolean {
  if (view === "pipeline") return ["prospect", "evaluating", "launching"].includes(summary.location.stage);
  if (view === "active") return summary.location.stage === "active";
  if (view === "attention") return Boolean(summary.primaryBlocker) && summary.location.stage !== "closed";
  if (view === "paused") return summary.location.stage === "paused";
  if (view === "closed") return summary.location.stage === "closed";
  return true;
}

function stageTone(stage: string): "positive" | "warning" | "negative" | "info" | "neutral" | "locked" {
  if (stage === "active") return "positive";
  if (stage === "launching") return "info";
  if (stage === "evaluating") return "warning";
  if (stage === "paused") return "negative";
  if (stage === "closed") return "locked";
  return "neutral";
}

function placeLabel(summary: LocationSummary): string {
  const place = [summary.location.city, summary.location.state].filter(Boolean).join(", ");
  const hierarchy = summary.parentLocationName ? `Part of ${summary.parentLocationName}` : summary.regionName;
  return [place || summary.location.address, hierarchy].filter(Boolean).join(" · ") || "Geography not yet specified";
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireStaff();
  const requested = (await searchParams).view;
  const view: View = VIEW_LABELS.some((item) => item.value === requested) ? (requested as View) : "pipeline";
  const locations = (await listLocations());
  const visible = locations.filter((location) => matchesView(location, view));
  const pipelineCount = locations.filter((location) => matchesView(location, "pipeline")).length;
  const activeCount = locations.filter((location) => matchesView(location, "active")).length;
  const attentionCount = locations.filter((location) => matchesView(location, "attention")).length;
  const plannedPrograms = locations.reduce((sum, location) => sum + location.programCount, 0);

  return (
    <main className="ops-page" data-accent="blue">
      <PageHeader
        eyebrow="Programs · Network · Locations"
        title="Build repeatable markets, not isolated launches."
        context={`Each Location connects regional ownership, partner demand, instructor supply, active Programs, and the next expansion decision. ${attentionCount > 0 ? `${attentionCount} market${attentionCount === 1 ? " needs" : "s need"} attention.` : "Every market has a clear operating path."}`}
        action={
          <div className="ops-actions" style={{ margin: 0 }}>
            <Button href="/app/partners" variant="secondary">Partners</Button>
            <Button href="/app/programs/new" variant="secondary">Create Program</Button>
            <Button href="/app/locations/new" variant="emphasis">Plan Location</Button>
          </div>
        }
      />

      <DataStrip
        dense
        items={[
          { label: "Expansion pipeline", value: String(pipelineCount), tone: pipelineCount > 0 ? "info" : undefined },
          { label: "Active markets", value: String(activeCount), tone: activeCount > 0 ? "positive" : undefined },
          { label: "Need attention", value: String(attentionCount), tone: attentionCount > 0 ? "warning" : undefined },
          { label: "Programs planned", value: String(plannedPrograms) },
        ]}
      />

      <nav className="ops-filters" aria-label="Location operating views">
        {VIEW_LABELS.map((item) => {
          const count = locations.filter((location) => matchesView(location, item.value)).length;
          return (
            <Link key={item.value} href={`/app/locations?view=${item.value}`} className="ops-filter" aria-current={view === item.value ? "page" : undefined}>
              {item.label} <span>{count}</span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No Locations are in this operating view.</h2>
          <p className="ops-empty__body">
            Locations become useful when demand, local ownership, instructor coverage, and Programs are connected in one market record.
          </p>
          <div className="ops-actions" style={{ marginTop: 18 }}>
            <Button href="/app/locations?view=all" variant="secondary">View All Locations</Button>
            <Button href="/app/locations/new" variant="emphasis">Plan a Location</Button>
          </div>
        </section>
      ) : (
        <section className="ops-list" aria-label={`${VIEW_LABELS.find((item) => item.value === view)?.label} Locations`}>
          {visible.map((summary) => (
            <article className="ops-location-row" key={summary.location.id}>
              <div>
                <Link className="ops-record-name" href={`/app/locations/${summary.location.id}`}>{summary.location.name}</Link>
                <span className="ops-record-meta">{placeLabel(summary)}</span>
              </div>
              <div>
                <Badge status={stageTone(summary.location.stage)}>{programStageLabel(summary.location.stage)}</Badge>
                <span className="ops-record-meta">{summary.earliestLaunchDate ? `Earliest launch ${summary.earliestLaunchDate}` : "Launch horizon not set"}</span>
              </div>
              <div>
                <span className="ops-label">Local ownership</span>
                <span className="ops-value">{summary.leaderName ?? "Leader unassigned"}</span>
                <span className="ops-record-meta">{summary.partnerCount} partner{summary.partnerCount === 1 ? "" : "s"} · {summary.openTaskCount} open work item{summary.openTaskCount === 1 ? "" : "s"}</span>
              </div>
              <div>
                <span className="ops-label">Market signal</span>
                <span className="ops-value">{summary.expectedDemand} expected learners · {summary.instructorSupply} eligible instructor{summary.instructorSupply === 1 ? "" : "s"}</span>
                <span className="ops-record-meta">{summary.activeProgramCount} active / {summary.programCount} total Programs</span>
              </div>
              <div>
                <span className="ops-label">Next decision</span>
                <span className="ops-record-meta">{summary.primaryBlocker ?? summary.nextAction}</span>
              </div>
              <Button href={`/app/locations/${summary.location.id}`} variant="secondary" size="sm">Open Location</Button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
