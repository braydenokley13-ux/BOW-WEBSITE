"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { updateFormStatus, updateStudent } from "@/app/actions/students";

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

const FORM_STATUSES = ["missing", "submitted", "complete"];

export default function StudentDetailActions({ studentId, formStatus, communicationNotes }: { studentId: string; formStatus: string; communicationNotes: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(communicationNotes);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    if (res.ok) router.refresh();
    else setError(res.error || "Something went wrong.");
    setBusy(false);
  };

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        Form status
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        {FORM_STATUSES.map((s) => (
          <Button key={s} size="sm" variant={s === formStatus ? "primary" : "secondary"} disabled={busy || s === formStatus} onClick={() => run(() => updateFormStatus(studentId, s))}>
            {s}
          </Button>
        ))}
      </div>

      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        Communication notes
      </span>
      <textarea rows={4} style={{ ...inputStyle, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => updateStudent(studentId, { communicationNotes: notes }))}>
          {busy ? "Saving…" : "Save notes"}
        </Button>
      </div>
      {error && <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
    </div>
  );
}
