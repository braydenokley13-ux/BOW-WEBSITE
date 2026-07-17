"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button, Modal } from "@/components/ds";
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

interface Props {
  instructorId: string;
  stage: string;
  trainingStatus?: string;
  isAdmin: boolean;
  isStaff: boolean;
}

export default function InstructorDetailActions({ instructorId, stage, trainingStatus, isAdmin, isStaff }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "interview" | "notes" | "note" | "task" | "owner" | "eval">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [interviewAt, setInterviewAt] = useState("");
  const [interviewNotesInput, setInterviewNotesInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");

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
    const res = await fn();
    if (res.ok) {
      refresh();
    } else {
      setError(res.error || "Something went wrong.");
      setBusy(false);
    }
  };

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
          <Button size="sm" variant="secondary" onClick={() => setModal("interview")}>
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
            <Button size="sm" variant="primary" onClick={() => run(() => recordFounderDecision(instructorId, "accepted"))} disabled={busy}>
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
        {isAdmin && (stage === "active" || stage === "eligible") && (
          <Button size="sm" variant="secondary" onClick={() => run(() => markInactive(instructorId))} disabled={busy}>
            Mark Inactive
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setModal("owner")}>
          Assign Owner
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal("note")}>
          Add Note
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setModal("task")}>
          Create Task
        </Button>
      </div>

      {error && <p style={{ margin: "12px 0 0", fontFamily: "var(--font-data)", fontSize: 12.5, color: "var(--bow-negative)" }}>{error}</p>}

      <Modal open={modal === "interview"} onClose={() => setModal(null)} title="Schedule Interview">
        <label style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Date &amp; time</label>
        <input type="datetime-local" style={inputStyle} value={interviewAt} onChange={(e) => setInterviewAt(e.target.value)} />
        <Button
          variant="primary"
          full
          disabled={busy || !interviewAt}
          onClick={() =>
            run(() => scheduleInterview(instructorId, new Date(interviewAt).getTime()))
          }
        >
          {busy ? "Scheduling…" : "Schedule"}
        </Button>
      </Modal>

      <Modal open={modal === "notes"} onClose={() => setModal(null)} title="Interview Notes">
        <textarea rows={5} style={{ ...inputStyle, resize: "vertical" }} value={interviewNotesInput} onChange={(e) => setInterviewNotesInput(e.target.value)} />
        <Button variant="primary" full disabled={busy || !interviewNotesInput.trim()} onClick={() => run(() => recordInterviewNotes(instructorId, interviewNotesInput))}>
          {busy ? "Saving…" : "Save Notes"}
        </Button>
      </Modal>

      <Modal open={modal === "note"} onClose={() => setModal(null)} title="Add Note">
        <textarea rows={4} style={{ ...inputStyle, resize: "vertical" }} value={noteInput} onChange={(e) => setNoteInput(e.target.value)} />
        <Button variant="primary" full disabled={busy || !noteInput.trim()} onClick={() => run(() => addActivityNote("instructor", instructorId, noteInput))}>
          {busy ? "Saving…" : "Add Note"}
        </Button>
      </Modal>

      <Modal open={modal === "task"} onClose={() => setModal(null)} title="Create Task">
        <input style={inputStyle} placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
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
        <input style={inputStyle} placeholder="Lesson used" value={lessonUsed} onChange={(e) => setLessonUsed(e.target.value)} />
        {(
          [
            ["Curriculum delivery", ratingCurriculum, setRatingCurriculum],
            ["Communication / engagement", ratingCommunication, setRatingCommunication],
            ["Preparedness / reliability", ratingPreparedness, setRatingPreparedness],
          ] as const
        ).map(([label, value, setter]) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <label style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>
              {label} (1–5)
            </label>
            <select style={inputStyle} value={value} onChange={(e) => setter(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ))}
        <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Strengths" />
        <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="Concerns" />
        <label style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Decision</label>
        <select style={inputStyle} value={decision} onChange={(e) => setDecision(e.target.value as "pass" | "revise_retry" | "fail")}>
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
        <input style={inputStyle} placeholder="Staff user id (e.g. u-admin)" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} />
        <Button variant="primary" full disabled={busy || !ownerId.trim()} onClick={() => run(() => updateApplicantOwner(instructorId, ownerId))}>
          {busy ? "Saving…" : "Assign"}
        </Button>
      </Modal>
    </div>
  );
}
