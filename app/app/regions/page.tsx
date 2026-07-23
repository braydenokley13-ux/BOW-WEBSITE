import Link from "next/link";
import { Badge, Button, DataStrip, PageHeader } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";

type View = "operating" | "active" | "paused" | "closed" | "all";

interface RegionSummaryRow {
  id: string;
  name: string;
  code: string;
  timezone: string | null;
  stage: string;
  notes: string | null;
  leader_name: string | null;
  location_count: number;
  active_location_count: number;
  open_program_count: number;
  updated_at: number;
}

const VIEWS: { value: View; label: string }[] = [
  { value: "operating", label: "Operating Network" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All Regions" },
];

function matchesView(region: RegionSummaryRow, view: View): boolean {
  if (view === "operating") return region.stage !== "closed";
  if (view === "all") return true;
  return region.stage === view;
}

function stageTone(stage: string): "positive" | "warning" | "locked" | "neutral" {
  if (stage === "active") return "positive";
  if (stage === "paused") return "warning";
  if (stage === "closed") return "locked";
  return "neutral";
}

function stageLabel(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function RegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireStaff();
  const requested = (await searchParams).view;
  const view: View = VIEWS.some((item) => item.value === requested) ? (requested as View) : "operating";
  const regions = (await getDb().prepare(
      `SELECT r.*,
            leader.name AS leader_name,
            COUNT(DISTINCT l.id) AS location_count,
            COUNT(DISTINCT CASE WHEN l.stage = 'active' THEN l.id END) AS active_location_count,
            COUNT(DISTINCT CASE WHEN p.stage NOT IN ('completed', 'renewed', 'closed') THEN p.id END) AS open_program_count
       FROM operating_regions r
       LEFT JOIN users leader ON leader.id = r.leader_user_id
       LEFT JOIN locations l ON l.region_id = r.id
       LEFT JOIN programs p ON p.location_id = l.id
      GROUP BY r.id
      ORDER BY CASE r.stage WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'closed' THEN 2 ELSE 3 END,
               r.name`,
    ).all()) as unknown as RegionSummaryRow[];
  const visible = regions.filter((region) => matchesView(region, view));
  const activeCount = regions.filter((region) => region.stage === "active").length;
  const pausedCount = regions.filter((region) => region.stage === "paused").length;
  const activeLocations = regions.reduce((total, region) => total + Number(region.active_location_count), 0);
  const openPrograms = regions.reduce((total, region) => total + Number(region.open_program_count), 0);

  return (
    <main className="ops-page" data-accent="blue">
      <PageHeader
        eyebrow="Programs · Network · Operating Regions"
        title="Give every market a clear leadership layer."
        context="Regions group Locations under one accountable operator, default timezone, and lifecycle record. They are the coordination layer between BOW HQ and local delivery."
        action={
          <div className="ops-actions" style={{ margin: 0 }}>
            <Button href="/app/locations" variant="secondary">Locations</Button>
            <Button href="/app/regions/new" variant="emphasis">Create Region</Button>
          </div>
        }
      />

      <DataStrip
        dense
        items={[
          { label: "Active Regions", value: String(activeCount), tone: activeCount > 0 ? "positive" : undefined },
          { label: "Paused Regions", value: String(pausedCount), tone: pausedCount > 0 ? "warning" : undefined },
          { label: "Active Locations", value: String(activeLocations), tone: activeLocations > 0 ? "info" : undefined },
          { label: "Open Programs", value: String(openPrograms) },
        ]}
      />

      <nav className="ops-filters" aria-label="Region operating views">
        {VIEWS.map((item) => (
          <Link
            key={item.value}
            href={`/app/regions?view=${item.value}`}
            className="ops-filter"
            aria-current={view === item.value ? "page" : undefined}
          >
            {item.label} <span>{regions.filter((region) => matchesView(region, item.value)).length}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No Regions are in this operating view.</h2>
          <p className="ops-empty__body">
            Create the first Region before planning a Location so every market has a default timezone and accountable leader from day one.
          </p>
          <div className="ops-actions" style={{ marginTop: 18 }}>
            <Button href="/app/regions?view=all" variant="secondary">View All Regions</Button>
            <Button href="/app/regions/new" variant="emphasis">Create a Region</Button>
          </div>
        </section>
      ) : (
        <section className="ops-list" aria-label={`${VIEWS.find((item) => item.value === view)?.label} Regions`}>
          {visible.map((region) => (
            <article className="ops-list-row" key={region.id}>
              <div>
                <Link className="ops-record-name" href={`/app/regions/${region.id}`}>{region.name}</Link>
                <span className="ops-record-meta">{region.code} · {region.timezone ?? "Timezone missing"}</span>
              </div>
              <div>
                <Badge status={stageTone(region.stage)}>{stageLabel(region.stage)}</Badge>
                <span className="ops-record-meta">Updated {new Date(region.updated_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="ops-label">Regional leader</span>
                <span className="ops-value">{region.leader_name ?? "Unassigned"}</span>
              </div>
              <div>
                <span className="ops-label">Portfolio</span>
                <span className="ops-value">{region.location_count} Location{Number(region.location_count) === 1 ? "" : "s"}</span>
                <span className="ops-record-meta">{region.active_location_count} active · {region.open_program_count} open Program{Number(region.open_program_count) === 1 ? "" : "s"}</span>
              </div>
              <Button href={`/app/regions/${region.id}`} variant="secondary" size="sm">Open Region</Button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
