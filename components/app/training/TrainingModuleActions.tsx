"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button, Modal } from "@/components/ds";
import { updateTrainingModule, archiveTrainingModule } from "@/app/actions/training";
import type { TrainingModule } from "@/lib/hiring";

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

export default function TrainingModuleActions({ module }: { module: TrainingModule }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(module.title);
  const [required, setRequired] = useState(module.required);
  const [content, setContent] = useState(module.content ?? "");

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await updateTrainingModule(module.id, { title, required, content });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error || "Something went wrong.");
    }
    setBusy(false);
  };

  const archive = async () => {
    setBusy(true);
    const res = await archiveTrainingModule(module.id);
    if (res.ok) router.refresh();
    else setError(res.error || "Something went wrong.");
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={archive}>
        Archive
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit Module">
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <textarea rows={4} style={{ ...inputStyle, resize: "vertical" }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content / link" />
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "var(--font-interface)", fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        {error && <p style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>}
        <Button variant="primary" full disabled={busy || !title.trim()} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </Modal>
    </div>
  );
}
