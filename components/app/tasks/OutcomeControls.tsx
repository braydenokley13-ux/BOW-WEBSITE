"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordTaskOutcome } from "@/app/actions/flywheel";
import { Button } from "@/components/ds";
import { TASK_OUTCOMES } from "@/lib/flywheel-shared";

/**
 * Structured outcome recorder for a growth Work item. Picking an outcome
 * tells the system what actually happened; the deterministic follow-up rule
 * (shown before submitting) creates the next step automatically.
 */
export default function OutcomeControls({ taskId, onDone }: { taskId: string; onDone?: () => void }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [selected, setSelected] = useState<(typeof TASK_OUTCOMES)[number] | null>(null);
  const [note, setNote] = useState("");
  const [followUpOn, setFollowUpOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await recordTaskOutcome({
        taskId,
        outcome: selected.key,
        note,
        followUpOn: selected.needsDate ? followUpOn : null,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not record the outcome.");
        return;
      }
      setSelected(null);
      setNote("");
      setFollowUpOn("");
      onDone?.();
      router.refresh();
    } catch {
      setError("Could not record the outcome. Nothing changed; try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {error && <p className="ops-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {TASK_OUTCOMES.map((outcome) => (
          <button
            key={outcome.key}
            type="button"
            className="ops-chip"
            data-tone={selected?.key === outcome.key ? "positive" : undefined}
            style={{ cursor: "pointer", background: selected?.key === outcome.key ? "var(--bow-positive-tint)" : "transparent" }}
            onClick={() => setSelected(selected?.key === outcome.key ? null : outcome)}
          >
            {outcome.label}
          </button>
        ))}
      </div>
      {selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <p className="ops-field__help" style={{ margin: 0 }}>{selected.next}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            {selected.needsDate && (
              <input
                type="date"
                aria-label="Follow-up date"
                className="bow-field"
                value={followUpOn}
                onChange={(event) => setFollowUpOn(event.currentTarget.value)}
                style={{ minHeight: 34, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "4px 8px", fontFamily: "var(--font-interface)", fontSize: 13 }}
              />
            )}
            <input
              aria-label="Outcome note"
              placeholder="What happened? (optional)"
              className="bow-field"
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              style={{ flex: "1 1 180px", minHeight: 34, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "4px 8px", fontFamily: "var(--font-interface)", fontSize: 13 }}
            />
            <Button size="sm" variant="primary" disabled={busy || (selected.needsDate && !followUpOn)} onClick={submit}>
              {busy ? "Saving…" : `Record: ${selected.label}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
