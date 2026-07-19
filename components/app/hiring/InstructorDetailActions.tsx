"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button, Modal } from "@/components/ds";
import UserSelect from "@/components/app/UserSelect";
import AvailabilityEditor, { type AvailabilitySlot } from "@/components/app/hiring/AvailabilityEditor";
import {
  scheduleInterview,
  recordInterviewNotes,
  submitForFounderReview,
  recordFounderDecision,
  updateApplicantOwner,
  moveToPracticeEvaluation,
  recordPracticeEvaluation,
  markEligible,
  markActive,
  markInactive,
} from "@/app/actions/instructors";
import { addActivityNote } from "@/app/actions/activity";
import { createTask } from "@/app/actions/tasks";
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

interface Props {
  instructorId: string;
  stage: string;
  trainingStatus?: string;
  isAdmin: boolean;
  isStaff: boolean;
  staffUsers: { id: string; name: string }[];
  availability: AvailabilitySlot[];
}

export default function InstructorDetailActions({ instructorId, stage, trainingStatus, isAdmin, isStaff, staffUsers, availability }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "interview" | "notes" | "note" | "task" | "owner" | "eval" | "availability" | "inactive" | "invitation">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [interviewAt, setInterviewAt] = useState("");
  const [interviewTimeZone, setInterviewTimeZone] = useState<string>(DEFAULT_TIME_ZONE);
  const [interviewNotesInput, setInterviewNotesInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [inactiveReason, setInactiveReason] = useState("");
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationDelivery, setInvitationDelivery] = useState<"queued" | "manual_copy_required" | null>(null);

  const [lessonUsed, setLessonUsed] = useState("");
  const [ratingCurriculum, setRatingCurriculum] = useState(3);
  const [ratingCommunication, setRatingCommunication] = useState(3);
  const [ratingPreparedness, setRatingPreparedness] = useState(3);
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [decision, setDecision] = useState<"pass" | "revise_retry" | "fail">("pass");

  const refresh = () => {
    setModal(null);
    setBusy(false);
    router.refresh();
  };

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res.ok) {
        refresh();
      } else {
        setError(res.error || "Something went wrong.");
        setBusy(false);
      }
    } catch {
      setError("The operation could not be completed. Refresh and try again.");
      setBusy(false);
    }
  };

  const acceptFounderDecision = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await recordFounderDecision(instructorId, "accepted");
      if (!result.ok) {
        setError(result.error ?? "The founder decision could not be saved.");
        setBusy(false);
        return;
      }
      if (!result.invitationToken) {
        setError("The applicant was accepted, but no onboarding link was returned. Open Invitations and resend it.");
        setBusy(false);
        router.refresh();
        return;
      }
      setInvitationToken(result.invitationToken);
      setInvitationDelivery(result.invitationDelivery ?? "manual_copy_required");
      setModal("invitation");
      setBusy(false);
    } catch {
      setError("The founder decision could not be completed. Refresh and try again.");
      setBusy(false);
    }
  };

  const copyInvitation = async () => {
    if (!invitationToken) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/accept-invitation#token=${encodeURIComponent(invitationToken)}`);
      setError(null);
    } catch {
      setError("The onboarding link could not be copied. Use Invitations to resend and reveal a fresh link.");
    }
  };

  const actionError = (id?: string) => error ? (
    <p id={id} role="alert" style={{ margin: "0 0 12px", fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>
      {error}
    </p>
  ) : null;

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 22 }}>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--bow-slate)",
          display: "block",
          marginBottom: 12,
        }}
      >
        Actions
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(stage === "applied" || stage === "reviewing") && (
          <Button size="sm" variant="secondary" onClick={() => { setError(null); setModal("interview"); }}>
            Schedule Interview
          </Button>
        )}
        {stage === "interview_scheduled" && (
          <Button size="sm" variant="secondary" onClick={() => setModal("notes")}>
            Record Interview Notes
          </Button>
        )}
        {stage === "interviewed" && (
          <Button size="sm" variant="primary" onClick={() => run(() => submitForFounderReview(instructorId))} disabled={busy}>
            Submit for Founder Review
          </Button>
        )}
        {stage === "founder_review" && isAdmin && (
          <>
            <Button size="sm" variant="primary" onClick={() => void acceptFounderDecision()} disabled={busy}>
              Accept
            </Button>
            <Button size="sm" variant="secondary" onClick={() => run(() => recordFounderDecision(instructorId, "rejected"))} disabled={busy}>
              Reject
            </Button>
          </>
        )}
        {stage === "founder_review" && !isAdmin && (
          <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
            Awaiting a founder (admin) decision.
          </span>
        )}
        {isStaff && stage === "training" && trainingStatus === "complete" && (
          <Button size="sm" variant="secondary" onClick={() => run(() => moveToPracticeEvaluation(instructorId))} disabled={busy}>
            Move to Practice Evaluation
          </Button>
        )}
        {isStaff && stage === "practice_evaluation" && (
          <Button size="sm" variant="secondary" onClick={() => setModal("eval")}>
            Record Practice Evaluation
          </Button>
        )}
        {isAdmin && stage === "practice_evaluation" && (
          <Button size="sm" variant="primary" onClick={() => run(() => markEligible(instructorId))} disabled={busy}>
            Mark Eligible
          </Button>
        )}
        {isAdmin && stage === "eligible" && (
          <Button size="sm" variant="primary" onClick={() => run(() => markActive(instructorId))} disabled={busy}>
            Mark Active
          </Button>
        )}
        {isAdmin && stage === "inactive" && (
          <Button size="sm" variant="primary" onClick={() => run(() => markActive(instructorId))} disabled={busy}>
            Reactivate
          </Button>
        )}
        {isAdmin && (stage === "active" || stage === "eligible") && (
          <Button size="sm" variant="secondary" onClick={() => { setInactiveReason(""); setError(null); setModal("inactive"); }} disabled={busy}>
            Mark Inactive
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setModal("owner")}>
          Assign Owner
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal("availability")}>
          Edit Availability
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal("note")}>
          Add Note
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal("task")}>
          Create Task
        </Button>
      </div>

      {error && modal === null && <div style={{ marginTop: 12 }}>{actionError()}</div>}

      <Modal
        open={modal === "invitation"}
        onClose={() => {
          setInvitationToken(null);
          setInvitationDelivery(null);
          setModal(null);
          router.refresh();
        }}
        title="Applicant Accepted"
      >
        {actionError()}
        <p style={{ margin: "0 0 14px", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)" }}>
          The hiring decision, onboarding invitation, and founder Work resolution were saved together. {invitationDelivery === "queued" ? "Email delivery is queued, not yet guaranteed." : "Email delivery needs configuration."} Copy this one-time fallback now; BOW stores only its one-way digest.
        </p>
        <Button variant="primary" full disabled={!invitationToken} onClick={() => void copyInvitation()}>
          Copy Secure Onboarding Link
        </Button>
      </Modal>

      <Modal open={modal === "interview"} onClose={() => { setError(null); setModal(null); }} title="Schedule Interview">
        {actionError("instructor-interview-error")}
        <label htmlFor="instructor-interview-at" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Date &amp; time</label>
        <input aria-describedby={`instructor-interview-help${error ? " instructor-interview-error" : ""}`} aria-invalid={Boolean(error)} className="bow-field" id="instructor-interview-at" type="datetime-local" style={inputStyle} value={interviewAt} onChange={(e) => setInterviewAt(e.target.value)} />
        <label htmlFor="instructor-interview-timezone" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Interview timezone</label>
        <select aria-describedby={`instructor-interview-help${error ? " instructor-interview-error" : ""}`} aria-invalid={Boolean(error)} className="bow-field" id="instructor-interview-timezone" style={inputStyle} value={interviewTimeZone} onChange={(event) => setInterviewTimeZone(event.target.value)}>
          {COMMON_TIME_ZONES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <p id="instructor-interview-help" style={{ margin: "-4px 0 12px", fontFamily: "var(--font-interface)", fontSize: 12, lineHeight: 1.45, color: "var(--bow-slate)" }}>
          The time above is interpreted in this timezone, including daylight-saving rules.
        </p>
        <Button
          variant="primary"
          full
          disabled={busy || !interviewAt}
          onClick={() =>
            run(() => scheduleInterview(instructorId, { localDateTime: interviewAt, timeZone: interviewTimeZone }))
          }
        >
          {busy ? "Scheduling…" : "Schedule"}
        </Button>
      </Modal>

      <Modal open={modal === "inactive"} onClose={() => setModal(null)} title="Revoke Teaching Access" dismissible={!busy}>
        <p style={{ margin: "0 0 12px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
          This signs the instructor out immediately and creates urgent coverage work for every active Class assignment.
        </p>
        <label htmlFor="instructor-inactive-reason" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Operational reason</label>
        <textarea className="bow-field" id="instructor-inactive-reason" rows={5} style={{ ...inputStyle, resize: "vertical" }} value={inactiveReason} onChange={(event) => setInactiveReason(event.target.value)} placeholder="Why is access being revoked, and what coverage context matters?" />
        {actionError()}
        <Button variant="primary" full disabled={busy || inactiveReason.trim().length < 3} onClick={() => run(() => markInactive(instructorId, inactiveReason))}>
          {busy ? "Revoking…" : "Revoke Access + Create Coverage Work"}
        </Button>
      </Modal>

      <Modal open={modal === "notes"} onClose={() => setModal(null)} title="Interview Notes">
        {actionError()}
        <label htmlFor="instructor-interview-notes" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Interview notes</label>
        <textarea className="bow-field" id="instructor-interview-notes" rows={5} style={{ ...inputStyle, resize: "vertical" }} value={interviewNotesInput} onChange={(e) => setInterviewNotesInput(e.target.value)} />
        <Button variant="primary" full disabled={busy || !interviewNotesInput.trim()} onClick={() => run(() => recordInterviewNotes(instructorId, interviewNotesInput))}>
          {busy ? "Saving…" : "Save Notes"}
        </Button>
      </Modal>

      <Modal open={modal === "note"} onClose={() => setModal(null)} title="Add Note">
        {actionError()}
        <label htmlFor="instructor-activity-note" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Activity note</label>
        <textarea className="bow-field" id="instructor-activity-note" rows={4} style={{ ...inputStyle, resize: "vertical" }} value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
        <Button variant="primary" full disabled={busy || !noteInput.trim()} onClick={() => run(() => addActivityNote("instructor", instructorId, noteInput))}>
          {busy ? "Saving…" : "Add Note"}
        </Button>
      </Modal>

      <Modal open={modal === "task"} onClose={() => setModal(null)} title="Create Task">
        {actionError()}
        <label htmlFor="instructor-task-title" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Task title</label>
        <input className="bow-field" id="instructor-task-title" style={inputStyle} placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
        <Button
          variant="primary"
          full
          disabled={busy || !taskTitle.trim()}
          onClick={() => run(() => createTask({ title: taskTitle, entityType: "instructor", entityId: instructorId }))}
        >
          {busy ? "Creating…" : "Create Task"}
        </Button>
      </Modal>

      <Modal open={modal === "eval"} onClose={() => setModal(null)} title="Record Practice Evaluation" maxWidth={560}>
        {actionError()}
        <label htmlFor="instructor-eval-lesson" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Lesson used</label>
        <input className="bow-field" id="instructor-eval-lesson" style={inputStyle} placeholder="Lesson used" value={lessonUsed} onChange={(e) => setLessonUsed(e.target.value)} />
        {(
          [
            ["Curriculum delivery", ratingCurriculum, setRatingCurriculum],
            ["Communication / engagement", ratingCommunication, setRatingCommunication],
            ["Preparedness / reliability", ratingPreparedness, setRatingPreparedness],
          ] as const
        ).map(([label, value, setter]) => {
          const fieldId = `instructor-eval-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
          return (
            <div key={label} style={{ marginBottom: 12 }}>
              <label htmlFor={fieldId} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>
                {label} (1–5)
              </label>
              <select className="bow-field" id={fieldId} style={inputStyle} value={value} onChange={(e) => setter(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
        <label htmlFor="instructor-eval-strengths" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Strengths</label>
        <textarea className="bow-field" id="instructor-eval-strengths" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Strengths" />
        <label htmlFor="instructor-eval-concerns" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Concerns</label>
        <textarea className="bow-field" id="instructor-eval-concerns" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="Concerns" />
        <label htmlFor="instructor-eval-decision" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Decision</label>
        <select className="bow-field" id="instructor-eval-decision" style={inputStyle} value={decision} onChange={(e) => setDecision(e.target.value as "pass" | "revise_retry" | "fail")}>
          <option value="pass">Pass</option>
          <option value="revise_retry">Revise / Retry</option>
          <option value="fail">Fail</option>
        </select>
        <Button
          variant="primary"
          full
          disabled={busy}
          onClick={() =>
            run(() =>
              recordPracticeEvaluation(instructorId, {
                evaluatorUserId: "",
                evaluatedAt: Date.now(),
                lessonUsed,
                ratingCurriculumDelivery: ratingCurriculum,
                ratingCommunicationEngagement: ratingCommunication,
                ratingPreparednessReliability: ratingPreparedness,
                strengths,
                concerns,
                decision,
              }),
            )
          }
        >
          {busy ? "Saving…" : "Save Evaluation"}
        </Button>
      </Modal>

      <Modal open={modal === "owner"} onClose={() => setModal(null)} title="Assign Owner">
        {actionError()}
        <label htmlFor="instructor-owner" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Accountable owner</label>
        <UserSelect id="instructor-owner" users={staffUsers} value={ownerId} onChange={setOwnerId} />
        <div style={{ height: 12 }} />
        <Button variant="primary" full disabled={busy} onClick={() => run(() => updateApplicantOwner(instructorId, ownerId))}>
          {busy ? "Saving…" : "Assign"}
        </Button>
      </Modal>

      <Modal open={modal === "availability"} onClose={() => setModal(null)} title="Edit Availability" maxWidth={640}>
        <AvailabilityEditor instructorId={instructorId} initialSlots={availability} />
      </Modal>
    </div>
  );
}
