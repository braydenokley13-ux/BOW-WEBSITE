"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { respondToAssignment } from "@/app/actions/delivery";

/** Accept / Decline controls for one proposed assignment. Decline reveals an optional reason before confirming. */
export default function AssignmentResponse({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");

  const respond = async (decision: "accept" | "decline") => {
    setBusy(true);
    setError(null);
    try {
      const res = await respondToAssignment(assignmentId, decision, note || undefined);
      if (res.ok) {
        setDeclining(false);
        router.refresh();
      } else {
        setError(res.error || "That response could not be recorded.");
      }
    } catch {
      setError("That response could not be recorded. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => respond("accept")}>
          {busy ? "Working…" : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => (declining ? respond("decline") : setDeclining(true))}
        >
          {declining ? (busy ? "Working…" : "Confirm decline") : "Decline"}
        </Button>
        {declining && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setDeclining(false); setNote(""); }}>
            Cancel
          </Button>
        )}
      </div>
      {declining && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — why you're declining (helps BOW find coverage)"
          rows={2}
          style={{
            width: "100%",
            border: "1px solid var(--border-rule)",
            borderRadius: "var(--radius-control)",
            padding: "8px 10px",
            fontFamily: "var(--font-interface)",
            fontSize: 13,
            resize: "vertical",
          }}
        />
      )}
      {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", margin: 0 }}>{error}</p>}
    </div>
  );
}
