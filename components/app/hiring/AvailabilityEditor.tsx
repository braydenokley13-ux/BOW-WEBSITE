"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { updateInstructorAvailability, type AvailabilitySlotInput } from "@/app/actions/instructors";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "8px 10px",
  fontFamily: "var(--font-interface)",
  fontSize: 13,
  borderRadius: 4,
};

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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {slots.length === 0 && (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>No availability set.</p>
      )}
      {slots.map((s, i) => (
        <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select aria-label={`Availability slot ${i + 1}: day`} style={inputStyle} value={s.dayOfWeek} onChange={(e) => update(i, { dayOfWeek: Number(e.target.value) })}>
            {DAY_LABELS.map((d, idx) => (
              <option key={d} value={idx}>
                {d}
              </option>
            ))}
          </select>
          <input aria-label={`Availability slot ${i + 1}: start time`} type="time" style={inputStyle} value={s.startTime} onChange={(e) => update(i, { startTime: e.target.value })} />
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>to</span>
          <input aria-label={`Availability slot ${i + 1}: end time`} type="time" style={inputStyle} value={s.endTime} onChange={(e) => update(i, { endTime: e.target.value })} />
          <input
            aria-label={`Availability slot ${i + 1}: notes`}
            style={{ ...inputStyle, flex: 1, minWidth: 120 }}
            placeholder="Notes (optional)"
            value={s.notes ?? ""}
            onChange={(e) => update(i, { notes: e.target.value })}
          />
          <Button aria-label={`Remove availability slot ${i + 1}`} size="sm" variant="secondary" onClick={() => removeSlot(i)}>
            Remove
          </Button>
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
      {saved && <p role="status" aria-live="polite" style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-positive)" }}>Saved.</p>}
      {error && <p role="alert" style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
    </div>
  );
}
