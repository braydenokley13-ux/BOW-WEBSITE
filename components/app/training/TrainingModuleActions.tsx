"use client";

import { useRef, useState } from "react";
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
  const [version, setVersion] = useState(module.updatedAt);
  const inFlight = useRef(false);

  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await updateTrainingModule(module.id, { title, required, content, expectedUpdatedAt: version });
      if (res.ok) {
        if (typeof res.updatedAt === "number") setVersion(res.updatedAt);
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error || "The module could not be saved.");
      }
    } catch {
      setError("The module update could not be confirmed. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const archive = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await archiveTrainingModule(module.id, version);
      if (res.ok) router.refresh();
      else setError(res.error || "The module could not be archived.");
    } catch {
      setError("The archive action could not be confirmed. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
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
        <label htmlFor={`training-title-${module.id}`} className="ops-label">Module title</label>
        <input id={`training-title-${module.id}`} className="bow-field" disabled={busy} maxLength={200} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <label htmlFor={`training-content-${module.id}`} className="ops-label">Module content or secure link</label>
        <textarea id={`training-content-${module.id}`} className="bow-field" disabled={busy} maxLength={4000} rows={4} style={{ ...inputStyle, resize: "vertical" }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content / link" />
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "var(--font-interface)", fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" disabled={busy} checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>}
        <Button variant="primary" full disabled={busy || !title.trim()} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </Modal>
    </div>
  );
}
