"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ds";
import {
  MISSION_AREAS,
  MISSION_CADENCES,
  MISSION_COMPLETION_OUTCOMES,
} from "@/lib/instructor-missions-shared";
import {
  assignInstructorMission,
  completeInstructorMission,
  cancelInstructorMission,
  addMissionFeedback,
} from "@/app/actions/instructor-missions";

interface RelatedOption {
  value: string; // "type:id"
  label: string;
}

/**
 * Staff-side controls for an instructor's Current Mission: assign one when
 * there is none, or give feedback / complete / cancel the active one. The
 * read-only mission detail is server-rendered by the dossier; this is only the
 * action surface.
 */
export default function InstructorMissionControls({
  instructorId,
  instructorName,
  missionId,
  relatedOptions,
}: {
  instructorId: string;
  instructorName: string;
  missionId: string | null;
  relatedOptions: RelatedOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Assign form
  const [assignOpen, setAssignOpen] = useState(false);
  const [area, setArea] = useState<string>(MISSION_AREAS[0].id);
  const [title, setTitle] = useState("");
  const [outcome, setOutcome] = useState("");
  const [cadence, setCadence] = useState<string>("once");
  const [dueOn, setDueOn] = useState("");
  const [related, setRelated] = useState("");

  // Complete / cancel / feedback
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completionOutcome, setCompletionOutcome] = useState<string>("delivered");
  const [completionNote, setCompletionNote] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [feedback, setFeedback] = useState("");

  const afterMutate = (result: { ok: boolean; error?: string }, successText: string, close?: () => void) => {
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error ?? "That could not be saved.");
      return;
    }
    setMessage(successText);
    close?.();
    router.refresh();
  };

  const submitAssign = async () => {
    setBusy(true);
    setMessage(null);
    const [relatedEntityType, relatedEntityId] = related ? related.split(":") : [null, null];
    const result = await assignInstructorMission({
      instructorId,
      area,
      title,
      outcome,
      cadence,
      dueOn: dueOn || null,
      relatedEntityType,
      relatedEntityId,
    });
    if (result.ok) {
      setTitle("");
      setOutcome("");
      setDueOn("");
      setRelated("");
    }
    afterMutate(result, "Current Mission assigned.", () => setAssignOpen(false));
  };

  const submitFeedback = async () => {
    setBusy(true);
    setMessage(null);
    const result = await addMissionFeedback(missionId!, feedback);
    if (result.ok) setFeedback("");
    afterMutate(result, "Feedback added.");
  };

  const submitComplete = async () => {
    setBusy(true);
    setMessage(null);
    const result = await completeInstructorMission(missionId!, completionOutcome, completionNote);
    afterMutate(result, "Mission completed.", () => setCompleteOpen(false));
  };

  const submitCancel = async () => {
    setBusy(true);
    setMessage(null);
    const result = await cancelInstructorMission(missionId!, cancelNote);
    afterMutate(result, "Mission cancelled.", () => setCancelOpen(false));
  };

  if (!missionId) {
    return (
      <div>
        <Button size="sm" variant="primary" onClick={() => { setMessage(null); setAssignOpen(true); }}>
          Assign Current Mission
        </Button>
        {message && <p role="status" className="ops-field__help" style={{ marginTop: 6 }}>{message}</p>}
        <Modal open={assignOpen} onClose={() => !busy && setAssignOpen(false)} title={`Assign a mission to ${instructorName}`} dismissible={!busy}>
          <div className="ops-field" style={{ marginBottom: 12 }}>
            <label htmlFor="mission-area">Responsibility area</label>
            <select id="mission-area" value={area} onChange={(event) => setArea(event.target.value)}>
              {MISSION_AREAS.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label} — {entry.contribution}</option>
              ))}
            </select>
          </div>
          <div className="ops-field" style={{ marginBottom: 12 }}>
            <label htmlFor="mission-title">Mission title</label>
            <input id="mission-title" type="text" maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Lead the Track 101 pilot at Eastfield" />
          </div>
          <div className="ops-field" style={{ marginBottom: 12 }}>
            <label htmlFor="mission-outcome">Outcome (what does done look like?)</label>
            <textarea id="mission-outcome" rows={3} maxLength={2000} value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="The concrete result this mission should produce." />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="ops-field" style={{ marginBottom: 12, flex: "1 1 160px" }}>
              <label htmlFor="mission-cadence">Cadence</label>
              <select id="mission-cadence" value={cadence} onChange={(event) => setCadence(event.target.value)}>
                {MISSION_CADENCES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </select>
            </div>
            <div className="ops-field" style={{ marginBottom: 12, flex: "1 1 160px" }}>
              <label htmlFor="mission-due">Due date (optional)</label>
              <input id="mission-due" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
            </div>
          </div>
          {relatedOptions.length > 0 && (
            <div className="ops-field" style={{ marginBottom: 12 }}>
              <label htmlFor="mission-related">Related program or class (optional)</label>
              <select id="mission-related" value={related} onChange={(event) => setRelated(event.target.value)}>
                <option value="">No specific link</option>
                {relatedOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          )}
          {message && <p role="alert" className="ops-error">{message}</p>}
          <Button variant="primary" disabled={busy || title.trim().length < 4 || outcome.trim().length < 10} onClick={submitAssign}>
            {busy ? "Assigning…" : "Assign mission"}
          </Button>
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <div className="ops-field" style={{ marginBottom: 10 }}>
        <label htmlFor="mission-feedback">Add coaching feedback</label>
        <textarea id="mission-feedback" rows={2} maxLength={4000} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="A note the instructor will see on this mission." />
        <div style={{ marginTop: 8 }}>
          <Button size="sm" variant="secondary" disabled={busy || feedback.trim().length < 3} onClick={submitFeedback}>Add feedback</Button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button size="sm" variant="primary" onClick={() => { setMessage(null); setCompleteOpen(true); }}>Complete mission</Button>
        <Button size="sm" variant="secondary" onClick={() => { setMessage(null); setCancelOpen(true); }}>Cancel mission</Button>
      </div>
      {message && <p role="status" className="ops-field__help" style={{ marginTop: 6 }}>{message}</p>}

      <Modal open={completeOpen} onClose={() => !busy && setCompleteOpen(false)} title="Complete mission" dismissible={!busy}>
        <div className="ops-field" style={{ marginBottom: 12 }}>
          <label htmlFor="mission-complete-outcome">How did it end?</label>
          <select id="mission-complete-outcome" value={completionOutcome} onChange={(event) => setCompletionOutcome(event.target.value)}>
            {MISSION_COMPLETION_OUTCOMES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
        </div>
        <div className="ops-field" style={{ marginBottom: 12 }}>
          <label htmlFor="mission-complete-note">Outcome note (optional)</label>
          <textarea id="mission-complete-note" rows={3} maxLength={2000} value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} placeholder="What was accomplished, in one or two lines." />
        </div>
        {message && <p role="alert" className="ops-error">{message}</p>}
        <Button variant="primary" disabled={busy} onClick={submitComplete}>{busy ? "Completing…" : "Complete mission"}</Button>
      </Modal>

      <Modal open={cancelOpen} onClose={() => !busy && setCancelOpen(false)} title="Cancel mission" dismissible={!busy}>
        <div className="ops-field" style={{ marginBottom: 12 }}>
          <label htmlFor="mission-cancel-note">Why is this being cancelled?</label>
          <textarea id="mission-cancel-note" rows={3} maxLength={2000} value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} placeholder="Kept on the record for history." />
        </div>
        {message && <p role="alert" className="ops-error">{message}</p>}
        <Button variant="primary" disabled={busy || cancelNote.trim().length < 4} onClick={submitCancel}>{busy ? "Cancelling…" : "Cancel mission"}</Button>
      </Modal>
    </div>
  );
}
