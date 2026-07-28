"use client";

import { useId, useState } from "react";
import Modal from "@/components/ds/Modal";
import Button from "@/components/ds/Button";
import { correctContactInfo } from "@/app/actions/family-support";

/**
 * Multi-field variant of the ActionDialog pattern: current → resulting
 * values shown as editable inputs rather than a single reason field, but
 * same shell (Modal), same guarantees (focus trap/restoration, error stays
 * in the dialog, no silent Escape while dirty, double-submit blocked).
 */
export default function ContactCorrectionDialog({
  personId,
  guardianName,
  currentEmail,
  currentPhone,
}: {
  personId: string;
  guardianName: string;
  currentEmail: string | null;
  currentPhone: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descId = useId();

  const dirty = email !== (currentEmail ?? "") || phone !== (currentPhone ?? "");
  const dismissible = !pending && !dirty;

  function close() {
    if (!dismissible) return;
    setEmail(currentEmail ?? "");
    setPhone(currentPhone ?? "");
    setError(null);
    setOpen(false);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    const result = await correctContactInfo(personId, { email: email.trim() || null, phone: phone.trim() || null });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not update contact info.");
      return;
    }
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Correct contact info
      </Button>
      <Modal open={open} onClose={close} title="Correct verified contact info" dismissible={dismissible}>
        <div style={{ display: "grid", gap: 16 }} aria-describedby={descId}>
          <p id={descId} style={{ margin: 0, fontSize: 14 }}>
            Updates the email and phone BOW has on file for {guardianName}. This does not change their sign-in
            identity — a guardian who has already activated an account keeps signing in with their existing
            credentials.
          </p>
          <div>
            <label htmlFor={`${descId}-email`} style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}>
              Email
            </label>
            <input
              id={`${descId}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit" }}
            />
          </div>
          <div>
            <label htmlFor={`${descId}-phone`} style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}>
              Phone
            </label>
            <input
              id={`${descId}-phone`}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit" }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>
            Notification: none sent. Reversible — can be corrected again at any time.
          </div>
          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--bow-red, #b3261e)" }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={close}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={pending || !dirty} onClick={confirm}>
              {pending ? "Saving…" : "Save contact info"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
