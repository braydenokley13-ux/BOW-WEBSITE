"use client";

import { useId, useState } from "react";
import Modal from "@/components/ds/Modal";
import Button from "@/components/ds/Button";
import { adminPlaceInClass } from "@/app/actions/registration-admin";

/** Places a confirmed registration with no class into one of the program's live classes. */
export default function AssignClassButton({
  registrationId,
  studentName,
  classes,
}: {
  registrationId: string;
  studentName: string;
  classes: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
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
    if (!classId) {
      setError("Choose a class.");
      return;
    }
    if (!reason.trim()) {
      setError("Record why this placement is being made.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await adminPlaceInClass(registrationId, classId, reason);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not place this student in a class.");
      return;
    }
    setReason("");
    setOpen(false);
  }

  if (classes.length === 0) return null;

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Assign class
      </Button>
      <Modal open={open} onClose={close} title={`Assign class — ${studentName}`} dismissible={dismissible}>
        <div style={{ display: "grid", gap: 16 }} aria-describedby={descId}>
          <p id={descId} style={{ margin: 0, fontSize: 14 }}>
            Places this confirmed seat into one of the program&apos;s live classes.
          </p>
          <div>
            <label htmlFor={`${descId}-class`} style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}>
              Class
            </label>
            <select
              id={`${descId}-class`}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit" }}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
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
          <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>Notification: none sent automatically. Reversible.</div>
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
              {pending ? "Saving…" : "Assign class"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
