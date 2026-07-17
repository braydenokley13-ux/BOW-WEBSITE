"use client";

import { useState } from "react";
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

export default function FacilitatorNotesForm({ sessionId, initialNotes }: { sessionId: string; initialNotes: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await addFacilitatorNotes(sessionId, notes);
    if (res.ok) router.refresh();
    else setError(res.error || "Something went wrong.");
    setBusy(false);
  };

  return (
    <div>
      <textarea rows={4} style={textareaStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Facilitator notes…" />
      {error && <p style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>}
      <Button size="sm" variant="secondary" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save notes"}
      </Button>
    </div>
  );
}
