"use client";

import { useId, useState } from "react";
import Modal from "@/components/ds/Modal";
import Button from "@/components/ds/Button";
import { adminExtendReservation } from "@/app/actions/registration-admin";

/** Extends a reserved seat's deadline by a number of hours — same engine call the enrollment board uses. */
export default function ExtendReservationButton({ registrationId, studentName }: { registrationId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("24");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descId = useId();

  const dismissible = !pending && !reason.trim();

  function close() {
    if (!dismissible) return;
    setReason("");
    setError(null);
    setOpen(false);
  }

  async function confirm() {
    const n = Number(hours);
    if (!reason.trim()) {
      setError("Record why the reservation is being extended.");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a positive number of hours.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await adminExtendReservation(registrationId, n, reason);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not extend the reservation.");
      return;
    }
    setReason("");
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Extend reservation
      </Button>
      <Modal open={open} onClose={close} title={`Extend reservation — ${studentName}`} dismissible={dismissible}>
        <div style={{ display: "grid", gap: 16 }} aria-describedby={descId}>
          <p id={descId} style={{ margin: 0, fontSize: 14 }}>
            Pushes back the seat-release deadline so this family has more time to finish requirements.
          </p>
          <div>
            <label htmlFor={`${descId}-hours`} style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}>
              Additional hours
            </label>
            <input
              id={`${descId}-hours`}
              type="number"
              min={1}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit" }}
            />
          </div>
          <div>
            <label htmlFor={`${descId}-reason`} style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}>
              Reason (recorded on the audit trail)
            </label>
            <textarea
              id={`${descId}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit", fontSize: 14 }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>Notification: none sent. Reversible — can be extended again.</div>
          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--bow-red, #b3261e)" }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={close}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={pending} onClick={confirm}>
              {pending ? "Saving…" : "Extend reservation"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
