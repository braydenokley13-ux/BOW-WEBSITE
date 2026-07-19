"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { addFacilitatorNotes } from "@/app/actions/training";

const textareaStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  outline: "none",
  width: "100%",
  borderRadius: 4,
  marginBottom: 10,
  resize: "vertical" as const,
};

export default function FacilitatorNotesForm({
  sessionId,
  initialNotes,
  initialUpdatedAt,
}: {
  sessionId: string;
  initialNotes: string;
  initialUpdatedAt: number;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [version, setVersion] = useState(initialUpdatedAt);
  const inFlight = useRef(false);

  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await addFacilitatorNotes(sessionId, notes, version);
      if (res.ok) {
        if (typeof res.updatedAt === "number") setVersion(res.updatedAt);
        setStatus("Facilitator notes saved.");
        router.refresh();
      } else {
        setError(res.error || "Facilitator notes could not be saved.");
      }
    } catch {
      setError("Facilitator notes could not be confirmed. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div>
      <label htmlFor={`facilitator-notes-${sessionId}`} style={{ display: "block", marginBottom: 6, fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        Session evidence and follow-up
      </label>
      <textarea id={`facilitator-notes-${sessionId}`} rows={4} maxLength={4000} disabled={busy} style={textareaStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Capture preparation, delivery evidence, and follow-up…" />
      {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>}
      {status && <p role="status" aria-live="polite" style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-positive)" }}>{status}</p>}
      <Button size="sm" variant="secondary" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save notes"}
      </Button>
    </div>
  );
}
