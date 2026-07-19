"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button, Modal } from "@/components/ds";
import { completeTask, reassignTask } from "@/app/actions/tasks";

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  width: "100%",
  borderRadius: 4,
  marginBottom: 12,
};

export default function TaskRowActions({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "complete" | "reassign">(null);
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "The task could not be updated.");
        return;
      }
      setModal(null);
      setNote("");
      setOwner("");
      router.refresh();
    } catch {
      setError("The task could not be updated. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setError(null); setModal("reassign"); }}>Reassign</Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => { setError(null); setModal("complete"); }}>Complete</Button>
      </div>

      <Modal open={modal === "complete"} onClose={() => setModal(null)} title="Complete Task" dismissible={!busy}>
        <label htmlFor={`task-completion-note-${taskId}`} style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Completion note (optional)</label>
        <textarea id={`task-completion-note-${taskId}`} disabled={busy} placeholder="What was completed?" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p role="alert" style={{ margin: "0 0 10px", fontFamily: "var(--font-interface)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
        <Button variant="primary" size="sm" disabled={busy} onClick={() => run(() => completeTask(taskId, note))}>
          {busy ? "Saving…" : "Mark Complete"}
        </Button>
      </Modal>

      <Modal open={modal === "reassign"} onClose={() => setModal(null)} title="Reassign Task" dismissible={!busy}>
        <label htmlFor={`task-owner-${taskId}`} style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Owner user ID</label>
        <input id={`task-owner-${taskId}`} disabled={busy} placeholder="Example: u-admin" style={inputStyle} value={owner} onChange={(e) => setOwner(e.target.value)} />
        {error && <p role="alert" style={{ margin: "0 0 10px", fontFamily: "var(--font-interface)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
        <Button variant="primary" size="sm" disabled={busy || !owner} onClick={() => run(() => reassignTask(taskId, owner))}>
          {busy ? "Saving…" : "Reassign"}
        </Button>
      </Modal>
    </>
  );
}
