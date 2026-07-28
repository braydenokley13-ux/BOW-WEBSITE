"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { updateSessionPlan, cancelSession } from "@/app/actions/delivery";

interface Props {
  sessionId: string;
  status: string;
  plan: {
    title: string;
    objective: string;
    agenda: string;
    materials: string;
    meetingLink: string;
    location: string;
  };
}

/** Edits the session plan instructors prepare from, and — separately — cancels the session with a required reason. */
export default function SessionPlanForm({ sessionId, status, plan }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(plan.title);
  const [objective, setObjective] = useState(plan.objective);
  const [agenda, setAgenda] = useState(plan.agenda);
  const [materials, setMaterials] = useState(plan.materials);
  const [meetingLink, setMeetingLink] = useState(plan.meetingLink);
  const [location, setLocation] = useState(plan.location);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = status === "scheduled";

  const savePlan = async () => {
    setBusy(true);
    setError(null);
    const result = await updateSessionPlan(sessionId, { title, objective, agenda, materials, meetingLink, location });
    if (!result.ok) {
      setError(result.error ?? "The plan could not be saved.");
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  };

  const confirmCancel = async () => {
    if (cancelReason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    const result = await cancelSession(sessionId, cancelReason);
    if (!result.ok) {
      setError(result.error ?? "The session could not be cancelled.");
      setBusy(false);
      return;
    }
    setBusy(false);
    setShowCancel(false);
    router.refresh();
  };

  if (!editable) {
    return <p className="ops-record-meta">This session is {status} and its plan is a historical record; it cannot be edited.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <div className="ops-field">
        <label htmlFor={`plan-title-${sessionId}`}>Title</label>
        <input id={`plan-title-${sessionId}`} type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="ops-field">
        <label htmlFor={`plan-objective-${sessionId}`}>Objective</label>
        <textarea id={`plan-objective-${sessionId}`} value={objective} onChange={(event) => setObjective(event.target.value)} />
      </div>
      <div className="ops-field">
        <label htmlFor={`plan-agenda-${sessionId}`}>Agenda</label>
        <textarea id={`plan-agenda-${sessionId}`} value={agenda} onChange={(event) => setAgenda(event.target.value)} />
      </div>
      <div className="ops-field">
        <label htmlFor={`plan-materials-${sessionId}`}>Materials</label>
        <textarea id={`plan-materials-${sessionId}`} value={materials} onChange={(event) => setMaterials(event.target.value)} />
      </div>
      <div className="ops-field">
        <label htmlFor={`plan-location-${sessionId}`}>Location</label>
        <input id={`plan-location-${sessionId}`} type="text" value={location} onChange={(event) => setLocation(event.target.value)} />
      </div>
      <div className="ops-field">
        <label htmlFor={`plan-link-${sessionId}`}>Meeting link</label>
        <input id={`plan-link-${sessionId}`} type="text" value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://…" />
      </div>
      {error && <p className="ops-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button variant="emphasis" size="sm" disabled={busy} onClick={savePlan}>{busy ? "Saving…" : "Save plan"}</Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setShowCancel((v) => !v)}>Cancel session</Button>
      </div>

      {showCancel && (
        <div className="ops-alert" data-tone="negative">
          <span className="ops-alert__title">Cancel this session</span>
          <div className="ops-field" style={{ marginTop: 10 }}>
            <label htmlFor={`plan-cancel-reason-${sessionId}`}>Reason (required)</label>
            <textarea
              id={`plan-cancel-reason-${sessionId}`}
              required
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Families and staff will read this."
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <Button variant="emphasis" size="sm" disabled={busy || cancelReason.trim().length < 3} onClick={confirmCancel}>
              {busy ? "Cancelling…" : "Confirm cancellation"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
