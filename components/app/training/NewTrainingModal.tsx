"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button, Modal } from "@/components/ds";
import { createTrainingModule, createTrainingSession } from "@/app/actions/training";
import { COMMON_TIME_ZONES, DEFAULT_TIME_ZONE } from "@/lib/timezone";

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

export default function NewTrainingModal({ kind }: { kind: "module" | "session" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  // module fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"onboarding" | "training">("onboarding");
  const [required, setRequired] = useState(true);
  const [contentType, setContentType] = useState<"text" | "link">("text");
  const [content, setContent] = useState("");

  // session fields
  const [scheduledAt, setScheduledAt] = useState("");
  const [sessionTimeZone, setSessionTimeZone] = useState<string>(DEFAULT_TIME_ZONE);
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
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res =
        kind === "module"
          ? await createTrainingModule({ title, category, required, contentType, content })
          : await createTrainingSession({
              title,
              scheduledLocalDateTime: scheduledAt,
              timeZone: sessionTimeZone,
              location,
              meetingLink,
              required,
            });
      if (res.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setError(res.error || "Something went wrong.");
      }
    } catch {
      setError("BOW could not save this training item. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        {kind === "module" ? "New Module" : "New Session"}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={kind === "module" ? "New Module" : "New Session"}>
        <label htmlFor={`new-training-title-${kind}`} className="ops-label">Title</label>
        <input id={`new-training-title-${kind}`} className="bow-field" disabled={busy} maxLength={200} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        {kind === "module" ? (
          <>
            <label htmlFor="new-training-category" className="ops-label">Lifecycle category</label>
            <select id="new-training-category" className="bow-field" disabled={busy} style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value as "onboarding" | "training")}>
              <option value="onboarding">Onboarding</option>
              <option value="training">Training</option>
            </select>
            <label htmlFor="new-training-content-type" className="ops-label">Content type</label>
            <select id="new-training-content-type" className="bow-field" disabled={busy} style={inputStyle} value={contentType} onChange={(e) => setContentType(e.target.value as "text" | "link")}>
              <option value="text">Text</option>
              <option value="link">Link</option>
            </select>
            <label htmlFor="new-training-content" className="ops-label">Module content or secure link</label>
            <textarea id="new-training-content" className="bow-field" disabled={busy} maxLength={4000} rows={4} style={{ ...inputStyle, resize: "vertical" }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content / link" />
          </>
        ) : (
          <>
            <label htmlFor="training-session-at" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Date &amp; time</label>
            <input className="bow-field" disabled={busy} id="training-session-at" type="datetime-local" style={inputStyle} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            <label htmlFor="training-session-timezone" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Session timezone</label>
            <select className="bow-field" disabled={busy} id="training-session-timezone" style={inputStyle} value={sessionTimeZone} onChange={(event) => setSessionTimeZone(event.target.value)}>
              {COMMON_TIME_ZONES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <p style={{ margin: "-4px 0 12px", fontFamily: "var(--font-interface)", fontSize: 12, lineHeight: 1.45, color: "var(--bow-slate)" }}>
              BOW resolves this wall-clock time with the selected timezone and its daylight-saving rules.
            </p>
            <label htmlFor="new-training-location" className="ops-label">Location (optional)</label>
            <input id="new-training-location" className="bow-field" disabled={busy} maxLength={200} style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
            <label htmlFor="new-training-meeting-link" className="ops-label">Secure meeting link (optional)</label>
            <input id="new-training-meeting-link" className="bow-field" disabled={busy} maxLength={400} type="url" inputMode="url" style={inputStyle} value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://…" />
          </>
        )}
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontFamily: "var(--font-interface)", fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" disabled={busy} checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>}
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
