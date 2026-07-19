import { notFound } from "next/navigation";
import { getLocationFormOptions } from "@/app/actions/locations";
import LocationForm from "@/components/app/locations/LocationForm";
import { Button } from "@/components/ds";
import { requireStaff } from "@/lib/dal";
import { getLocation } from "@/lib/operations";

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const detail = getLocation(id);
  if (!detail) notFound();

  if (detail.location.stage === "closed") {
    return (
      <main className="ops-page" data-accent="blue">
        <header className="ops-hero">
          <div className="ops-hero__copy">
            <span className="ops-eyebrow">Network · Historical Location</span>
            <h1 className="ops-title">{detail.location.name} is locked.</h1>
            <p className="ops-summary">
              Closed Locations preserve expansion history and cannot be edited or reopened. Plan a new Location when BOW re-enters this market.
            </p>
          </div>
          <div className="ops-actions">
            <Button href={`/app/locations/${id}`} variant="secondary">Return to Location</Button>
            <Button href="/app/locations/new" variant="emphasis">Plan New Location</Button>
          </div>
        </header>
      </main>
    );
  }

  const options = await getLocationFormOptions(id);
  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Network · Location plan</span>
          <h1 className="ops-title">Edit {detail.location.name}</h1>
          <p className="ops-summary">
            Update the canonical market facts here. Hierarchy, ownership, timezone, and lifecycle protections keep every downstream Program working from a coherent Location record.
          </p>
        </div>
        <div className="ops-actions">
          <Button href={`/app/locations/${id}`} variant="secondary">Cancel Editing</Button>
        </div>
      </header>

      <LocationForm options={options} initial={detail.location} />
    </main>
  );
}
