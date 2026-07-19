"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmClassEnrollment } from "@/app/actions/growth";
import { Button, Modal } from "@/components/ds";

export default function ConfirmEnrollmentButton({ enrollmentId, studentName }: { enrollmentId: string; studentName: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"student" | "guardian" | "partner" | "staff" | "imported">("guardian");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await confirmClassEnrollment({ enrollmentId, source });
      if (!result.ok) {
        setError(result.error ?? "The registration could not be confirmed.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("The registration could not be confirmed. Nothing changed; try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Confirm</Button>
      <Modal open={open} onClose={close} title={`Confirm ${studentName}`} dismissible={!busy}>
        <p className="ops-body" style={{ marginBottom: 16 }}>
          Record who explicitly confirmed this registration. This timestamp becomes immutable evidence; it is not inferred from enrollment or a page view.
        </p>
        <div className="ops-field">
          <label htmlFor={`confirmation-source-${enrollmentId}`}>Confirmation source</label>
          <select id={`confirmation-source-${enrollmentId}`} disabled={busy} value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
            <option value="student">Student</option>
            <option value="guardian">Guardian or family</option>
            <option value="partner">Partner coordinator</option>
            <option value="staff">BOW staff</option>
            <option value="imported">Verified import</option>
          </select>
        </div>
        {error && <p className="ops-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <div className="ops-form-footer">
          <Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={confirm}>{busy ? "Confirming…" : "Record Confirmation"}</Button>
        </div>
      </Modal>
    </>
  );
}
