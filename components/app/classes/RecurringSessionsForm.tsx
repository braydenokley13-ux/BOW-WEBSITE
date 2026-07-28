"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { scheduleRecurringSessions } from "@/app/actions/delivery";
import { COMMON_TIME_ZONES, DEFAULT_TIME_ZONE } from "@/lib/timezone";

interface Props {
  classId: string;
  defaultTimeZone: string | null;
  defaultLocation: string | null;
}

/** Generates a run of weekly (or custom-interval) sessions in one call, inheriting the class's location unless overridden. */
export default function RecurringSessionsForm({ classId, defaultTimeZone, defaultLocation }: Props) {
  const router = useRouter();
  const [firstLocalDateTime, setFirstLocalDateTime] = useState("");
  const [timeZone, setTimeZone] = useState(defaultTimeZone && defaultTimeZone.trim() ? defaultTimeZone : DEFAULT_TIME_ZONE);
  const [count, setCount] = useState(8);
  const [intervalDays, setIntervalDays] = useState(7);
  const [location, setLocation] = useState(defaultLocation ?? "");
  const [meetingLink, setMeetingLink] = useState("");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    const response = await scheduleRecurringSessions(classId, {
      firstLocalDateTime,
      timeZone,
      count,
      intervalDays,
      location: location || undefined,
      meetingLink: meetingLink || undefined,
      titlePrefix: titlePrefix || undefined,
    });
    if (!response.ok) {
      setError(response.error ?? "Sessions could not be scheduled.");
      setBusy(false);
      return;
    }
    setResult({ created: response.created ?? 0, skipped: response.skipped ?? 0 });
    setBusy(false);
    router.refresh();
  };

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <div className="ops-field">
        <label htmlFor={`recur-first-${classId}`}>First session</label>
        <input id={`recur-first-${classId}`} type="datetime-local" value={firstLocalDateTime} onChange={(event) => setFirstLocalDateTime(event.target.value)} />
      </div>
      <div className="ops-field">
        <label htmlFor={`recur-tz-${classId}`}>Timezone</label>
        <select id={`recur-tz-${classId}`} value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
          {COMMON_TIME_ZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="ops-field" style={{ flex: "1 1 140px" }}>
          <label htmlFor={`recur-count-${classId}`}>Number of sessions</label>
          <input id={`recur-count-${classId}`} type="number" min={1} max={52} value={count} onChange={(event) => setCount(Number(event.target.value))} />
        </div>
        <div className="ops-field" style={{ flex: "1 1 140px" }}>
          <label htmlFor={`recur-interval-${classId}`}>Interval (days)</label>
          <input id={`recur-interval-${classId}`} type="number" min={1} max={90} value={intervalDays} onChange={(event) => setIntervalDays(Number(event.target.value))} />
        </div>
      </div>
      <div className="ops-field">
        <label htmlFor={`recur-location-${classId}`}>Location (optional)</label>
        <input id={`recur-location-${classId}`} type="text" value={location} onChange={(event) => setLocation(event.target.value)} />
      </div>
      <div className="ops-field">
        <label htmlFor={`recur-link-${classId}`}>Meeting link (optional)</label>
        <input id={`recur-link-${classId}`} type="text" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://…" />
      </div>
      <div className="ops-field">
        <label htmlFor={`recur-prefix-${classId}`}>Title prefix (optional)</label>
        <input id={`recur-prefix-${classId}`} type="text" value={titlePrefix} onChange={(event) => setTitlePrefix(event.target.value)} placeholder="e.g. Week" />
      </div>

      {error && <p className="ops-error" role="alert">{error}</p>}
      {result && (
        <p className="ops-record-meta">
          {result.created} session{result.created === 1 ? "" : "s"} created
          {result.skipped > 0 ? `, ${result.skipped} skipped (already existed or fell outside the class dates).` : "."}
        </p>
      )}
      <Button variant="emphasis" size="sm" disabled={busy || !firstLocalDateTime} onClick={submit}>
        {busy ? "Scheduling…" : "Schedule sessions"}
      </Button>
    </div>
  );
}
