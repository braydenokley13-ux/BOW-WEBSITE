import LocationForm from "@/components/app/locations/LocationForm";
import { getLocationFormOptions } from "@/app/actions/locations";
import { requireStaff } from "@/lib/dal";

export default async function NewLocationPage() {
  const me = await requireStaff();
  const options = await getLocationFormOptions();

  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Network · New Location</span>
          <h1 className="ops-title">Turn a market hypothesis into an owned expansion record.</h1>
          <p className="ops-summary">
            Start with the facts leadership knows today. The Location becomes the durable home for regional ownership, partner demand, instructor supply, Programs, and the next expansion decision.
          </p>
        </div>
      </header>

      <LocationForm options={options} defaultLeaderUserId={me.id} />
    </main>
  );
}
