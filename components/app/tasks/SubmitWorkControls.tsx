"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ds";
import { startWork, submitWork } from "@/app/actions/people-work";

export default function SubmitWorkControls({ taskId, workflowState }: { taskId: string; workflowState: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [links, setLinks] = useState("");
  const [blockers, setBlockers] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const begin = async () => {
    setBusy(true);
    const result = await startWork(taskId);
    setBusy(false);
    setMessage(result.ok ? "Work started." : result.error ?? "Work could not be started.");
    if (result.ok) router.refresh();
  };
  const submit = async () => {
    setBusy(true);
    const result = await submitWork({ taskId, resultSummary: summary, evidenceLinks: links, blockers });
    setBusy(false);
    if (!result.ok) return setMessage(result.error ?? "Work could not be submitted.");
    setOpen(false);
    setMessage("Submitted for review.");
    router.refresh();
  };

  if (!["assigned", "in_progress", "revision_requested"].includes(workflowState)) {
    return <span className="ops-record-meta">{workflowState.replace(/_/g, " ")}</span>;
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {workflowState === "assigned" && <Button size="sm" variant="secondary" disabled={busy} onClick={begin}>Start Work</Button>}
        <Button size="sm" variant="primary" disabled={busy} onClick={() => { setMessage(null); setOpen(true); }}>
          {workflowState === "revision_requested" ? "Resubmit" : "Submit for Review"}
        </Button>
      </div>
      {message && <p role="status" className="ops-field__help" style={{ marginTop: 6 }}>{message}</p>}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={workflowState === "revision_requested" ? "Resubmit Work" : "Submit Work"} dismissible={!busy}>
        <div className="ops-field" style={{ marginBottom: 12 }}>
          <label htmlFor={`work-result-${taskId}`}>Result summary</label>
          <textarea id={`work-result-${taskId}`} required rows={4} maxLength={4000} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </div>
        <div className="ops-field" style={{ marginBottom: 12 }}>
          <label htmlFor={`work-links-${taskId}`}>Evidence links (one per line)</label>
          <textarea id={`work-links-${taskId}`} rows={3} maxLength={4000} value={links} onChange={(event) => setLinks(event.target.value)} placeholder="https://…" />
        </div>
        <div className="ops-field" style={{ marginBottom: 12 }}>
          <label htmlFor={`work-blockers-${taskId}`}>Blockers or notes</label>
          <textarea id={`work-blockers-${taskId}`} rows={2} maxLength={2000} value={blockers} onChange={(event) => setBlockers(event.target.value)} />
        </div>
        {message && <p role="alert" className="ops-error">{message}</p>}
        <Button variant="primary" disabled={busy || summary.trim().length < 10} onClick={submit}>{busy ? "Submitting…" : "Submit evidence"}</Button>
      </Modal>
    </div>
  );
}
