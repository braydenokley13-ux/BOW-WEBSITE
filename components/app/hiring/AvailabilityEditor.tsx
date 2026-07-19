"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { updateInstructorAvailability, type AvailabilitySlotInput } from "@/app/actions/instructors";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes?: string;
}

export default function AvailabilityEditor({ instructorId, initialSlots }: { instructorId: string; initialSlots: AvailabilitySlot[] }) {
  const router = useRouter();
  const [slots, setSlots] = useState<AvailabilitySlot[]>(initialSlots.length > 0 ? initialSlots : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const addSlot = () => setSlots((s) => [...s, { dayOfWeek: 1, startTime: "15:00", endTime: "17:00", notes: "" }]);
  const removeSlot = (i: number) => setSlots((s) => s.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<AvailabilitySlot>) =>
    setSlots((s) => s.map((slot, idx) => (idx === i ? { ...slot, ...patch } : slot)));

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const payload: AvailabilitySlotInput[] = slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      notes: s.notes,
    }));
    const res = await updateInstructorAvailability(instructorId, payload);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setError(res.error || "Something went wrong.");
    }
    setBusy(false);
  };

  return (
    <div className="ops-form" style={{ gap: 18 }}>
      {slots.length === 0 && <p className="ops-body">No availability set.</p>}
      {slots.map((s, i) => (
        <div className="ops-fields" key={i}>
          <div className="ops-field">
            <label htmlFor={`availability-day-${i}`}>Day</label>
            <select id={`availability-day-${i}`} value={s.dayOfWeek} onChange={(e) => update(i, { dayOfWeek: Number(e.target.value) })}>
              {DAY_LABELS.map((d, idx) => (
                <option key={d} value={idx}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="ops-field">
            <label htmlFor={`availability-notes-${i}`}>Notes <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
            <input id={`availability-notes-${i}`} placeholder="Notes" value={s.notes ?? ""} onChange={(e) => update(i, { notes: e.target.value })} />
          </div>
          <div className="ops-field">
            <label htmlFor={`availability-start-${i}`}>Start time</label>
            <input id={`availability-start-${i}`} type="time" value={s.startTime} onChange={(e) => update(i, { startTime: e.target.value })} />
          </div>
          <div className="ops-field">
            <label htmlFor={`availability-end-${i}`}>End time</label>
            <input id={`availability-end-${i}`} type="time" value={s.endTime} onChange={(e) => update(i, { endTime: e.target.value })} />
          </div>
          <div className="ops-field ops-field--wide" style={{ alignItems: "flex-end" }}>
            <Button aria-label={`Remove availability slot ${i + 1}`} size="sm" variant="secondary" onClick={() => removeSlot(i)}>
              Remove Slot
            </Button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button size="sm" variant="secondary" onClick={addSlot}>
          Add Slot
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save Availability"}
        </Button>
      </div>
      {saved && <p className="ops-success" role="status" aria-live="polite">Saved.</p>}
      {error && <p className="ops-error" role="alert">{error}</p>}
    </div>
  );
}
