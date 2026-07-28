"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";
import { addSupportNote } from "@/app/actions/family-support";

/**
 * Logging a support note is not a state-changing decision about a
 * registration — it doesn't need a confirmation dialog, just a save button
 * with the same error-preservation and double-submit guarantees.
 */
export default function AddSupportNoteForm({ personId, studentId }: { personId?: string | null; studentId?: string | null }) {
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"note" | "contact" | "action" | "issue">("note");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        rows={3}
        placeholder="What happened, what was said, what's still open…"
        style={{ width: "100%", padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          style={{ padding: 6, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit", fontSize: 13 }}
        >
          <option value="note">Note</option>
          <option value="contact">Contact made</option>
          <option value="action">Action taken</option>
          <option value="issue">Open issue</option>
        </select>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending || !note.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await addSupportNote({ personId, studentId, note, kind });
              if (!result.ok) {
                setError(result.error ?? "Could not save this note.");
                return;
              }
              setNote("");
              setSaved(true);
            })
          }
        >
          {pending ? "Saving…" : saved ? "Saved" : "Save note"}
        </Button>
        {error && <span style={{ fontSize: 12, color: "var(--bow-red, #b3261e)" }}>{error}</span>}
      </div>
    </div>
  );
}
