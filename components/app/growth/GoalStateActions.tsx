"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { closeOperatingGoal } from "@/app/actions/growth";
import { Button, Modal } from "@/components/ds";

interface Props {
  goalId: string;
  goalLabel: string;
  expectedUpdatedAt: number;
}

export default function GoalStateActions({ goalId, goalLabel, expectedUpdatedAt }: Props) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"close" | "cancel">("close");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setMode("close");
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await closeOperatingGoal({
        id: goalId,
        expectedUpdatedAt,
        mode,
        decisionNote: String(form.get("decisionNote") ?? ""),
      });
      if (!result.ok) {
        setError(result.error ?? "BOW could not close this goal.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("BOW could not close this goal. Nothing changed; try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setMode("close");
          setError(null);
          setOpen(true);
        }}
      >
        Close goal
      </Button>
      <Modal open={open} onClose={close} title={`Close ${goalLabel}`} maxWidth={560} dismissible={!busy}>
        <form className="ops-form" onSubmit={submit}>
          <fieldset className="ops-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="ops-field ops-field--wide">
              <label htmlFor={`goal-close-mode-${goalId}`}>Decision</label>
              <select
                id={`goal-close-mode-${goalId}`}
                value={mode}
                onChange={(event) => setMode(event.target.value as "close" | "cancel")}
              >
                <option value="close">Close with achieved / missed result</option>
                <option value="cancel">Cancel the goal</option>
              </select>
              <span className="ops-field__help">
                BOW derives the result from canonical evidence. Closing cannot turn a missed target into an achieved one.
              </span>
            </div>
            <div className="ops-field ops-field--wide">
              <label htmlFor={`goal-close-note-${goalId}`}>
                {mode === "cancel" ? "Cancellation reason" : "Decision and reusable learning"}
              </label>
              <textarea
                id={`goal-close-note-${goalId}`}
                name="decisionNote"
                required
                minLength={10}
                maxLength={2000}
                rows={5}
              />
            </div>
          </fieldset>
          {error && <p className="ops-error" role="alert">{error}</p>}
          <div className="ops-form-footer">
            <Button variant="secondary" disabled={busy} onClick={close}>Keep open</Button>
            <Button type="submit" disabled={busy}>{busy ? "Closing…" : mode === "cancel" ? "Cancel Goal" : "Close Goal"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
