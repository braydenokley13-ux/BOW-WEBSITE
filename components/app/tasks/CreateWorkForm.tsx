"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/app/actions/tasks";
import { Button, Modal } from "@/components/ds";

const fieldStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  width: "100%",
  borderRadius: 4,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
};

const helperStyle: CSSProperties = {
  margin: "5px 0 0",
  fontFamily: "var(--font-interface)",
  fontSize: 12,
  lineHeight: 1.4,
  color: "var(--bow-slate)",
};

interface CreateWorkFormProps {
  staffUsers: { id: string; name: string }[];
  defaultOwnerId: string;
  relatedRecords: Record<string, { id: string; label: string }[]>;
}

const initialFields = {
  title: "",
  kind: "task",
  priority: "normal",
  context: "",
  recommendedAction: "",
  dueDate: "",
  entityType: "",
  entityId: "",
  founderHandoff: false,
};

/** Complete manual-capture path for the universal Work queue. */
export default function CreateWorkForm({ staffUsers, defaultOwnerId, relatedRecords }: CreateWorkFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(initialFields);
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const availableRelatedRecords = fields.entityType ? relatedRecords[fields.entityType] ?? [] : [];

  const setField = <K extends keyof typeof initialFields>(key: K, value: (typeof initialFields)[K]) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const close = () => {
    if (busy) return;
    setError(null);
    setOpen(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await createTask({
        title: fields.title,
        kind: fields.kind,
        priority: fields.priority,
        context: fields.context,
        recommendedAction: fields.recommendedAction,
        ownerUserId: ownerId || null,
        dueDate: fields.dueDate || null,
        entityType: fields.entityType || null,
        entityId: fields.entityId || null,
        handoffToFounder: fields.founderHandoff,
      });
      if (!result.ok) {
        setError(result.error ?? "Work could not be captured.");
        return;
      }
      setFields(initialFields);
      setOwnerId(defaultOwnerId);
      setOpen(false);
      setStatus("Work captured and added to the queue.");
      router.refresh();
    } catch {
      setError("Work could not be captured. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Button variant="primary" onClick={() => { setError(null); setStatus(null); setOpen(true); }}>
          Capture Work
        </Button>
        <span aria-live="polite" role="status" style={{ ...helperStyle, margin: 0, color: status ? "var(--bow-positive)" : "var(--bow-slate)" }}>
          {status ?? "Create a commitment, exception, review, or founder decision."}
        </span>
      </div>

      <Modal open={open} onClose={close} title="Capture Work" maxWidth={700} dismissible={!busy}>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="new-work-title" style={labelStyle}>Outcome or commitment</label>
            <input
              id="new-work-title"
              required
              maxLength={200}
              disabled={busy}
              autoComplete="off"
              placeholder="Example: Confirm fall Program launch date with Eastside Academy"
              style={fieldStyle}
              value={fields.title}
              onChange={(event) => setField("title", event.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div>
              <label htmlFor="new-work-kind" style={labelStyle}>Work type</label>
              <select id="new-work-kind" disabled={busy} style={fieldStyle} value={fields.kind} onChange={(event) => setField("kind", event.target.value)}>
                <option value="task">Task</option>
                <option value="issue">Issue / exception</option>
                <option value="decision">Decision</option>
                <option value="follow_up">Follow-up</option>
                <option value="meeting">Meeting</option>
                <option value="review">Review</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-work-priority" style={labelStyle}>Priority</label>
              <select id="new-work-priority" disabled={busy} style={fieldStyle} value={fields.priority} onChange={(event) => setField("priority", event.target.value)}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-work-owner" style={labelStyle}>Accountable owner</label>
              <select id="new-work-owner" disabled={busy} style={fieldStyle} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                <option value="">Unassigned</option>
                {staffUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="new-work-due" style={labelStyle}>Due date</label>
              <input id="new-work-due" type="date" max="2100-12-31" aria-describedby="new-work-due-help" disabled={busy} style={fieldStyle} value={fields.dueDate} onChange={(event) => setField("dueDate", event.target.value)} />
              <span id="new-work-due-help" style={helperStyle}>Calendar date only; changing device timezone will not change it.</span>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="new-work-context" style={labelStyle}>Operating context</label>
            <textarea
              id="new-work-context"
              rows={3}
              maxLength={2000}
              disabled={busy}
              placeholder="Why does this matter, what changed, and what constraint should the owner know?"
              style={{ ...fieldStyle, resize: "vertical" }}
              value={fields.context}
              onChange={(event) => setField("context", event.target.value)}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="new-work-action" style={labelStyle}>Recommended next action</label>
            <textarea
              id="new-work-action"
              rows={2}
              maxLength={1000}
              disabled={busy}
              placeholder="State the next concrete move so the owner can act without rediscovery."
              style={{ ...fieldStyle, resize: "vertical" }}
              value={fields.recommendedAction}
              onChange={(event) => setField("recommendedAction", event.target.value)}
            />
          </div>

          <fieldset style={{ border: "1px solid var(--border-rule)", borderRadius: 4, padding: 12, margin: "0 0 14px" }}>
            <legend style={{ ...labelStyle, padding: "0 5px", margin: 0 }}>Related operating record (optional)</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <div>
                <label htmlFor="new-work-entity-type" style={labelStyle}>Record type</label>
                <select
                  id="new-work-entity-type"
                  disabled={busy}
                  style={fieldStyle}
                  value={fields.entityType}
                  onChange={(event) => setFields((current) => ({ ...current, entityType: event.target.value, entityId: "" }))}
                >
                  <option value="">No related record</option>
                  <option value="program">Program</option>
                  <option value="class">Class</option>
                  <option value="instructor">Instructor</option>
                  <option value="student">Student</option>
                  <option value="organization">Partner organization</option>
                  <option value="location">Location</option>
                  <option value="region">Region</option>
                </select>
              </div>
              <div>
                <label htmlFor="new-work-entity-id" style={labelStyle}>Related record</label>
                <select
                  id="new-work-entity-id"
                  disabled={busy || !fields.entityType}
                  required={Boolean(fields.entityType)}
                  style={fieldStyle}
                  value={fields.entityId}
                  onChange={(event) => setField("entityId", event.target.value)}
                >
                  <option value="">{fields.entityType ? `Choose a ${fields.entityType.replace(/_/g, " ")} record` : "Choose a record type first"}</option>
                  {availableRelatedRecords.map((record) => (
                    <option key={record.id} value={record.id}>{record.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p style={helperStyle}>
              {fields.entityType && availableRelatedRecords.length === 0
                ? "No available record matches this type yet. Create the operating record first, then connect Work to it."
                : "Choose by operating name; BOW keeps the underlying record connection private and verifies it before saving."}
            </p>
          </fieldset>

          <label htmlFor="new-work-founder" style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 16, cursor: busy ? "not-allowed" : "pointer" }}>
            <input
              id="new-work-founder"
              type="checkbox"
              disabled={busy}
              checked={fields.founderHandoff}
              onChange={(event) => setField("founderHandoff", event.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.45, color: "var(--bow-ink)" }}>
              <strong>Founder decision required.</strong> Only an admin can reassign or complete this Work item.
            </span>
          </label>

          {error && <p role="alert" style={{ margin: "0 0 12px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-negative)" }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" disabled={busy || !fields.title.trim()}>
              {busy ? "Capturing…" : "Add to Work"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
