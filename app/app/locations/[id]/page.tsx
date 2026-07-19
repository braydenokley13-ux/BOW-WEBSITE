import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, DataStrip } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getLocation, programStageLabel } from "@/lib/operations";
import { formatCanonicalDate } from "@/lib/timezone";

function stageTone(stage: string): "positive" | "warning" | "negative" | "info" | "neutral" | "locked" {
  if (stage === "active" || stage === "renewed") return "positive";
  if (stage === "launching" || stage === "ready_to_launch" || stage === "partner_confirmed") return "info";
  if (["evaluating", "staffing", "enrollment", "recruiting", "renewal_review"].includes(stage)) return "warning";
  if (stage === "paused") return "negative";
  if (stage === "closed" || stage === "completed") return "locked";
  return "neutral";
}

function placeLabel(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(", ") || "Geography not yet specified";
}

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const detail = getLocation(id);
  if (!detail) notFound();

  const location = detail.location;
  const newProgramHref = `/app/programs/new?location=${encodeURIComponent(id)}&name=${encodeURIComponent(`${location.name} Program`)}`;
  const summary = detail.primaryBlocker
    ? `${detail.primaryBlocker} ${detail.nextAction} is the next operating move.`
    : location.stage === "active"
      ? `${detail.activeProgramCount} active Program${detail.activeProgramCount === 1 ? " is" : "s are"} serving this market with ${detail.instructorSupply} eligible instructor${detail.instructorSupply === 1 ? "" : "s"} in the local supply.`
      : "Demand, local ownership, instructor supply, and the launch plan are connected. Keep the next expansion decision explicit.";

  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Network · Location command</span>
          <h1 className="ops-title">{location.name}</h1>
          <p className="ops-summary">{summary}</p>
          <div className="ops-status-line">
            <Badge status={stageTone(location.stage)}>{programStageLabel(location.stage)}</Badge>
            <Badge status="neutral">{placeLabel(location.city, location.state)}</Badge>
            {detail.regionName && <Badge status="info">{detail.regionName}</Badge>}
            {detail.primaryBlocker && <Badge status="warning">Operating attention required</Badge>}
          </div>
        </div>
        <div className="ops-actions">
          <Button href="/app/locations" variant="secondary">All Locations</Button>
          {location.stage !== "closed" && (
            <>
              <Button href={`/app/locations/${id}/edit`} variant="secondary">Edit Location</Button>
              <Button href={newProgramHref} variant="emphasis">Create Program Here</Button>
            </>
          )}
        </div>
      </header>

      <DataStrip
        dense
        items={[
          { label: "Expected learners", value: String(detail.expectedDemand), tone: "info" },
          { label: "Eligible instructors", value: String(detail.instructorSupply), tone: detail.instructorSupply > 0 ? "positive" : "warning" },
          { label: "Active Programs", value: `${detail.activeProgramCount} / ${detail.programCount}`, tone: detail.activeProgramCount > 0 ? "positive" : "warning" },
          { label: "Partners", value: String(detail.partnerCount) },
          { label: "Open work", value: String(detail.openTaskCount), tone: detail.openTaskCount > 0 ? "warning" : "positive" },
        ]}
      />

      {detail.primaryBlocker && (
        <section className="ops-alert" data-tone="warning">
          <span className="ops-alert__title">Market-level next decision</span>
          <p className="ops-body" style={{ marginTop: 5, color: "var(--bow-ink)" }}>{detail.primaryBlocker}</p>
          <Link className="ops-inline-link" href={detail.nextActionHref} style={{ display: "inline-block", marginTop: 9 }}>
            {detail.nextAction} →
          </Link>
        </section>
      )}

      <div className="ops-grid">
        <section id="market-plan" className="ops-panel ops-panel--signal ops-anchor">
          <div className="ops-section-head">
            <div><span className="ops-label">Market operating plan</span><h2 className="ops-section-title">What leadership knows</h2></div>
          </div>
          <div className="ops-meta-grid">
            <div className="ops-meta"><span className="ops-label">Location type</span><span className="ops-value">{programStageLabel(location.type)}</span></div>
            <div className="ops-meta"><span className="ops-label">Operating stage</span><span className="ops-value">{programStageLabel(location.stage)}</span></div>
            <div className="ops-meta"><span className="ops-label">Region</span><span className="ops-value">{detail.region?.name ?? location.region ?? "Unassigned"}</span>{detail.region && <span className="ops-record-meta">{detail.region.code} · {detail.region.stage}</span>}</div>
            <div className="ops-meta"><span className="ops-label">Parent Location</span><span className="ops-value">{detail.parentLocation ? <Link href={`/app/locations/${detail.parentLocation.id}`} style={{ color: "var(--bow-blue)" }}>{detail.parentLocation.name}</Link> : "None"}</span></div>
            <div className="ops-meta"><span className="ops-label">Address</span><span className="ops-value">{location.address ?? placeLabel(location.city, location.state)}</span></div>
            <div className="ops-meta"><span className="ops-label">Timezone</span><span className="ops-value">{location.timezone ?? detail.region?.timezone ?? "Not set"}</span></div>
            <div className="ops-meta"><span className="ops-label">Planning capacity</span><span className="ops-value">{location.capacity ?? "Not set"}</span></div>
            <div className="ops-meta"><span className="ops-label">Earliest launch</span><span className="ops-value">{detail.earliestLaunchDate ?? "Not set"}</span></div>
          </div>
          {location.rationale && <div style={{ marginTop: 20 }}><span className="ops-label">Expansion rationale</span><p className="ops-body" style={{ marginTop: 7, whiteSpace: "pre-wrap" }}>{location.rationale}</p></div>}
          {location.notes && <div style={{ marginTop: 20 }}><span className="ops-label">Operating notes</span><p className="ops-body" style={{ marginTop: 7, whiteSpace: "pre-wrap" }}>{location.notes}</p></div>}
        </section>

        <aside className="ops-stack">
          <section className="ops-panel">
            <div className="ops-section-head"><div><span className="ops-label">Accountability</span><h2 className="ops-section-title">Local ownership</h2></div></div>
            <div className="ops-meta">
              <span className="ops-label">Primary market leader</span>
              <span className="ops-value">{detail.leader?.name ?? "Unassigned"}</span>
              <span className="ops-record-meta">{detail.leader ? "Accountable for the market operating plan" : "Assign ownership before expansion depends on this market"}</span>
            </div>
            <div className="ops-meta">
              <span className="ops-label">Current next action</span>
              <span className="ops-value">{detail.nextAction}</span>
              <div style={{ marginTop: 10 }}><Button href={detail.nextActionHref} variant="secondary" size="sm">Take Next Step</Button></div>
            </div>
          </section>

          {detail.childLocations.length > 0 && (
            <section className="ops-panel">
              <div className="ops-section-head"><div><span className="ops-label">Location hierarchy</span><h2 className="ops-section-title">Campuses and sites</h2></div></div>
              {detail.childLocations.map((child) => (
                <div className="ops-meta" key={child.id}>
                  <Link className="ops-value" href={`/app/locations/${child.id}`} style={{ color: "var(--bow-blue)" }}>{child.name}</Link>
                  <span className="ops-record-meta">{placeLabel(child.city, child.state)} · {programStageLabel(child.stage)}</span>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>

      <section className="ops-panel ops-panel--flat">
        <div className="ops-section-head">
          <div><span className="ops-label">Program portfolio</span><h2 className="ops-section-title">Demand through delivery</h2></div>
          <span className="ops-section-note">Programs are the lifecycle record for partner demand, launch readiness, Classes, delivery, and renewal at this Location.</span>
        </div>
        {detail.programs.length === 0 ? (
          <div className="ops-empty">
            <h3 className="ops-empty__title">No Program is planned here.</h3>
            <p className="ops-empty__body">
              {location.stage === "closed"
                ? "This historical Location is locked. Plan a new Location before BOW re-enters this market."
                : "Create the first operating plan when demand is concrete enough to assign ownership and work through launch readiness."}
            </p>
            {location.stage !== "closed" && <div style={{ marginTop: 16 }}><Button href={newProgramHref} variant="emphasis">Create the First Program</Button></div>}
          </div>
        ) : (
          <div className="ops-list">
            {detail.programs.map((summary) => (
              <article className="ops-list-row" key={summary.program.id}>
                <div><Link className="ops-record-name" href={`/app/programs/${summary.program.id}`}>{summary.program.name}</Link><span className="ops-record-meta">{summary.partnerName ?? "Partner not linked"} · {summary.curriculumTitle ?? "Curriculum not set"}</span></div>
                <Badge status={stageTone(summary.program.stage)}>{programStageLabel(summary.program.stage)}</Badge>
                <div><span className="ops-label">Owner</span><span className="ops-value">{summary.ownerName ?? "Unassigned"}</span><span className="ops-record-meta">{summary.instructorCount} instructor{summary.instructorCount === 1 ? "" : "s"} · {summary.enrollmentCount} enrolled</span></div>
                <div><div className="ops-readiness-mini"><span className="ops-readiness-mini__number">{summary.readiness.percent}%</span><div className="ops-progress" role="progressbar" aria-label={`${summary.program.name} launch readiness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.readiness.percent}><span style={{ width: `${summary.readiness.percent}%` }} /></div></div><span className="ops-record-meta">{summary.readiness.primaryBlocker ?? "Operating record clear"}</span></div>
                <Button href={`/app/programs/${summary.program.id}`} variant="secondary" size="sm">Open Program</Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="ops-grid">
        <section className="ops-panel">
          <div className="ops-section-head"><div><span className="ops-label">Partner network</span><h2 className="ops-section-title">Organizations in this market</h2></div></div>
          {detail.partners.length === 0 ? (
            <div className="ops-empty"><h3 className="ops-empty__title">No partner is connected.</h3><p className="ops-empty__body">Connect the organizations that generate demand, host delivery, or support this market.</p></div>
          ) : detail.partners.map((partner) => (
            <div className="ops-meta" key={partner.id}>
              <Link className="ops-value" href={`/app/partners/${partner.id}`} style={{ color: "var(--bow-blue)" }}>{partner.name}</Link>
              <span className="ops-record-meta">{partner.relationshipType.replace(/_/g, " ")} · {partner.status}</span>
            </div>
          ))}
        </section>

        <aside className="ops-panel">
          <div className="ops-section-head"><div><span className="ops-label">Instructor supply</span><h2 className="ops-section-title">Approved local coverage</h2></div></div>
          {detail.instructors.length === 0 ? (
            <div className="ops-empty"><h3 className="ops-empty__title">No coverage is confirmed.</h3><p className="ops-empty__body">Qualify eligible instructors for this Location or its Region before staffing depends on the market.</p><div style={{ marginTop: 16 }}><Button href="/app/instructors" variant="secondary" size="sm">Build Instructor Supply</Button></div></div>
          ) : detail.instructors.map((instructor) => (
            <div className="ops-meta" key={instructor.id}>
              <Link className="ops-value" href={`/app/instructors/${instructor.id}`} style={{ color: "var(--bow-blue)" }}>{instructor.name}</Link>
              <div style={{ marginTop: 7 }}><Badge status={instructor.eligibility === "eligible" ? "positive" : "warning"}>{instructor.eligibility.replace(/_/g, " ")}</Badge></div>
              <span className="ops-record-meta">{programStageLabel(instructor.progressionLevel)}</span>
            </div>
          ))}
        </aside>
      </div>

      <div className="ops-grid">
        <section className="ops-panel">
          <div className="ops-section-head"><div><span className="ops-label">Work</span><h2 className="ops-section-title">Open ownership</h2></div><Button href="/app/tasks" variant="secondary" size="sm">Open Work</Button></div>
          {detail.tasks.length === 0 ? <p className="ops-body">No open Location work. Add a task when a decision, relationship, visit, or launch dependency needs an accountable owner.</p> : detail.tasks.map((task) => (
            <div className="ops-meta" key={task.id}>
              <span className="ops-label">{task.kind} · {task.priority}</span>
              <span className="ops-value">{task.title}</span>
              <span className="ops-record-meta">{task.ownerName ?? "Unassigned"}{task.dueOn ? ` · due ${formatCanonicalDate(task.dueOn)}` : task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ""}</span>
              {task.context && <p className="ops-section-note" style={{ marginTop: 6 }}>{task.context}</p>}
              {task.recommendedAction && <span className="ops-record-meta">Recommended: {task.recommendedAction}</span>}
            </div>
          ))}
        </section>

        <aside className="ops-panel">
          <div className="ops-section-head"><div><span className="ops-label">History</span><h2 className="ops-section-title">Operating activity</h2></div></div>
          {detail.activity.length === 0 ? <p className="ops-body">No meaningful Location activity has been recorded yet.</p> : (
            <div className="ops-timeline">
              {detail.activity.slice(0, 30).map((activity) => (
                <div className="ops-timeline__item" key={activity.id}>
                  <span className="ops-label">{activity.kind.replace(/_/g, " ")} · {new Date(activity.createdAt).toLocaleString()}</span>
                  <p className="ops-body" style={{ marginTop: 5, color: "var(--bow-ink)" }}>{activity.body ?? "Activity recorded."}</p>
                  {activity.actorName && <span className="ops-record-meta">By {activity.actorName}</span>}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
