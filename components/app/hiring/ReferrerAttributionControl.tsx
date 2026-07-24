"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { attributeInstructorReferrer } from "@/app/actions/instructor-growth";

/**
 * Staff control: record which existing instructor referred this one. The
 * canonical link the founder's referral leaderboard reads.
 */
export default function ReferrerAttributionControl({
  instructorId,
  currentReferrerPersonId,
  currentReferrerName,
  options,
}: {
  instructorId: string;
  currentReferrerPersonId: string | null;
  currentReferrerName: string | null;
  options: { id: string; personId: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentReferrerPersonId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // The picker is keyed by referrer person id; options carry person ids.
  const save = async () => {
    setBusy(true);
    setMessage(null);
    const result = await attributeInstructorReferrer(instructorId, value);
    setBusy(false);
    setMessage(result.ok ? "Referrer saved." : result.error ?? "Could not save.");
    if (result.ok) router.refresh();
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div className="ops-field">
        <label htmlFor={`referrer-${instructorId}`}>Referred by</label>
        <select id={`referrer-${instructorId}`} value={value} onChange={(event) => setValue(event.target.value)}>
          <option value="">Not from a referral{currentReferrerName ? ` (currently ${currentReferrerName})` : ""}</option>
          {options.map((option) => (
            <option key={option.id} value={option.personId}>{option.name}</option>
          ))}

        </select>
      </div>
      <div style={{ marginTop: 8 }}>
        <Button size="sm" variant="secondary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save referrer"}</Button>
      </div>
      {message && <p role="status" className="ops-field__help" style={{ marginTop: 6 }}>{message}</p>}
    </div>
  );
}
