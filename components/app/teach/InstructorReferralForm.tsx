"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { submitInstructorReferral } from "@/app/actions/instructor-growth";

/**
 * Instructor self-service: refer someone you think would be a strong BOW
 * instructor. It reaches the team as an attributed introduction — you never
 * see any applicant's private information back.
 */
export default function InstructorReferralForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const result = await submitInstructorReferral(name, note);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error ?? "Referral could not be saved.");
      return;
    }
    setName("");
    setNote("");
    setMessage("Thanks — your referral was sent to the BOW team.");
    router.refresh();
  };

  return (
    <div>
      <div className="ops-field" style={{ marginBottom: 10 }}>
        <label htmlFor="referral-name">Who would be a great instructor?</label>
        <input id="referral-name" type="text" maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Their name" />
      </div>
      <div className="ops-field" style={{ marginBottom: 10 }}>
        <label htmlFor="referral-note">Why them? (optional)</label>
        <textarea id="referral-note" rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="A sentence on why they'd be a strong fit." />
      </div>
      {message && <p role="status" className="ops-field__help" style={{ marginBottom: 8 }}>{message}</p>}
      <Button size="sm" variant="secondary" disabled={busy || name.trim().length < 2} onClick={submit}>
        {busy ? "Sending…" : "Refer an instructor"}
      </Button>
    </div>
  );
}
