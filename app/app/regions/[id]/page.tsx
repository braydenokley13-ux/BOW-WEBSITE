import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, DataStrip } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";

interface RegionDetailRow {
  id: string;
  name: string;
  code: string;
  leader_user_id: string | null;
  leader_name: string | null;
  leader_role: string | null;
  leader_status: string | null;
  timezone: string | null;
  stage: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

interface LocationRow {
  id: string;
  name: string;
  type: string;
  city: string | null;
  state: string | null;
  stage: string;
  timezone: string | null;
  leader_name: string | null;
  program_count: number;
  open_program_count: number;
}

interface ActivityRow {
  id: string;
  kind: string;
  body: string | null;
  created_at: number;
  actor_name: string | null;
}

function stageTone(stage: string): "positive" | "warning" | "locked" | "info" | "neutral" {
  if (stage === "active") return "positive";
  if (stage === "paused") return "warning";
  if (stage === "closed") return "locked";
  if (["launching", "evaluating"].includes(stage)) return "info";
  return "neutral";
}

function label(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function placeLabel(location: LocationRow): string {
  return [location.city, location.state].filter(Boolean).join(", ") || "Geography not specified";
}

export default async function RegionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const db = getDb();
  const region = db.prepare(
    `SELECT r.*,
            leader.name AS leader_name,
            leader.role AS leader_role,
            leader.status AS leader_status
       FROM operating_regions r
       LEFT JOIN users leader ON leader.id = r.leader_user_id
      WHERE r.id = ?`,
  ).get(id) as RegionDetailRow | undefined;
  if (!region) notFound();

  const locations = db.prepare(
    `SELECT l.id, l.name, l.type, l.city, l.state, l.stage, l.timezone,
            leader.name AS leader_name,
            COUNT(DISTINCT p.id) AS program_count,
            COUNT(DISTINCT CASE WHEN p.stage NOT IN ('completed', 'renewed', 'closed') THEN p.id END) AS open_program_count
       FROM locations l
       LEFT JOIN users leader ON leader.id = l.primary_leader_user_id
       LEFT JOIN programs p ON p.location_id = l.id
      WHERE l.region_id = ?
      GROUP BY l.id
      ORDER BY CASE l.stage
        WHEN 'active' THEN 0 WHEN 'launching' THEN 1 WHEN 'evaluating' THEN 2
        WHEN 'prospect' THEN 3 WHEN 'paused' THEN 4 WHEN 'closed' THEN 5 ELSE 6 END,
        l.name`,
  ).all(id) as unknown as LocationRow[];
  const activity = db.prepare(
    `SELECT a.id, a.kind, a.body, a.created_at, actor.name AS actor_name
       FROM crm_activity a
       LEFT JOIN users actor ON actor.id = a.actor_user_id
      WHERE a.entity_type = 'operating_region' AND a.entity_id = ?
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 50`,
  ).all(id) as unknown as ActivityRow[];

  const activeLocations = locations.filter((location) => location.stage === "active").length;
  const openLocations = locations.filter((location) => location.stage !== "closed").length;
  const openPrograms = locations.reduce((total, location) => total + Number(location.open_program_count), 0);
  const missingLocationLeader = locations.filter((location) => location.stage !== "closed" && !location.leader_name).length;
  const summary = region.stage === "closed"
    ? "This historical Region is locked. Its leadership decisions and Location portfolio remain available for review."
    : region.stage === "paused"
      ? `${openLocations} open Location${openLocations === 1 ? " remains" : "s remain"}. Resolve the recovery decision before returning the Region to active operations.`
      : `${activeLocations} active Location${activeLocations === 1 ? " is" : "s are"} coordinated through ${region.leader_name ?? "an unassigned leadership seat"}.`;

  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Network · Region command</span>
          <h1 className="ops-title">{region.name}</h1>
          <p className="ops-summary">{summary}</p>
          <div className="ops-status-line">
            <Badge status={stageTone(region.stage)}>{label(region.stage)}</Badge>
            <Badge status="neutral">{region.code}</Badge>
            <Badge status="info">{region.timezone ?? "Timezone missing"}</Badge>
            {missingLocationLeader > 0 && <Badge status="warning">{missingLocationLeader} ownership gap{missingLocationLeader === 1 ? "" : "s"}</Badge>}
          </div>
        </div>
        <div className="ops-actions">
          <Button href="/app/regions" variant="secondary">All Regions</Button>
          {region.stage !== "closed" ? (
            <>
              <Button href={`/app/regions/${id}/edit`} variant="secondary">Edit Region</Button>
              <Button href="/app/locations/new" variant="emphasis">Plan Location</Button>
            </>
          ) : (
            <Button href="/app/regions/new" variant="emphasis">Create New Region</Button>
          )}
        </div>
      </header>

      <DataStrip
        dense
        items={[
          { label: "Locations", value: String(locations.length) },
          { label: "Active Locations", value: String(activeLocations), tone: activeLocations > 0 ? "positive" : undefined },
          { label: "Open Programs", value: String(openPrograms), tone: openPrograms > 0 ? "info" : undefined },
          { label: "Ownership Gaps", value: String(missingLocationLeader), tone: missingLocationLeader > 0 ? "warning" : "positive" },
        ]}
      />

      {region.stage === "paused" && (
        <section className="ops-alert" data-tone="warning">
          <span className="ops-alert__title">Regional operations are paused</span>
          <p className="ops-body" style={{ marginTop: 5 }}>
            Existing records remain visible. Use the Region plan to document the recovery decision before reactivating or permanently closing the Region.
          </p>
        </section>
      )}

      <div className="ops-grid">
        <section className="ops-panel ops-panel--signal">
          <div className="ops-section-head">
            <div><span className="ops-label">Operating charter</span><h2 className="ops-section-title">Regional accountability</h2></div>
          </div>
          <div className="ops-meta-grid">
            <div className="ops-meta"><span className="ops-label">Regional leader</span><span className="ops-value">{region.leader_name ?? "Unassigned"}</span><span className="ops-record-meta">{region.leader_name ? `${label(region.leader_role ?? "staff")} · ${label(region.leader_status ?? "unknown")}` : "Assign ownership before active operations depend on this Region"}</span></div>
            <div className="ops-meta"><span className="ops-label">Default timezone</span><span className="ops-value">{region.timezone ?? "Not set"}</span><span className="ops-record-meta">Used as the planning default for new Locations</span></div>
            <div className="ops-meta"><span className="ops-label">Region code</span><span className="ops-value">{region.code}</span><span className="ops-record-meta">Stable shorthand for planning and reporting</span></div>
            <div className="ops-meta"><span className="ops-label">Last updated</span><span className="ops-value">{new Date(region.updated_at).toLocaleString()}</span><span className="ops-record-meta">Created {new Date(region.created_at).toLocaleDateString()}</span></div>
          </div>
          <div style={{ marginTop: 20 }}>
            <span className="ops-label">Operating notes</span>
            <p className="ops-body" style={{ marginTop: 7, whiteSpace: "pre-wrap" }}>{region.notes ?? "No regional operating context has been recorded yet."}</p>
          </div>
        </section>

        <aside className="ops-panel">
          <div className="ops-section-head">
            <div><span className="ops-label">Lifecycle guardrail</span><h2 className="ops-section-title">Historical integrity</h2></div>
          </div>
          {region.stage === "closed" ? (
            <p className="ops-body">This Region cannot be edited, reopened, or deleted. Build a new Region if BOW returns with a new operating structure.</p>
          ) : openLocations > 0 ? (
            <>
              <p className="ops-body">This Region cannot close while {openLocations} nonclosed Location{openLocations === 1 ? " still references" : "s still reference"} it.</p>
              <div style={{ marginTop: 16 }}><Button href="/app/locations?view=all" variant="secondary" size="sm">Resolve Locations</Button></div>
            </>
          ) : (
            <p className="ops-body">No open Location blocks closure. A recorded reason is still required for any lifecycle move.</p>
          )}
        </aside>
      </div>

      <section className="ops-panel ops-panel--flat">
        <div className="ops-section-head">
          <div><span className="ops-label">Location portfolio</span><h2 className="ops-section-title">Markets under this leadership layer</h2></div>
          {region.stage !== "closed" && <Button href="/app/locations/new" variant="secondary" size="sm">Plan Location</Button>}
        </div>
        {locations.length === 0 ? (
          <div className="ops-empty">
            <h3 className="ops-empty__title">No Location is connected yet.</h3>
            <p className="ops-empty__body">Create the first Location to connect local ownership, partner demand, instructor supply, and Programs to this Region.</p>
            {region.stage !== "closed" && <div style={{ marginTop: 16 }}><Button href="/app/locations/new" variant="emphasis">Create First Location</Button></div>}
          </div>
        ) : (
          <div className="ops-list">
            {locations.map((location) => (
              <article className="ops-list-row" key={location.id}>
                <div>
                  <Link className="ops-record-name" href={`/app/locations/${location.id}`}>{location.name}</Link>
                  <span className="ops-record-meta">{placeLabel(location)} · {label(location.type)}</span>
                </div>
                <div><Badge status={stageTone(location.stage)}>{label(location.stage)}</Badge><span className="ops-record-meta">{location.timezone ?? region.timezone ?? "Timezone missing"}</span></div>
                <div><span className="ops-label">Market leader</span><span className="ops-value">{location.leader_name ?? "Unassigned"}</span></div>
                <div><span className="ops-label">Program portfolio</span><span className="ops-value">{location.program_count} total</span><span className="ops-record-meta">{location.open_program_count} open</span></div>
                <Button href={`/app/locations/${location.id}`} variant="secondary" size="sm">Open Location</Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="ops-panel">
        <div className="ops-section-head">
          <div><span className="ops-label">Operating history</span><h2 className="ops-section-title">Region decisions</h2></div>
          <span className="ops-section-note">Identity, ownership, and lifecycle changes are recorded so leadership context survives delegation.</span>
        </div>
        {activity.length === 0 ? (
          <div className="ops-empty"><h3 className="ops-empty__title">No Region activity has been recorded.</h3><p className="ops-empty__body">The next saved operating change will appear here.</p></div>
        ) : (
          <div className="ops-timeline">
            {activity.map((item) => (
              <div className="ops-timeline__item" key={item.id}>
                <span className="ops-label">{label(item.kind)} · {new Date(item.created_at).toLocaleString()}</span>
                <p className="ops-body" style={{ marginTop: 5, color: "var(--bow-ink)" }}>{item.body ?? "Activity recorded."}</p>
                {item.actor_name && <span className="ops-record-meta">By {item.actor_name}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
