"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createLocation, updateLocation, type LocationFormOptions, type LocationInput } from "@/app/actions/locations";
import { Button } from "@/components/ds";
import {
  allowedLocationTransitions,
  LOCATION_TYPE_LABELS,
  LOCATION_TYPES,
  type LocationType,
} from "@/components/app/locations/location-form-model";
import { programStageLabel, type Location, type LocationStage } from "@/lib/operations-shared";
import { COMMON_TIME_ZONES } from "@/lib/timezone";

interface Props {
  options: LocationFormOptions;
  initial?: Location | null;
  defaultLeaderUserId?: string | null;
}

function dateInput(value: string | null | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function initialType(value: string | null | undefined): LocationType {
  return LOCATION_TYPES.includes(value as LocationType) ? (value as LocationType) : "other";
}

export default function LocationForm({ options, initial = null, defaultLeaderUserId = null }: Props) {
  const router = useRouter();
  const startingRegionId = initial?.regionId ?? options.regions[0]?.id ?? "";
  const startingRegion = options.regions.find((region) => region.id === startingRegionId);
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<LocationType>(initialType(initial?.type));
  const [regionId, setRegionId] = useState(startingRegionId);
  const [parentLocationId, setParentLocationId] = useState(initial?.parentLocationId ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [timezone, setTimezone] = useState(initial?.timezone ?? startingRegion?.timezone ?? "");
  const [primaryLeaderUserId, setPrimaryLeaderUserId] = useState(
    initial?.primaryLeaderUserId ?? defaultLeaderUserId ?? "",
  );
  const [capacity, setCapacity] = useState(initial?.capacity == null ? "" : String(initial.capacity));
  const [expectedDemand, setExpectedDemand] = useState(
    initial?.expectedDemand == null ? "" : String(initial.expectedDemand),
  );
  const [earliestLaunchDate, setEarliestLaunchDate] = useState(dateInput(initial?.earliestLaunchDate));
  const [rationale, setRationale] = useState(initial?.rationale ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [stage, setStage] = useState<LocationStage>(initial?.stage ?? "prospect");
  const [transitionReason, setTransitionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentOptions = useMemo(
    () => options.locations.filter((location) => location.regionId === regionId),
    [options.locations, regionId],
  );
  const nextStages = initial ? allowedLocationTransitions(initial.stage) : [];
  const stageChanged = Boolean(initial && stage !== initial.stage);
  const requiresLeader = stage === "launching" || stage === "active";
  const cannotSubmit = busy
    || !name.trim()
    || !regionId
    || !timezone.trim()
    || (requiresLeader && !primaryLeaderUserId)
    || (stageChanged && transitionReason.trim().length < 8);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const input: LocationInput = {
      name,
      type,
      regionId,
      parentLocationId: parentLocationId || null,
      city: city || null,
      state: state || null,
      address: address || null,
      timezone,
      primaryLeaderUserId: primaryLeaderUserId || null,
      stage,
      capacity: capacity === "" ? null : Number(capacity),
      expectedDemand: expectedDemand === "" ? null : Number(expectedDemand),
      earliestLaunchDate: earliestLaunchDate || null,
      rationale: rationale || null,
      notes: notes || null,
      transitionReason: transitionReason || null,
    };

    try {
      const result = initial
        ? await updateLocation(initial.id, initial.updatedAt, initial.stage, input)
        : await createLocation(input);
      if (!result.ok) {
        setError(result.error ?? "The Location could not be saved.");
        setBusy(false);
        return;
      }
      const id = initial?.id ?? ("id" in result ? result.id : undefined);
      router.push(id ? `/app/locations/${id}` : "/app/locations");
      router.refresh();
    } catch {
      setError("The Location could not be saved because the connection was interrupted. Refresh before retrying so you do not overwrite newer work.");
      setBusy(false);
    }
  };

  return (
    <form
      className="ops-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Market identity</h2>
          <p className="ops-form-section__help">
            One canonical Location record should represent the market, campus, or delivery site everywhere in BOW OS.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field ops-field--wide">
            <label htmlFor="location-name">Location name</label>
            <input
              id="location-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Lincoln High School"
              maxLength={160}
              autoComplete="organization"
              required
            />
          </div>
          <div className="ops-field">
            <label htmlFor="location-type">Location type</label>
            <select id="location-type" value={type} onChange={(event) => setType(event.target.value as LocationType)}>
              {LOCATION_TYPES.map((value) => <option key={value} value={value}>{LOCATION_TYPE_LABELS[value]}</option>)}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="location-region">Operating Region</label>
            <select
              id="location-region"
              value={regionId}
              onChange={(event) => {
                const nextRegionId = event.target.value;
                const previousRegionTimezone = options.regions.find((region) => region.id === regionId)?.timezone;
                const nextRegion = options.regions.find((region) => region.id === nextRegionId);
                setRegionId(nextRegionId);
                if (!parentOptions.some((location) => location.id === parentLocationId && location.regionId === nextRegionId)) {
                  setParentLocationId("");
                }
                if (!timezone || timezone === previousRegionTimezone) setTimezone(nextRegion?.timezone ?? "");
              }}
              required
            >
              <option value="">Choose a Region</option>
              {options.regions.map((region) => (
                <option key={region.id} value={region.id}>{region.name} · {region.code}</option>
              ))}
            </select>
            {options.regions.length === 0 && (
              <div className="ops-alert" data-tone="warning" role="status">
                <span className="ops-alert__title">A Region comes first</span>
                <span>Create an active operating Region so this Location inherits accountable leadership and a safe default timezone.</span>
                <div style={{ marginTop: 10 }}>
                  <Button href="/app/regions/new" variant="secondary" size="sm">Create Region</Button>
                </div>
              </div>
            )}
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="location-parent">Parent Location</label>
            <select id="location-parent" value={parentLocationId} onChange={(event) => setParentLocationId(event.target.value)}>
              <option value="">No parent — this is a top-level market</option>
              {parentOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.name} · {programStageLabel(location.stage)}</option>
              ))}
            </select>
            <span className="ops-field__help">Only Locations in the same Region can be connected. Descendants are excluded to prevent hierarchy loops.</span>
          </div>
        </div>
      </section>

      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Geography and time</h2>
          <p className="ops-form-section__help">
            Explicit geography and timezone keep schedules correct when regional leaders operate across cities.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field">
            <label htmlFor="location-city">City</label>
            <input id="location-city" value={city} onChange={(event) => setCity(event.target.value)} maxLength={100} autoComplete="address-level2" placeholder="Philadelphia" />
          </div>
          <div className="ops-field">
            <label htmlFor="location-state">State or province</label>
            <input id="location-state" value={state} onChange={(event) => setState(event.target.value)} maxLength={100} autoComplete="address-level1" placeholder="PA" />
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="location-address">Street address or delivery address</label>
            <input id="location-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} autoComplete="street-address" placeholder="123 Market Street" />
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="location-timezone">IANA timezone</label>
            <input
              id="location-timezone"
              list="location-timezone-options"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              maxLength={100}
              placeholder="America/New_York"
              autoComplete="off"
              required
            />
            <datalist id="location-timezone-options">
              {COMMON_TIME_ZONES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </datalist>
            <span className="ops-field__help">Use a real IANA timezone. Fixed labels such as EST are not accepted because they mishandle daylight-saving changes.</span>
          </div>
        </div>
      </section>

      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Ownership and market signal</h2>
          <p className="ops-form-section__help">
            Make the accountable operator, planning capacity, and demand hypothesis visible before expansion work accelerates.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field ops-field--wide">
            <label htmlFor="location-leader">Primary market leader</label>
            <select
              id="location-leader"
              value={primaryLeaderUserId}
              onChange={(event) => setPrimaryLeaderUserId(event.target.value)}
              required={requiresLeader}
            >
              <option value="">Assign later</option>
              {options.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
            </select>
            <span className="ops-field__help">Launching and active Locations require an active BOW staff leader.</span>
          </div>
          <div className="ops-field">
            <label htmlFor="location-capacity">Planning capacity</label>
            <input id="location-capacity" type="number" min={1} max={100000} step={1} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="250" />
          </div>
          <div className="ops-field">
            <label htmlFor="location-demand">Expected learner demand</label>
            <input id="location-demand" type="number" min={0} max={1000000} step={1} value={expectedDemand} onChange={(event) => setExpectedDemand(event.target.value)} placeholder="120" />
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="location-launch-date">Earliest credible launch date</label>
            <input id="location-launch-date" type="date" value={earliestLaunchDate} onChange={(event) => setEarliestLaunchDate(event.target.value)} />
          </div>
        </div>
      </section>

      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Expansion thesis</h2>
          <p className="ops-form-section__help">
            Preserve the reasoning and constraints so another leader can take over without reconstructing founder context.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field ops-field--wide">
            <label htmlFor="location-rationale">Expansion rationale</label>
            <textarea id="location-rationale" value={rationale} onChange={(event) => setRationale(event.target.value)} maxLength={5000} placeholder="Why this market matters, what evidence supports it, and which assumptions still need testing." />
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="location-notes">Operating notes</label>
            <textarea id="location-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={5000} placeholder="Local constraints, relationships, facility details, and handoff context." />
          </div>
        </div>
      </section>

      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Lifecycle</h2>
          <p className="ops-form-section__help">
            Stage changes are deliberate operating decisions. Closed records stay available for history and cannot be reopened or edited.
          </p>
        </div>
        <div className="ops-fields">
          {initial ? (
            <>
              <div className="ops-field ops-field--wide">
                <label htmlFor="location-stage">Operating stage</label>
                <select
                  id="location-stage"
                  value={stage}
                  onChange={(event) => {
                    setStage(event.target.value as LocationStage);
                    setTransitionReason("");
                  }}
                >
                  <option value={initial.stage}>Keep {programStageLabel(initial.stage)}</option>
                  {nextStages.map((nextStage) => <option key={nextStage} value={nextStage}>Move to {programStageLabel(nextStage)}</option>)}
                </select>
              </div>
              {stageChanged && (
                <div className="ops-field ops-field--wide">
                  <label htmlFor="location-transition-reason">Reason for lifecycle change</label>
                  <textarea
                    id="location-transition-reason"
                    value={transitionReason}
                    onChange={(event) => setTransitionReason(event.target.value)}
                    minLength={8}
                    maxLength={1000}
                    required
                    placeholder="What changed, who owns the next move, and why this stage is now accurate."
                  />
                  <span className="ops-field__help">Required so expansion history remains understandable after ownership changes.</span>
                </div>
              )}
              {stage === "closed" && stageChanged && (
                <div className="ops-alert" data-tone="warning" style={{ gridColumn: "1 / -1" }}>
                  <span className="ops-alert__title">Closing creates a permanent historical record</span>
                  <p className="ops-body" style={{ marginTop: 5 }}>All child Locations, Programs, and Classes must be resolved first. This record cannot be reopened.</p>
                </div>
              )}
            </>
          ) : (
            <div className="ops-alert" data-tone="info" style={{ gridColumn: "1 / -1" }}>
              <span className="ops-alert__title">New Locations begin as Prospects</span>
              <p className="ops-body" style={{ marginTop: 5 }}>This keeps the expansion pipeline honest while demand, ownership, partner fit, and instructor supply are evaluated.</p>
            </div>
          )}
        </div>
      </section>

      {error && <p className="ops-error" role="alert" aria-live="assertive">{error}</p>}
      <div className="ops-form-footer">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" variant="emphasis" disabled={cannotSubmit}>
          {busy ? "Saving Location…" : initial ? "Save Location Plan" : "Create Location"}
        </Button>
      </div>
    </form>
  );
}
