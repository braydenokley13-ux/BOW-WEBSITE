"use client";

import { useId, useState } from "react";
import Modal from "@/components/ds/Modal";
import Button from "@/components/ds/Button";
import { transferToProgram, type TransferTarget } from "@/app/actions/family-support";

/**
 * Review-and-confirm dialog for moving a child between programs.
 *
 * A transfer changes two registrations and two classes' capacity, so the
 * dialog has to state the resulting position before the click, not after.
 * The seat counts shown here come from the page render and can go stale — the
 * copy says so rather than implying a guarantee, because `transferProgram`
 * re-counts under the class lock and will land the child on the destination
 * waitlist if the last seat went in the meantime. Saying "confirmed seat" here
 * and delivering a waitlist place is exactly the mistake this wording avoids.
 */
export default function TransferProgramDialog({
  registrationId,
  studentName,
  currentProgramName,
  currentStatusLabel,
  targets,
}: {
  registrationId: string;
  studentName: string;
  currentProgramName: string;
  currentStatusLabel: string;
  targets: TransferTarget[];
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descId = useId();

  const dirty = targetId !== "" || reason !== "";
  const dismissible = !pending && !dirty;
  const target = targets.find((t) => t.id === targetId) ?? null;

  // What the family will actually get, as far as this render can tell.
  const landing =
    target == null
      ? null
      : target.remaining == null || target.remaining > 0
        ? "a seat in the destination program"
        : target.waitlistMode === "disabled"
          ? "nothing — the destination is full and has no waitlist, so the transfer will be refused and the current place kept"
          : "a place on the destination waitlist, because the destination is currently full";

  function close() {
    if (!dismissible) return;
    setTargetId("");
    setReason("");
    setError(null);
    setOpen(false);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    const result = await transferToProgram(registrationId, targetId, reason);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not transfer this registration.");
      return;
    }
    setTargetId("");
    setReason("");
    setOpen(false);
  }

  const fieldStyle = {
    width: "100%",
    padding: 8,
    border: "1px solid var(--border-rule)",
    borderRadius: 6,
    fontFamily: "inherit",
    fontSize: 14,
  } as const;

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Transfer to another program
      </Button>
      <Modal open={open} onClose={close} title={`Transfer ${studentName} to another program`} dismissible={dismissible}>
        <div style={{ display: "grid", gap: 16 }} aria-describedby={descId}>
          <p id={descId} style={{ margin: 0, fontSize: 14 }}>
            Moves {studentName} out of {currentProgramName} and into the program you choose, in one step. The new
            place is taken first — if it cannot be taken, nothing changes and the current place is kept.
          </p>

          <dl style={{ margin: 0, display: "grid", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <dt style={{ color: "var(--bow-slate)", minWidth: 130 }}>Child</dt>
              <dd style={{ margin: 0 }}>{studentName}</dd>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <dt style={{ color: "var(--bow-slate)", minWidth: 130 }}>Leaving</dt>
              <dd style={{ margin: 0 }}>
                {currentProgramName} ({currentStatusLabel})
              </dd>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <dt style={{ color: "var(--bow-slate)", minWidth: 130 }}>Current place becomes</dt>
              <dd style={{ margin: 0 }}>Withdrawn — transferred out. The seat is released to the next family.</dd>
            </div>
            {target && (
              <div style={{ display: "flex", gap: 8 }}>
                <dt style={{ color: "var(--bow-slate)", minWidth: 130 }}>Expected result</dt>
                <dd style={{ margin: 0 }}>
                  {landing}
                  {target.remaining != null && (
                    <span style={{ color: "var(--bow-slate)" }}>
                      {" "}
                      ({target.remaining} seat{target.remaining === 1 ? "" : "s"} free at last check — re-checked when
                      you confirm)
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>

          <div>
            <label
              htmlFor={`${descId}-target`}
              style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}
            >
              Destination program
            </label>
            <select
              id={`${descId}-target`}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              style={fieldStyle}
            >
              <option value="">Choose a program…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.remaining == null ? " — unlimited" : ` — ${t.remaining} free`}
                </option>
              ))}
            </select>
            {targets.length === 0 && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--bow-slate)" }}>
                No other program is currently open or upcoming, so there is nowhere to transfer to.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor={`${descId}-reason`}
              style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}
            >
              Reason (recorded in the audit history)
            </label>
            <textarea
              id={`${descId}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why is this child being moved?"
              style={fieldStyle}
            />
          </div>

          <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>
            Notification: one email to the guardian naming both programs and the resulting status. Not reversible in
            one step — moving back is another transfer, and the original seat may be gone by then.
          </div>

          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--bow-red, #b3261e)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pending || !targetId || !reason.trim()}
              onClick={confirm}
            >
              {pending ? "Transferring…" : "Transfer child"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
