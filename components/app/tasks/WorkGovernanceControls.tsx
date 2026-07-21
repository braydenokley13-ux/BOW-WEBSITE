"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ds";
import { cancelWork, changeWorkDueDate } from "@/app/actions/people-work";

export default function WorkGovernanceControls({ taskId, currentDueOn }: { taskId: string; currentDueOn: string | null }) {
  const router = useRouter();
  const [modal, setModal] = useState<"due" | "cancel" | null>(null);
  const [dueOn, setDueOn] = useState(currentDueOn ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true); setError(null); const result = await action(); setBusy(false);
    if (!result.ok) return setError(result.error ?? "Work could not be updated.");
    setModal(null); setReason(""); router.refresh();
  };
  return <>
    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}><Button size="sm" variant="ghost" onClick={() => setModal("due")}>Change due date</Button><Button size="sm" variant="ghost" onClick={() => setModal("cancel")}>Cancel Work</Button></div>
    <Modal open={modal === "due"} onClose={() => !busy && setModal(null)} title="Change committed date" dismissible={!busy}><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor={`governance-date-${taskId}`}>New due date</label><input id={`governance-date-${taskId}`} type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></div><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor={`governance-reason-${taskId}`}>Reason for change</label><textarea id={`governance-reason-${taskId}`} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></div>{error && <p className="ops-error">{error}</p>}<Button variant="primary" disabled={busy || !dueOn || reason.trim().length < 5} onClick={() => run(() => changeWorkDueDate(taskId, dueOn, reason))}>Record Date Change</Button></Modal>
    <Modal open={modal === "cancel"} onClose={() => !busy && setModal(null)} title="Cancel Work" dismissible={!busy}><p className="ops-body" style={{ marginBottom: 12 }}>Cancellation means BOW no longer needs this Work. It is not a failed submission.</p><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor={`cancel-reason-${taskId}`}>Reason</label><textarea id={`cancel-reason-${taskId}`} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></div>{error && <p className="ops-error">{error}</p>}<Button variant="secondary" disabled={busy || reason.trim().length < 5} onClick={() => run(() => cancelWork(taskId, reason))}>Confirm Cancellation</Button></Modal>
  </>;
}
