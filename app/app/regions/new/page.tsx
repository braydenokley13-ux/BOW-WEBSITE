import RegionForm from "@/components/app/regions/RegionForm";
import { getRegionFormOptions } from "@/app/actions/regions";
import { requireStaff } from "@/lib/dal";

export default async function NewRegionPage() {
  const me = await requireStaff();
  const options = await getRegionFormOptions();

  return (
    <main className="ops-page" data-accent="blue">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Network · New Region</span>
          <h1 className="ops-title">Create the leadership layer before adding markets.</h1>
          <p className="ops-summary">
            Set the Region&apos;s durable identity, accountable operator, and timezone. Locations can then inherit coherent operating defaults instead of rebuilding founder context one market at a time.
          </p>
        </div>
      </header>

      <RegionForm options={options} defaultLeaderUserId={me.id} />
    </main>
  );
}
