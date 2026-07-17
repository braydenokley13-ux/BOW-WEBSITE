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
  outline: "none",
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

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    await fn();
    setModal(null);
    setBusy(false);
    router.refresh();
  };

  return (
    <>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <Button size="sm" variant="secondary" onClick={() => setModal("reassign")}>Reassign</Button>
        <Button size="sm" variant="primary" onClick={() => setModal("complete")}>Complete</Button>
      </div>

      <Modal open={modal === "complete"} onClose={() => setModal(null)} title="Complete Task">
        <textarea placeholder="Completion note (optional)" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button variant="primary" size="sm" disabled={busy} onClick={() => run(() => completeTask(taskId, note))}>
          {busy ? "Saving…" : "Mark Complete"}
        </Button>
      </Modal>

      <Modal open={modal === "reassign"} onClose={() => setModal(null)} title="Reassign Task">
        <input placeholder="Owner user id" style={inputStyle} value={owner} onChange={(e) => setOwner(e.target.value)} />
        <Button variant="primary" size="sm" disabled={busy || !owner} onClick={() => run(() => reassignTask(taskId, owner))}>
          {busy ? "Saving…" : "Reassign"}
        </Button>
      </Modal>
    </>
  );
}
