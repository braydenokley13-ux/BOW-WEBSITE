import { notFound } from "next/navigation";
import { getRegionFormOptions, type RegionRecord, type RegionStage } from "@/app/actions/regions";
import RegionForm from "@/components/app/regions/RegionForm";
import { Button } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";

interface RegionRow {
  id: string;
  name: string;
  code: string;
  leader_user_id: string | null;
  timezone: string | null;
  stage: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

const REGION_STAGES: RegionStage[] = ["active", "paused", "closed"];

export default async function EditRegionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const row = getDb().prepare("SELECT * FROM operating_regions WHERE id = ?").get(id) as RegionRow | undefined;
  if (!row) notFound();

  if (row.stage === "closed") {
    return (
      <main className="ops-page" data-accent="blue">
        <header className="ops-hero">
          <div className="ops-hero__copy">
            <span className="ops-eyebrow">Network · Historical Region</span>
            <h1 className="ops-title">{row.name} is locked.</h1>
            <p className="ops-summary">Closed Regions preserve the leadership and Location history that informed expansion. They cannot be edited, reopened, or deleted.</p>
          </div>
          <div className="ops-actions">
            <Button href={`/app/regions/${id}`} variant="secondary">Return to Region</Button>
            <Button href="/app/regions/new" variant="emphasis">Create New Region</Button>
          </div>
        </header>
      </main>
    );
  }

  if (!REGION_STAGES.includes(row.stage as RegionStage)) notFound();
  const region: RegionRecord = {
    id: row.id,
    name: row.name,
    code: row.code,
    leaderUserId: row.leader_user_id,
    timezone: row.timezone ?? "",
    stage: row.stage as RegionStage,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const options = await getRegionFormOptions();

  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Network · Region plan</span>
          <h1 className="ops-title">Edit {region.name}</h1>
          <p className="ops-summary">Update the canonical leadership, timezone, and operating context. Lifecycle changes require a durable reason and are protected against stale edits.</p>
        </div>
        <div className="ops-actions"><Button href={`/app/regions/${id}`} variant="secondary">Cancel Editing</Button></div>
      </header>

      <RegionForm options={options} initial={region} />
    </main>
  );
}
