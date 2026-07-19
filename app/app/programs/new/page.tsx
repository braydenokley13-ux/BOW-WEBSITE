import ProgramForm from "@/components/app/programs/ProgramForm";
import { requireStaff } from "@/lib/dal";
import { getProgramFormOptions, getProgramSourcePrefill } from "@/lib/operations";

export default async function NewProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; sourceId?: string; partner?: string; location?: string; name?: string }>;
}) {
  const params = await searchParams;
  const me = await requireStaff();
  const options = getProgramFormOptions();
  const prefill = getProgramSourcePrefill(params.source ?? null, params.sourceId ?? null);
  const partner = params.partner && options.organizations.some((organization) => organization.id === params.partner)
    ? params.partner
    : prefill?.partnerOrgId ?? null;
  const location = params.location && options.locations.some((candidate) => candidate.id === params.location)
    ? params.location
    : null;
  const primaryContact = prefill?.primaryContactPersonId
    && partner
    && options.people.some(
      (person) => person.id === prefill.primaryContactPersonId && person.organizationIds.includes(partner),
    )
      ? prefill.primaryContactPersonId
      : null;

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Programs · New operating plan</span>
          <h1 className="ops-title">Turn demand into an owned launch plan.</h1>
          <p className="ops-summary">
            Start with the facts leadership knows today. Readiness will identify the missing pieces and make the next action explicit.
          </p>
        </div>
      </header>
      {params.source === "inquiry" && prefill && (
        <section className="ops-alert" data-tone="positive">
          <span className="ops-alert__title">Public demand is connected</span>
          <p className="ops-body" style={{ marginTop: 5 }}>
            This Program will preserve the originating inquiry, partner, and contact as one connected operating record.
          </p>
        </section>
      )}
      <ProgramForm
        options={options}
        sourceType={params.source ?? "manual"}
        sourceId={params.sourceId ?? null}
        suggestedPartnerId={partner}
        suggestedPrimaryContactPersonId={primaryContact}
        suggestedLocationId={location}
        suggestedName={params.name ?? prefill?.name ?? null}
        defaultOwnerUserId={me.id}
      />
    </main>
  );
}
