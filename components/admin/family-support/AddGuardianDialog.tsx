"use client";

import { useId, useState } from "react";
import Modal from "@/components/ds/Modal";
import Button from "@/components/ds/Button";
import { addGuardianToStudent } from "@/app/actions/family-support";

export default function AddGuardianDialog({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descId = useId();

  const dirty = name.trim().length > 0 || email.trim().length > 0;
  const dismissible = !pending && !dirty;

  function reset() {
    setName("");
    setEmail("");
    setRelationship("");
    setError(null);
  }

  function close() {
    if (!dismissible) return;
    reset();
    setOpen(false);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    const result = await addGuardianToStudent(studentId, { name, email, relationship: relationship || null });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not add this guardian.");
      return;
    }
    reset();
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Add guardian
      </Button>
      <Modal open={open} onClose={close} title="Add a guardian" dismissible={dismissible}>
        <div style={{ display: "grid", gap: 16 }} aria-describedby={descId}>
          <p id={descId} style={{ margin: 0, fontSize: 14 }}>
            Links a new guardian to {studentName}. If a person with this email already exists in BOW, that record
            is reused rather than duplicated.
          </p>
          <div>
            <label htmlFor={`${descId}-name`} style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}>
              Full name
            </label>
            <input
              id={`${descId}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit" }}
            />
          </div>
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
            <label htmlFor={`${descId}-rel`} style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}>
              Relationship (optional)
            </label>
            <input
              id={`${descId}-rel`}
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="e.g. parent, grandparent, guardian"
              style={{ width: "100%", padding: 8, border: "1px solid var(--border-rule)", borderRadius: 6, fontFamily: "inherit" }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>
            Notification: none sent automatically. Reversible — the link can be removed later.
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
            <Button type="button" variant="primary" size="sm" disabled={pending || !name.trim() || !email.trim()} onClick={confirm}>
              {pending ? "Adding…" : "Add guardian"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
