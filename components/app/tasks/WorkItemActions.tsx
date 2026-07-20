"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeTask, reassignTask } from "@/app/actions/tasks";
import { Button, Modal } from "@/components/ds";
import OutcomeControls from "@/components/app/tasks/OutcomeControls";

interface WorkItemActionsProps {
  taskId: string;
  currentOwnerId: string | null;
  staffUsers: { id: string; name: string }[];
  founderHandoff: boolean;
  canManageFounderWork: boolean;
}

/** Named-owner controls for the universal Work queue. */
export default function WorkItemActions({
  taskId,
  currentOwnerId,
  staffUsers,
  founderHandoff,
  canManageFounderWork,
}: WorkItemActionsProps) {
  const router = useRouter();
  const [modal, setModal] = useState<"complete" | "owner" | "outcome" | null>(null);
  const [ownerId, setOwnerId] = useState(currentOwnerId ?? "");
  const [completionNote, setCompletionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const currentOwnerIsAvailable = !currentOwnerId || staffUsers.some((user) => user.id === currentOwnerId);

  const close = () => {
    if (busy) return;
    setError(null);
    setModal(null);
  };

  const run = async (action: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "This Work item could not be updated.");
        return;
      }
      setModal(null);
      setCompletionNote("");
      setStatus(successMessage);
      router.refresh();
    } catch {
      setError("This Work item could not be updated. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (founderHandoff && !canManageFounderWork) {
    return (
      <p style={{ margin: 0, maxWidth: 180, fontFamily: "var(--font-interface)", fontSize: 12.5, lineHeight: 1.4, color: "var(--bow-slate)", textAlign: "right" }}>
        Admin action required to protect the founder-decision boundary.
      </p>
    );
  }

  return (
    <>
      <span aria-live="polite" role="status" style={{ display: "block", marginBottom: status ? 6 : 0, fontFamily: "var(--font-interface)", fontSize: 12, color: "var(--bow-positive)", textAlign: "right" }}>
        {status}
      </span>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setError(null); setOwnerId(currentOwnerId ?? ""); setModal("owner"); }}>
          Change owner
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => { setError(null); setModal("outcome"); }}>
          Record outcome
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setError(null); setModal("complete"); }}>
          Complete
        </Button>
      </div>

      <Modal open={modal === "complete"} onClose={close} title="Complete Work" dismissible={!busy}>
        <div className="ops-field" style={{ marginBottom: 12 }}>
          <label htmlFor={`work-note-${taskId}`}>Completion note (optional)</label>
          <textarea
            id={`work-note-${taskId}`}
            disabled={busy}
            rows={3}
            maxLength={2000}
            placeholder="What changed, and is any follow-up still needed?"
            value={completionNote}
            onChange={(event) => setCompletionNote(event.target.value)}
          />
        </div>
        {error && <p role="alert" className="ops-error" style={{ margin: "0 0 12px" }}>{error}</p>}
        <Button variant="primary" size="sm" disabled={busy} onClick={() => run(() => completeTask(taskId, completionNote), "Work completed.")}>
          {busy ? "Saving…" : "Confirm complete"}
        </Button>
      </Modal>

      <Modal open={modal === "owner"} onClose={close} title="Set accountable owner" dismissible={!busy}>
        <div className="ops-field" style={{ marginBottom: 6 }}>
          <label htmlFor={`work-owner-${taskId}`}>BOW owner</label>
          <select
            id={`work-owner-${taskId}`}
            disabled={busy}
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {currentOwnerId && !currentOwnerIsAvailable && (
              <option value={currentOwnerId}>Current owner (account unavailable)</option>
            )}
            {staffUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
        <p className="ops-field__help" style={{ margin: "0 0 12px" }}>
          Ownership means this person is accountable for moving the item to a clear outcome.
        </p>
        {error && <p role="alert" className="ops-error" style={{ margin: "0 0 12px" }}>{error}</p>}
        <Button
          variant="primary"
          size="sm"
          disabled={busy || ownerId === (currentOwnerId ?? "")}
          onClick={() => run(() => reassignTask(taskId, ownerId), ownerId ? "Owner updated." : "Work marked unassigned.")}
        >
          {busy ? "Saving…" : ownerId ? "Assign owner" : "Mark unassigned"}
        </Button>
      </Modal>
      <Modal open={modal === "outcome"} onClose={close} title="Record outcome" dismissible={!busy}>
        <OutcomeControls taskId={taskId} onDone={() => setModal(null)} />
      </Modal>
</>
  );
}
