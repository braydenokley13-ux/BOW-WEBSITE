"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ds";
import { advanceApplication, decideApplication, scheduleInterviewEvent, submitCandidateEvaluation, updateInterviewEventStatus } from "@/app/actions/people-work";

type Stage = { id: string; title: string; stage_type: string; ordinal: number; scorecard_version_id?: string | null };
type Interview = { id: string; stage_version_id: string; status: string; revision: number };

export default function ApplicationCockpitActions({
  applicationId,
  revision,
  currentStageId,
  lifecycle,
  stages,
  interviews,
}: {
  applicationId: string;
  revision: number;
  currentStageId: string;
  lifecycle: string;
  stages: Stage[];
  interviews: Interview[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"advance" | "schedule" | "evaluate" | "attendance" | "decide" | null>(null);
  const [stageId, setStageId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState({ localDateTime: "", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York", durationMinutes: 45, locationType: "video" as const, location: "" });
  const [evaluation, setEvaluation] = useState({ evidenceNote: "", recommendation: "continue" as "strong_hire" | "hire" | "continue" | "do_not_hire", responses: "" });
  const [decision, setDecision] = useState<"accepted" | "rejected">("accepted");
  const [attendance, setAttendance] = useState<"canceled" | "no_show">("no_show");
  const [engagement, setEngagement] = useState<"volunteer" | "employee" | "contractor" | "other">("volunteer");
  const terminal = ["accepted", "rejected", "withdrawn"].includes(lifecycle);
  const currentInterview = interviews.find((event) => event.stage_version_id === currentStageId && ["needs_scheduling", "scheduled", "rescheduled"].includes(event.status));
  const currentStage = stages.find((stage) => stage.id === currentStageId);
  const forwardStages = stages.filter((stage) => stage.ordinal > (currentStage?.ordinal ?? 0) && stage.stage_type !== "onboarding");
  const close = () => { if (!busy) { setModal(null); setError(null); } };
  const run = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true); setError(null); const result = await action(); setBusy(false);
    if (!result.ok) return setError(result.error ?? "The action could not be completed.");
    setModal(null); router.refresh();
  };
  return <div className="ops-panel">
    <div className="ops-section-head"><div><span className="ops-label">Candidate action</span><h2 className="ops-section-title">Move the process forward</h2></div></div>
    {terminal ? <p className="ops-body">This application has a final status: {lifecycle}.</p> : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button variant="primary" onClick={() => setModal("advance")}>Advance Stage</Button>
      {currentInterview && <Button variant="secondary" onClick={() => setModal("schedule")}>{currentInterview.status === "needs_scheduling" ? "Schedule" : "Reschedule"}</Button>}
      {currentInterview && ["scheduled", "rescheduled"].includes(currentInterview.status) && <Button variant="ghost" onClick={() => setModal("attendance")}>Cancel / No-show</Button>}
      {currentStage?.scorecard_version_id && <Button variant="secondary" onClick={() => setModal("evaluate")}>Submit Scorecard</Button>}
      {currentStage?.stage_type === "decision" && <Button variant="emphasis" onClick={() => setModal("decide")}>Record Decision</Button>}
    </div>}

    <Modal open={modal === "advance"} onClose={close} title="Advance candidate" dismissible={!busy}><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="advance-stage">Next configured stage</label><select id="advance-stage" value={stageId} onChange={(event) => setStageId(event.target.value)}><option value="">Choose stage</option>{forwardStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.ordinal}. {stage.title}</option>)}</select></div><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="advance-note">Evidence or handoff note</label><textarea id="advance-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></div>{error && <p className="ops-error">{error}</p>}<Button variant="primary" disabled={busy || !stageId} onClick={() => run(() => advanceApplication({ applicationId, toStageVersionId: stageId, expectedRevision: revision, note }))}>Advance</Button></Modal>

    <Modal open={modal === "schedule"} onClose={close} title="Schedule interview event" dismissible={!busy}><div className="ops-fields"><div className="ops-field"><label htmlFor="schedule-when">Date and time</label><input id="schedule-when" type="datetime-local" value={schedule.localDateTime} onChange={(event) => setSchedule((value) => ({ ...value, localDateTime: event.target.value }))} /></div><div className="ops-field"><label htmlFor="schedule-zone">Timezone</label><input id="schedule-zone" value={schedule.timeZone} onChange={(event) => setSchedule((value) => ({ ...value, timeZone: event.target.value }))} /></div><div className="ops-field"><label htmlFor="schedule-duration">Minutes</label><input id="schedule-duration" type="number" min={10} max={240} value={schedule.durationMinutes} onChange={(event) => setSchedule((value) => ({ ...value, durationMinutes: Number(event.target.value) }))} /></div><div className="ops-field"><label htmlFor="schedule-location-type">Format</label><select id="schedule-location-type" value={schedule.locationType} onChange={(event) => setSchedule((value) => ({ ...value, locationType: event.target.value as typeof value.locationType }))}><option value="video">Video</option><option value="phone">Phone</option><option value="in_person">In person</option></select></div></div><div className="ops-field" style={{ margin: "12px 0" }}><label htmlFor="schedule-location">Meeting link or location</label><input id="schedule-location" value={schedule.location} onChange={(event) => setSchedule((value) => ({ ...value, location: event.target.value }))} /></div>{error && <p className="ops-error">{error}</p>}<Button variant="primary" disabled={busy || !currentInterview || !schedule.localDateTime || !schedule.location} onClick={() => currentInterview && run(() => scheduleInterviewEvent({ eventId: currentInterview.id, expectedRevision: currentInterview.revision, ...schedule }))}>Save Schedule</Button></Modal>

    <Modal open={modal === "evaluate"} onClose={close} title="Submit configured scorecard" dismissible={!busy}><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="evaluation-responses">Structured observations</label><textarea id="evaluation-responses" rows={5} placeholder="Communication: Strong\nCoachability: Excellent\nReliability signals: Clear" value={evaluation.responses} onChange={(event) => setEvaluation((value) => ({ ...value, responses: event.target.value }))} /></div><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="evaluation-note">Evidence note</label><textarea id="evaluation-note" rows={4} value={evaluation.evidenceNote} onChange={(event) => setEvaluation((value) => ({ ...value, evidenceNote: event.target.value }))} /></div><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="evaluation-rec">Recommendation</label><select id="evaluation-rec" value={evaluation.recommendation} onChange={(event) => setEvaluation((value) => ({ ...value, recommendation: event.target.value as typeof value.recommendation }))}><option value="strong_hire">Strong hire</option><option value="hire">Hire</option><option value="continue">Continue evaluation</option><option value="do_not_hire">Do not hire</option></select></div>{error && <p className="ops-error">{error}</p>}<Button variant="primary" disabled={busy || evaluation.evidenceNote.trim().length < 10} onClick={() => run(() => submitCandidateEvaluation({ applicationId, stageVersionId: currentStageId, responses: { observations: evaluation.responses }, evidenceNote: evaluation.evidenceNote, recommendation: evaluation.recommendation }))}>Submit Scorecard</Button></Modal>

    <Modal open={modal === "attendance"} onClose={close} title="Record appointment exception" dismissible={!busy}><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="attendance-value">What happened?</label><select id="attendance-value" value={attendance} onChange={(event) => setAttendance(event.target.value as typeof attendance)}><option value="no_show">Candidate did not attend</option><option value="canceled">Appointment canceled</option></select></div><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="attendance-note">Evidence and follow-up</label><textarea id="attendance-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></div>{error && <p className="ops-error">{error}</p>}<Button variant="primary" disabled={busy || !currentInterview || note.trim().length < 5} onClick={() => currentInterview && run(() => updateInterviewEventStatus({ eventId: currentInterview.id, expectedRevision: currentInterview.revision, status: attendance, note }))}>Record status</Button></Modal>

    <Modal open={modal === "decide"} onClose={close} title="Record hiring decision" dismissible={!busy}><div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="decision-value">Decision</label><select id="decision-value" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}><option value="accepted">Accept</option><option value="rejected">Reject</option></select></div>{decision === "accepted" && <div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="decision-engagement">Recorded engagement type</label><select id="decision-engagement" value={engagement} onChange={(event) => setEngagement(event.target.value as typeof engagement)}><option value="volunteer">Volunteer</option><option value="employee">Employee</option><option value="contractor">Contractor</option><option value="other">Other</option></select><span className="ops-field__help">This records BOW&apos;s decision; software does not determine legal classification.</span></div>}<div className="ops-field" style={{ marginBottom: 12 }}><label htmlFor="decision-note">Decision evidence</label><textarea id="decision-note" rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></div>{error && <p className="ops-error">{error}</p>}<Button variant="emphasis" disabled={busy || note.trim().length < 10} onClick={() => run(() => decideApplication({ applicationId, expectedRevision: revision, decision, note, engagementType: engagement }))}>Confirm Decision</Button></Modal>
  </div>;
}
