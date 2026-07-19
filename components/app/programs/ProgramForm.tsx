"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { createProgram, updateProgramPlan, type ProgramInput } from "@/app/actions/programs";
import type { DeliveryFormat, Program } from "@/lib/operations-shared";
import { COMMON_TIME_ZONES } from "@/lib/timezone";

interface ProgramOptions {
  organizations: { id: string; name: string }[];
  people: { id: string; name: string; email: string; organizationIds: string[] }[];
  locations: { id: string; name: string; stage: string; timezone: string | null }[];
  curricula: { id: string; title: string; ageRange: string | null }[];
  staff: { id: string; name: string }[];
}

interface Props {
  options: ProgramOptions;
  initial?: Program | null;
  sourceType?: string | null;
  sourceId?: string | null;
  suggestedPartnerId?: string | null;
  suggestedPrimaryContactPersonId?: string | null;
  suggestedLocationId?: string | null;
  suggestedName?: string | null;
  defaultOwnerUserId?: string | null;
}

function dateInput(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString().slice(0, 10);
}

export default function ProgramForm({
  options,
  initial,
  sourceType = "manual",
  sourceId = null,
  suggestedPartnerId = null,
  suggestedPrimaryContactPersonId = null,
  suggestedLocationId = null,
  suggestedName = null,
  defaultOwnerUserId = null,
}: Props) {
  const router = useRouter();
  const [requestKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? `program-${Date.now()}-${Math.random()}`);
  const [name, setName] = useState(initial?.name ?? suggestedName ?? "");
  const [partnerOrgId, setPartnerOrgId] = useState(initial?.partnerOrgId ?? suggestedPartnerId ?? "");
  const [primaryContactPersonId, setPrimaryContactPersonId] = useState(
    initial?.primaryContactPersonId ?? suggestedPrimaryContactPersonId ?? "",
  );
  const [locationId, setLocationId] = useState(initial?.locationId ?? suggestedLocationId ?? "");
  const [curriculumId, setCurriculumId] = useState(initial?.curriculumId ?? "");
  const [audience, setAudience] = useState(initial?.audience ?? "");
  const [deliveryFormat, setDeliveryFormat] = useState<DeliveryFormat>(initial?.deliveryFormat ?? "in_person");
  const [startDate, setStartDate] = useState(dateInput(initial?.startDate));
  const [endDate, setEndDate] = useState(dateInput(initial?.endDate));
  const [launchDate, setLaunchDate] = useState(dateInput(initial?.launchDate));
  const [scheduleLabel, setScheduleLabel] = useState(initial?.scheduleLabel ?? "");
  const [scheduleDay, setScheduleDay] = useState(initial?.scheduleDay == null ? "" : String(initial.scheduleDay));
  const [scheduleStartTime, setScheduleStartTime] = useState(initial?.scheduleStartTime ?? "");
  const [scheduleEndTime, setScheduleEndTime] = useState(initial?.scheduleEndTime ?? "");
  const [scheduleTimezone, setScheduleTimezone] = useState(
    initial?.scheduleTimezone
      ?? options.locations.find((location) => location.id === (initial?.locationId ?? suggestedLocationId))?.timezone
      ?? "",
  );
  const [capacity, setCapacity] = useState(initial?.capacity == null ? "" : String(initial.capacity));
  const [minimumEnrollment, setMinimumEnrollment] = useState(String(initial?.minimumEnrollment ?? 1));
  const [ownerUserId, setOwnerUserId] = useState(initial?.ownerUserId ?? defaultOwnerUserId ?? "");
  const [partnerConfirmed, setPartnerConfirmed] = useState(initial?.partnerConfirmed ?? false);
  const [materialsStatus, setMaterialsStatus] = useState<"not_ready" | "ordered" | "ready">(
    initial?.materialsStatus ?? "not_ready",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCurriculum = useMemo(
    () => options.curricula.find((curriculum) => curriculum.id === curriculumId),
    [curriculumId, options.curricula],
  );
  const partnerPeople = useMemo(
    () => options.people.filter((person) => person.organizationIds.includes(partnerOrgId)),
    [options.people, partnerOrgId],
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    const input: ProgramInput = {
      requestKey: initial ? initial.requestKey : requestKey,
      name,
      partnerOrgId: partnerOrgId || null,
      primaryContactPersonId: primaryContactPersonId || null,
      locationId: locationId || null,
      curriculumId: curriculumId || null,
      audience: audience || null,
      deliveryFormat,
      startDate: startDate || null,
      endDate: endDate || null,
      launchDate: launchDate || null,
      scheduleLabel: scheduleLabel || null,
      scheduleDay: scheduleDay === "" ? null : Number(scheduleDay),
      scheduleStartTime: scheduleStartTime || null,
      scheduleEndTime: scheduleEndTime || null,
      scheduleTimezone: scheduleTimezone || null,
      capacity: capacity === "" ? null : Number(capacity),
      minimumEnrollment: minimumEnrollment === "" ? 1 : Number(minimumEnrollment),
      ownerUserId: ownerUserId || null,
      partnerConfirmed,
      materialsStatus,
      sourceType: initial?.sourceType ?? sourceType ?? "manual",
      sourceId: initial?.sourceId ?? sourceId,
      parentProgramId: initial?.parentProgramId ?? null,
      notes: notes || null,
    };
    try {
      const result = initial ? await updateProgramPlan(initial.id, input) : await createProgram(input);
      if (!result.ok) {
        setError(result.error ?? "The Program could not be saved.");
        setBusy(false);
        return;
      }
      const id = initial?.id ?? ("id" in result ? result.id : undefined);
      if (id) router.push(`/app/programs/${id}`);
      else router.push("/app/programs");
      router.refresh();
    } catch {
      setError("The Program could not be saved because the connection was interrupted. Your request can be retried safely.");
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
          <h2 className="ops-form-section__title">Program identity</h2>
          <p className="ops-form-section__help">
            Name the operating plan, connect the accountable partner, and make ownership explicit.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field ops-field--wide">
            <label htmlFor="program-name">Program name</label>
            <input
              id="program-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Lincoln Fall Front Office Program"
              autoComplete="off"
              required
            />
          </div>
          <div className="ops-field">
            <label htmlFor="program-partner">Partner organization</label>
            <select
              id="program-partner"
              value={partnerOrgId}
              onChange={(event) => {
                const nextPartnerId = event.target.value;
                setPartnerOrgId(nextPartnerId);
                if (nextPartnerId !== partnerOrgId) setPartnerConfirmed(false);
                if (!options.people.some((person) => person.id === primaryContactPersonId && person.organizationIds.includes(nextPartnerId))) {
                  setPrimaryContactPersonId("");
                }
              }}
            >
              <option value="">Select a partner</option>
              {options.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="program-contact">Primary contact</label>
            <select
              id="program-contact"
              value={primaryContactPersonId}
              onChange={(event) => setPrimaryContactPersonId(event.target.value)}
              disabled={!partnerOrgId || partnerPeople.length === 0}
            >
              <option value="">
                {!partnerOrgId ? "Choose a partner first" : partnerPeople.length === 0 ? "No connected contacts" : "Select a contact"}
              </option>
              {partnerPeople.map((person) => (
                <option key={person.id} value={person.id}>{person.name} · {person.email}</option>
              ))}
            </select>
            {partnerOrgId && partnerPeople.length === 0 && (
              <span className="ops-field__help">Invite or connect a partner contact before assigning one to this Program.</span>
            )}
          </div>
          <div className="ops-field">
            <label htmlFor="program-owner">BOW owner</label>
            <select id="program-owner" value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)}>
              <option value="">Assign later</option>
              {options.staff.map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.name}</option>
              ))}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="program-partner-confirmed">Partner confirmation</label>
            <select
              id="program-partner-confirmed"
              value={partnerConfirmed ? "confirmed" : "pending"}
              onChange={(event) => setPartnerConfirmed(event.target.value === "confirmed")}
            >
              <option value="pending">Pending confirmation</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
        </div>
      </section>

      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Delivery plan</h2>
          <p className="ops-form-section__help">
            These facts drive staffing, launch readiness, and what the instructor sees.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field">
            <label htmlFor="program-location">Location</label>
            <select
              id="program-location"
              value={locationId}
              onChange={(event) => {
                const nextLocationId = event.target.value;
                setLocationId(nextLocationId);
                const nextTimezone = options.locations.find((location) => location.id === nextLocationId)?.timezone;
                if (nextTimezone) setScheduleTimezone(nextTimezone);
              }}
              disabled={deliveryFormat === "online"}
            >
              <option value="">{deliveryFormat === "online" ? "Not required for online" : "Select a Location"}</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name} · {location.stage.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="program-format">Delivery format</label>
            <select
              id="program-format"
              value={deliveryFormat}
              onChange={(event) => {
                const nextFormat = event.target.value as DeliveryFormat;
                setDeliveryFormat(nextFormat);
                if (nextFormat === "online") setLocationId("");
              }}
            >
              <option value="in_person">In-person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="program-curriculum">Curriculum</label>
            <select
              id="program-curriculum"
              value={curriculumId}
              onChange={(event) => {
                const nextCurriculumId = event.target.value;
                if (nextCurriculumId !== curriculumId) setMaterialsStatus("not_ready");
                setCurriculumId(nextCurriculumId);
              }}
            >
              <option value="">Select a Curriculum</option>
              {options.curricula.map((curriculum) => (
                <option key={curriculum.id} value={curriculum.id}>{curriculum.title}</option>
              ))}
            </select>
            {selectedCurriculum?.ageRange && <span className="ops-field__help">Designed for {selectedCurriculum.ageRange}.</span>}
          </div>
          <div className="ops-field">
            <label htmlFor="program-audience">Audience or age group</label>
            <input id="program-audience" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Grades 6–9" />
          </div>
          <div className="ops-field">
            <label htmlFor="program-capacity">Default capacity per Class</label>
            <input id="program-capacity" type="number" min={1} max={10000} value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="24" />
          </div>
          <div className="ops-field">
            <label htmlFor="program-minimum">Minimum enrollment per Class</label>
            <input id="program-minimum" type="number" min={1} max={10000} value={minimumEnrollment} onChange={(event) => setMinimumEnrollment(event.target.value)} />
          </div>
        </div>
      </section>

      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Dates and cadence</h2>
          <p className="ops-form-section__help">
            Use the structured weekday and time when known. The plain-language cadence remains useful for partner-facing context.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field">
            <label htmlFor="program-launch">Launch date</label>
            <input id="program-launch" type="date" value={launchDate} onChange={(event) => setLaunchDate(event.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="program-start">Program start</label>
            <input id="program-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="program-end">Program end</label>
            <input id="program-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="program-day">Weekly day</label>
            <select id="program-day" value={scheduleDay} onChange={(event) => setScheduleDay(event.target.value)}>
              <option value="">Not set</option>
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
                <option key={day} value={index}>{day}</option>
              ))}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="program-start-time">Start time</label>
            <input id="program-start-time" type="time" value={scheduleStartTime} onChange={(event) => setScheduleStartTime(event.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="program-end-time">End time</label>
            <input id="program-end-time" type="time" value={scheduleEndTime} onChange={(event) => setScheduleEndTime(event.target.value)} />
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="program-timezone">Delivery timezone</label>
            <input
              id="program-timezone"
              list="program-timezone-options"
              value={scheduleTimezone}
              onChange={(event) => setScheduleTimezone(event.target.value)}
              placeholder="America/New_York"
              required={Boolean(scheduleDay || scheduleStartTime || scheduleEndTime)}
              autoComplete="off"
            />
            <datalist id="program-timezone-options">
              {COMMON_TIME_ZONES.map((timezone) => <option key={timezone.value} value={timezone.value}>{timezone.label}</option>)}
            </datalist>
            <span className="ops-field__help">Local delivery time stays correct when BOW operators work across cities.</span>
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="program-schedule-label">Schedule summary</label>
            <input id="program-schedule-label" value={scheduleLabel} onChange={(event) => setScheduleLabel(event.target.value)} placeholder="Tuesdays after school · 8 weeks" />
          </div>
        </div>
      </section>

      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Launch support</h2>
          <p className="ops-form-section__help">
            Record only the facts the system cannot infer from Classes, staffing, students, and sessions.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field">
            <label htmlFor="program-materials">Materials status</label>
            <select id="program-materials" value={materialsStatus} onChange={(event) => setMaterialsStatus(event.target.value as typeof materialsStatus)}>
              <option value="not_ready">Not ready</option>
              <option value="ordered">Ordered or in progress</option>
              <option value="ready">Ready</option>
            </select>
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="program-notes">Operating notes</label>
            <textarea id="program-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Constraints, commitments, and details the next operator needs to know." />
          </div>
        </div>
      </section>

      {error && <p className="ops-error" role="alert">{error}</p>}
      <div className="ops-form-footer">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" variant="emphasis" disabled={busy || !name.trim()}>
          {busy ? "Saving Program…" : initial ? "Save Program Plan" : "Create Program"}
        </Button>
      </div>
    </form>
  );
}
