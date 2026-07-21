"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/app/actions/tasks";
import { Button, Modal } from "@/components/ds";

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
  expectedResult: "",
  definitionOfDone: "",
  evidenceRequirement: "",
  reviewRequired: true,
  autonomyLevel: 2,
};

/** Complete manual-capture path for the universal Work queue. */
export default function CreateWorkForm({ staffUsers, defaultOwnerId, relatedRecords }: CreateWorkFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(initialFields);
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [doerId, setDoerId] = useState("");
  const [reviewerId, setReviewerId] = useState(defaultOwnerId);
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
        doerUserId: doerId || ownerId || null,
        reviewerUserId: fields.reviewRequired ? reviewerId || null : null,
        dueDate: fields.dueDate || null,
        entityType: fields.entityType || null,
        entityId: fields.entityId || null,
        handoffToFounder: fields.founderHandoff,
        expectedResult: fields.expectedResult,
        definitionOfDone: fields.definitionOfDone,
        evidenceRequirement: fields.evidenceRequirement,
        reviewRequired: fields.reviewRequired,
        autonomyLevel: fields.autonomyLevel,
      });
      if (!result.ok) {
        setError(result.error ?? "Work could not be captured.");
        return;
      }
      setFields(initialFields);
      setOwnerId(defaultOwnerId);
      setDoerId("");
      setReviewerId(defaultOwnerId);
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
        <span aria-live="polite" role="status" className="ops-field__help" style={{ color: status ? "var(--bow-positive)" : "var(--bow-slate)" }}>
          {status ?? "Create a commitment, exception, review, or founder decision."}
        </span>
      </div>

      <Modal open={open} onClose={close} title="Capture Work" maxWidth={700} dismissible={!busy}>
        <form onSubmit={submit}>
          <div className="ops-field" style={{ marginBottom: 14 }}>
            <label htmlFor="new-work-title">Outcome or commitment</label>
            <input
              id="new-work-title"
              required
              maxLength={200}
              disabled={busy}
              autoComplete="off"
              placeholder="Example: Confirm fall Program launch date with Eastside Academy"
              value={fields.title}
              onChange={(event) => setField("title", event.target.value)}
            />
          </div>

          <div className="ops-fields" style={{ marginBottom: 14 }}>
            <div className="ops-field">
              <label htmlFor="new-work-kind">Work type</label>
              <select id="new-work-kind" disabled={busy} value={fields.kind} onChange={(event) => setField("kind", event.target.value)}>
                <option value="task">Task</option>
                <option value="issue">Issue / exception</option>
                <option value="decision">Decision</option>
                <option value="follow_up">Follow-up</option>
                <option value="meeting">Meeting</option>
                <option value="review">Review</option>
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="new-work-priority">Priority</label>
              <select id="new-work-priority" disabled={busy} value={fields.priority} onChange={(event) => setField("priority", event.target.value)}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="new-work-owner">Accountable owner</label>
              <select id="new-work-owner" disabled={busy} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                <option value="">Unassigned</option>
                {staffUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="new-work-due">Due date</label>
              <input id="new-work-due" type="date" max="2100-12-31" aria-describedby="new-work-due-help" disabled={busy} value={fields.dueDate} onChange={(event) => setField("dueDate", event.target.value)} />
              <span id="new-work-due-help" className="ops-field__help">Calendar date only; changing device timezone will not change it.</span>
            </div>
          </div>

          <div className="ops-fields" style={{ marginBottom: 14 }}>
            <div className="ops-field">
              <label htmlFor="new-work-doer">Doer / assignee</label>
              <select id="new-work-doer" disabled={busy} value={doerId} onChange={(event) => setDoerId(event.target.value)}>
                <option value="">Same as accountable owner</option>
                {staffUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <span className="ops-field__help">Delegation does not remove the accountable owner.</span>
            </div>
            <div className="ops-field">
              <label htmlFor="new-work-reviewer">Reviewer</label>
              <select id="new-work-reviewer" disabled={busy || !fields.reviewRequired} value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
                <option value="">Choose reviewer</option>
                {staffUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor="new-work-autonomy">Autonomy</label>
              <select id="new-work-autonomy" disabled={busy} value={fields.autonomyLevel} onChange={(event) => setField("autonomyLevel", Number(event.target.value))}>
                <option value={1}>Directed</option>
                <option value={2}>Guided</option>
                <option value={3}>Owner</option>
                <option value={4}>Lead</option>
              </select>
            </div>
          </div>

          <div className="ops-field" style={{ marginBottom: 14 }}>
            <label htmlFor="new-work-result">Expected result</label>
            <textarea id="new-work-result" required rows={2} maxLength={2000} disabled={busy} value={fields.expectedResult} onChange={(event) => setField("expectedResult", event.target.value)} placeholder="What measurable result should exist?" />
          </div>
          <div className="ops-field" style={{ marginBottom: 14 }}>
            <label htmlFor="new-work-done">Definition of done</label>
            <textarea id="new-work-done" required rows={2} maxLength={2000} disabled={busy} value={fields.definitionOfDone} onChange={(event) => setField("definitionOfDone", event.target.value)} placeholder="What must be true for approval?" />
          </div>
          <div className="ops-field" style={{ marginBottom: 14 }}>
            <label htmlFor="new-work-evidence">Evidence requirement</label>
            <textarea id="new-work-evidence" rows={2} maxLength={2000} disabled={busy} value={fields.evidenceRequirement} onChange={(event) => setField("evidenceRequirement", event.target.value)} placeholder="Links, artifacts, or outcome evidence expected with submission." />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <input type="checkbox" checked={fields.reviewRequired} onChange={(event) => setField("reviewRequired", event.target.checked)} />
            Require submission and approval before this Work is done
          </label>

          <div className="ops-field" style={{ marginBottom: 14 }}>
            <label htmlFor="new-work-context">Operating context</label>
            <textarea
              id="new-work-context"
              rows={3}
              maxLength={2000}
              disabled={busy}
              placeholder="Why does this matter, what changed, and what constraint should the owner know?"
              value={fields.context}
              onChange={(event) => setField("context", event.target.value)}
            />
          </div>

          <div className="ops-field" style={{ marginBottom: 14 }}>
            <label htmlFor="new-work-action">Recommended next action</label>
            <textarea
              id="new-work-action"
              rows={2}
              maxLength={1000}
              disabled={busy}
              placeholder="State the next concrete move so the owner can act without rediscovery."
              value={fields.recommendedAction}
              onChange={(event) => setField("recommendedAction", event.target.value)}
            />
          </div>

          <fieldset style={{ border: "1px solid var(--border-rule)", borderRadius: 4, padding: 12, margin: "0 0 14px" }}>
            <legend className="ops-field__label" style={{ padding: "0 5px", margin: 0 }}>Related operating record (optional)</legend>
            <div className="ops-fields">
              <div className="ops-field">
                <label htmlFor="new-work-entity-type">Record type</label>
                <select
                  id="new-work-entity-type"
                  disabled={busy}
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
              <div className="ops-field">
                <label htmlFor="new-work-entity-id">Related record</label>
                <select
                  id="new-work-entity-id"
                  disabled={busy || !fields.entityType}
                  required={Boolean(fields.entityType)}
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
            <p className="ops-field__help" style={{ marginTop: 8 }}>
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

          {error && <p role="alert" className="ops-error" style={{ margin: "0 0 12px" }}>{error}</p>}
          <div className="ops-form-footer" style={{ paddingTop: 0, border: 0 }}>
            <Button type="submit" variant="primary" disabled={busy || !fields.title.trim()}>
              {busy ? "Capturing…" : "Add to Work"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
