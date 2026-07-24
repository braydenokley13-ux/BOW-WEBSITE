"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { submitMissionUpdate } from "@/app/actions/instructor-missions";

/**
 * Instructor self-service: post progress or submit evidence on your own
 * Current Mission. Ownership is enforced server-side; this is only the form.
 */
export default function MissionUpdateForm({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"progress" | "evidence">("progress");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const result = await submitMissionUpdate(missionId, kind, body);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error ?? "Update could not be saved.");
      return;
    }
    setBody("");
    setMessage(kind === "evidence" ? "Evidence submitted." : "Progress recorded.");
    router.refresh();
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {(["progress", "evidence"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="ops-chip"
            data-tone={kind === option ? "positive" : undefined}
            aria-pressed={kind === option}
            onClick={() => setKind(option)}
            style={{ cursor: "pointer" }}
          >
            {option === "progress" ? "Progress note" : "Submit evidence"}
          </button>
        ))}
      </div>
      <div className="ops-field">
        <label htmlFor={`mission-update-${missionId}`}>
          {kind === "evidence" ? "What did you complete? (links welcome)" : "What moved forward?"}
        </label>
        <textarea
          id={`mission-update-${missionId}`}
          rows={3}
          maxLength={4000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={kind === "evidence" ? "Describe the result, add any links…" : "A short update on your mission…"}
        />
      </div>
      {message && <p role="status" className="ops-field__help" style={{ marginTop: 6 }}>{message}</p>}
      <div style={{ marginTop: 8 }}>
        <Button size="sm" variant="primary" disabled={busy || body.trim().length < 3} onClick={submit}>
          {busy ? "Saving…" : kind === "evidence" ? "Submit evidence" : "Record progress"}
        </Button>
      </div>
    </div>
  );
}
