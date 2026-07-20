"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { createClass } from "@/app/actions/classes";
import { COMMON_TIME_ZONES } from "@/lib/timezone";

interface Props {
  curricula: { id: string; title: string }[];
  organizations: { id: string; name: string }[];
}

export default function NewClassForm({ curricula, organizations }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [curriculumId, setCurriculumId] = useState(curricula[0]?.id ?? "");
  const [partnerOrgId, setPartnerOrgId] = useState("");
  const [location, setLocation] = useState("");
  const [deliveryFormat, setDeliveryFormat] = useState<"in_person" | "online" | "hybrid">("in_person");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scheduleDay, setScheduleDay] = useState("");
  const [scheduleStartTime, setScheduleStartTime] = useState("");
  const [scheduleEndTime, setScheduleEndTime] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [capacity, setCapacity] = useState("");
  const [minimumEnrollment, setMinimumEnrollment] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await createClass({
        title,
        curriculumId,
        partnerOrgId: partnerOrgId || undefined,
        location: location || undefined,
        onlineFormat: deliveryFormat === "in_person" ? undefined : deliveryFormat,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        scheduleDay: scheduleDay === "" ? undefined : Number(scheduleDay),
        scheduleStartTime: scheduleStartTime || undefined,
        scheduleEndTime: scheduleEndTime || undefined,
        scheduleTimezone: scheduleTimezone || undefined,
        recurrence: recurrence || undefined,
        ageRange: ageRange || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        minimumEnrollment: Number(minimumEnrollment),
      });
      if (res.ok && res.programId) router.push(`/app/programs/${res.programId}`);
      else if (res.ok && res.id) router.push(`/app/classes/${res.id}`);
      else {
        setError(res.error ?? "Something went wrong.");
        setBusy(false);
      }
    } catch {
      setError("The Program could not be created. Refresh and try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="ops-form">
      <div className="ops-form-section">
        <div>
          <h3 className="ops-form-section__title">Delivery</h3>
          <p className="ops-form-section__help">What is being taught, and to whom.</p>
        </div>
        <div className="ops-fields">
          <div className="ops-field ops-field--wide">
            <label htmlFor="nc-title">Title</label>
            <input id="nc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="nc-curriculum">Curriculum</label>
            <select id="nc-curriculum" value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)}>
              {curricula.length === 0 && <option value="">No curricula yet</option>}
              {curricula.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="nc-org">Partner organization</label>
            <select id="nc-org" value={partnerOrgId} onChange={(e) => setPartnerOrgId(e.target.value)}>
              <option value="">None</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="nc-loc">Location</label>
            <input id="nc-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="nc-age">Age range</label>
            <input id="nc-age" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="ops-form-section">
        <div>
          <h3 className="ops-form-section__title">Schedule</h3>
          <p className="ops-form-section__help">When and how this delivery meets.</p>
        </div>
        <div className="ops-fields">
          <div className="ops-field">
            <label htmlFor="nc-format">Delivery format</label>
            <select id="nc-format" value={deliveryFormat} onChange={(event) => setDeliveryFormat(event.target.value as typeof deliveryFormat)}>
              <option value="in_person">In person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="nc-day">Weekly day</label>
            <select id="nc-day" value={scheduleDay} onChange={(event) => setScheduleDay(event.target.value)}>
              <option value="">Not set</option>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor="nc-time-start">Start time</label>
            <input id="nc-time-start" type="time" value={scheduleStartTime} onChange={(event) => setScheduleStartTime(event.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="nc-time-end">End time</label>
            <input id="nc-time-end" type="time" value={scheduleEndTime} onChange={(event) => setScheduleEndTime(event.target.value)} />
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="nc-timezone">Delivery timezone</label>
            <input
              id="nc-timezone"
              list="nc-timezone-options"
              value={scheduleTimezone}
              onChange={(event) => setScheduleTimezone(event.target.value)}
              placeholder="America/New_York"
              required={Boolean(scheduleDay || scheduleStartTime || scheduleEndTime)}
              autoComplete="off"
            />
            <datalist id="nc-timezone-options">
              {COMMON_TIME_ZONES.map((timezone) => <option key={timezone.value} value={timezone.value}>{timezone.label}</option>)}
            </datalist>
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="nc-recurrence">Schedule note</label>
            <input id="nc-recurrence" value={recurrence} onChange={(event) => setRecurrence(event.target.value)} placeholder="Example: Weekly for 8 weeks" />
          </div>
          <div className="ops-field">
            <label htmlFor="nc-start">Start date</label>
            <input id="nc-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="nc-end">End date</label>
            <input id="nc-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="nc-cap">Capacity</label>
            <input id="nc-cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="nc-min">Minimum enrollment</label>
            <input id="nc-min" type="number" min={1} value={minimumEnrollment} onChange={(e) => setMinimumEnrollment(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <p role="alert" className="ops-error">{error}</p>}
      <div className="ops-form-footer">
        <Button type="submit" variant="primary" size="md" disabled={busy || !curriculumId}>
          {busy ? "Creating…" : "Create Program + Class"}
        </Button>
      </div>
    </form>
  );
}
