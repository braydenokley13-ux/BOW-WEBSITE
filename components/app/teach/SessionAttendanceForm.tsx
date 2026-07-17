"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { recordAttendance, submitSessionReport } from "@/app/actions/classes";

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  outline: "none",
  width: "100%",
  borderRadius: 4,
};

interface StudentRow {
  id: string;
  name: string;
  present: boolean | null;
}

export default function SessionAttendanceForm({ sessionId, students, reportNotes }: { sessionId: string; students: StudentRow[]; reportNotes: string }) {
  const router = useRouter();
  const [attendance, setAttendance] = useState<Record<string, boolean>>(
    Object.fromEntries(students.map((s) => [s.id, s.present ?? true])),
  );
  const [notes, setNotes] = useState(reportNotes);
  const [flagged, setFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [completed, setCompleted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveAttendance = async () => {
    setBusy(true);
    setError(null);
    const res = await recordAttendance(
      sessionId,
      students.map((s) => ({ studentId: s.id, present: attendance[s.id] })),
    );
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else setError(res.error || "Something went wrong.");
    setBusy(false);
  };

  const saveReport = async () => {
    setBusy(true);
    setError(null);
    const res = await submitSessionReport(sessionId, { notes, flagged, flagReason, completed });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else setError(res.error || "Something went wrong.");
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 10 }}>
          Attendance
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {students.map((s) => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-interface)", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={attendance[s.id]}
                onChange={(e) => setAttendance((a) => ({ ...a, [s.id]: e.target.checked }))}
              />
              {s.name}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <Button size="sm" variant="secondary" disabled={busy || students.length === 0} onClick={saveAttendance}>
            {busy ? "Saving…" : "Save Attendance"}
          </Button>
        </div>
      </div>

      <div>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 10 }}>
          Session report
        </span>
        <textarea rows={4} style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-interface)", fontSize: 13, marginBottom: 8 }}>
          <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
          Session completed
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-interface)", fontSize: 13, marginBottom: 8 }}>
          <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
          Flag for staff attention
        </label>
        {flagged && (
          <input style={{ ...inputStyle, marginBottom: 10 }} placeholder="Reason" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
        )}
        <Button size="sm" variant="primary" disabled={busy} onClick={saveReport}>
          {busy ? "Saving…" : "Submit Report"}
        </Button>
      </div>

      {saved && <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-positive)" }}>Saved.</p>}
      {error && <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
    </div>
  );
}
