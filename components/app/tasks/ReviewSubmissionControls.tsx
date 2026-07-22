"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ds";
import { reviewWork } from "@/app/actions/people-work";

type Decision = "excellent" | "meets_standard" | "needs_revision" | "unacceptable";

export default function ReviewSubmissionControls({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<Decision>("meets_standard");
  const [feedback, setFeedback] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await reviewWork({ submissionId, decision, feedback, revisionInstructions: instructions });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "Review could not be saved.");
    setOpen(false);
    router.refresh();
  };
  return (
    <>
      <Button size="sm" variant="emphasis" onClick={() => setOpen(true)}>Review Submission</Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Review submitted Work" dismissible={!busy}>
        <div className="ops-field" style={{ marginBottom: 12 }}>
          <label htmlFor={`review-decision-${submissionId}`}>Quality decision</label>
          <select id={`review-decision-${submissionId}`} value={decision} onChange={(event) => setDecision(event.target.value as Decision)}>
            <option value="excellent">Excellent</option>
            <option value="meets_standard">Meets standard</option>
            <option value="needs_revision">Needs revision</option>
            <option value="unacceptable">Unacceptable</option>
          </select>
        </div>
        <div className="ops-field" style={{ marginBottom: 12 }}>
          <label htmlFor={`review-feedback-${submissionId}`}>Evidence-based feedback</label>
          <textarea id={`review-feedback-${submissionId}`} rows={4} maxLength={4000} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
        </div>
        {decision === "needs_revision" && (
          <div className="ops-field" style={{ marginBottom: 12 }}>
            <label htmlFor={`review-instructions-${submissionId}`}>Revision instructions</label>
            <textarea id={`review-instructions-${submissionId}`} rows={3} maxLength={2000} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
          </div>
        )}
        <p className="ops-field__help" style={{ marginBottom: 12 }}>Output is recorded on approval. Reliability comes from system dates. Impact is recorded later from linked outcomes.</p>
        {error && <p role="alert" className="ops-error">{error}</p>}
        <Button variant="primary" disabled={busy || feedback.trim().length < 5} onClick={save}>{busy ? "Saving…" : "Record review"}</Button>
      </Modal>
    </>
  );
}
