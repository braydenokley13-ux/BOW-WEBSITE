"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button, Modal } from "@/components/ds";
import { createTrainingModule, createTrainingSession } from "@/app/actions/training";

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

export default function NewTrainingModal({ kind }: { kind: "module" | "session" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // module fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"onboarding" | "training">("onboarding");
  const [required, setRequired] = useState(true);
  const [contentType, setContentType] = useState<"text" | "link">("text");
  const [content, setContent] = useState("");

  // session fields
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  const reset = () => {
    setTitle("");
    setContent("");
    setScheduledAt("");
    setLocation("");
    setMeetingLink("");
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res =
      kind === "module"
        ? await createTrainingModule({ title, category, required, contentType, content })
        : await createTrainingSession({ title, scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : NaN, location, meetingLink, required });
    if (res.ok) {
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setError(res.error || "Something went wrong.");
    }
    setBusy(false);
  };

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        {kind === "module" ? "New Module" : "New Session"}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={kind === "module" ? "New Module" : "New Session"}>
        <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        {kind === "module" ? (
          <>
            <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value as "onboarding" | "training")}>
              <option value="onboarding">Onboarding</option>
              <option value="training">Training</option>
            </select>
            <select style={inputStyle} value={contentType} onChange={(e) => setContentType(e.target.value as "text" | "link")}>
              <option value="text">Text</option>
              <option value="link">Link</option>
            </select>
            <textarea rows={4} style={{ ...inputStyle, resize: "vertical" }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content / link" />
          </>
        ) : (
          <>
            <label style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Date &amp; time</label>
            <input type="datetime-local" style={inputStyle} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" />
            <input style={inputStyle} value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="Meeting link (optional)" />
          </>
        )}
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "var(--font-interface)", fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        {error && <p style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>}
        <Button
          variant="primary"
          full
          disabled={busy || !title.trim() || (kind === "session" && !scheduledAt)}
          onClick={submit}
        >
          {busy ? "Saving…" : "Create"}
        </Button>
      </Modal>
    </>
  );
}
