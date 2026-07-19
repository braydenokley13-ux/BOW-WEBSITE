"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@/components/ds";
import {
  addProgramNote,
  assignInstructorToProgramClass,
  attachClassToProgram,
  completeProgram,
  createClassForProgram,
  createProgramContinuation,
  holdProgramContinuation,
  removeInstructorFromProgramClass,
  setProgramMaterialsStatus,
  setProgramPartnerConfirmation,
  transitionProgram,
} from "@/app/actions/programs";
import { programStageLabel, type ProgramStage, type StaffingRecommendation } from "@/lib/operations-shared";

interface Props {
  programId: string;
  programName: string;
  stage: ProgramStage;
  partnerConfirmed: boolean;
  materialsStatus: "not_ready" | "ordered" | "ready";
  renewalStatus: string;
  readinessCanLaunch: boolean;
  availableTransitions: ProgramStage[];
  classes: { id: string; title: string }[];
  unassignedClasses: { id: string; title: string; status: string }[];
  recommendationsByClass: Record<string, { lead: StaffingRecommendation[]; additional: StaffingRecommendation[] }>;
  assignedInstructors: { instructorId: string; name: string; role: string; classId: string; classTitle: string }[];
  canApproveLaunchException: boolean;
}

type ModalName = "stage" | "attach" | "class" | "assign" | "team" | "note" | "complete" | "continuation" | "continuationHold";

function defaultContinuationReviewDate(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function ProgramActions({
  programId,
  programName,
  stage,
  partnerConfirmed,
  materialsStatus,
  renewalStatus,
  readinessCanLaunch,
  availableTransitions,
  classes,
  unassignedClasses,
  recommendationsByClass,
  assignedInstructors,
  canApproveLaunchException,
}: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalName | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextStage, setNextStage] = useState<ProgramStage>(availableTransitions.find((candidate) => candidate !== "completed") ?? stage);
  const [stageNote, setStageNote] = useState("");
  const [operatingNote, setOperatingNote] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [unassignedClassId, setUnassignedClassId] = useState(unassignedClasses[0]?.id ?? "");
  const [classTitle, setClassTitle] = useState(programName);
  const [instructorId, setInstructorId] = useState(
    classes[0] ? recommendationsByClass[classes[0].id]?.lead[0]?.instructorId ?? "" : "",
  );
  const [assignmentRole, setAssignmentRole] = useState<"lead" | "additional">("lead");
  const [staffingDecision, setStaffingDecision] = useState("");
  const [assignmentKey, setAssignmentKey] = useState(() => assignedInstructors[0] ? `${assignedInstructors[0].classId}:${assignedInstructors[0].instructorId}` : "");
  const [removalReason, setRemovalReason] = useState("");
  const [outcome, setOutcome] = useState("");
  const [continuationMode, setContinuationMode] = useState<"renewal" | "expansion">("renewal");
  const [continuationName, setContinuationName] = useState("");
  const [continuationKey, setContinuationKey] = useState(() => globalThis.crypto?.randomUUID?.() ?? `continuation-${Date.now()}-${Math.random()}`);
  const [holdReason, setHoldReason] = useState("");
  const [holdReviewDate, setHoldReviewDate] = useState(defaultContinuationReviewDate);

  const classRecommendations = useMemo(
    () => recommendationsByClass[classId]?.[assignmentRole] ?? [],
    [assignmentRole, classId, recommendationsByClass],
  );
  const selectedRecommendation = useMemo(
    () => classRecommendations.find((recommendation) => recommendation.instructorId === instructorId),
    [classRecommendations, instructorId],
  );
  const isHistorical = stage === "completed" || stage === "renewal_review" || stage === "renewed" || stage === "closed";
  const canChangeDeliveryPlan = !isHistorical && !["ready_to_launch", "active", "paused"].includes(stage);
  const selectedAssignment = assignedInstructors.find(
    (assignment) => `${assignment.classId}:${assignment.instructorId}` === assignmentKey,
  );

  const close = () => {
    setModal(null);
    setError(null);
    setBusy(false);
  };

  const run = async <T extends { ok: boolean; error?: string }>(work: () => Promise<T>, onSuccess?: (result: T) => void) => {
    setBusy(true);
    setError(null);
    try {
      const result = await work();
      if (!result.ok) {
        setError(result.error ?? "The action could not be completed.");
        setBusy(false);
        return;
      }
      close();
      onSuccess?.(result);
      router.refresh();
    } catch {
      setError("The action was interrupted before it could be confirmed. Please retry.");
      setBusy(false);
    }
  };

  const openStage = () => {
    setNextStage(availableTransitions.find((candidate) => candidate !== "completed") ?? stage);
    setStageNote("");
    setExceptionReason("");
    setModal("stage");
  };

  const openAssign = () => {
    const firstClass = classes.find((candidate) => recommendationsByClass[candidate.id]?.lead.length > 0) ?? classes[0];
    const nextClassId = firstClass?.id ?? "";
    setAssignmentRole("lead");
    setClassId(nextClassId);
    setInstructorId(nextClassId ? recommendationsByClass[nextClassId]?.lead[0]?.instructorId ?? "" : "");
    setStaffingDecision("");
    setModal("assign");
  };

  const openTeam = () => {
    const first = assignedInstructors[0];
    setAssignmentKey(first ? `${first.classId}:${first.instructorId}` : "");
    setRemovalReason("");
    setModal("team");
  };

  const openContinuation = (mode: "renewal" | "expansion") => {
    setContinuationMode(mode);
    setContinuationName("");
    setContinuationKey(globalThis.crypto?.randomUUID?.() ?? `continuation-${Date.now()}-${Math.random()}`);
    setModal("continuation");
  };
  const decisionNoteRequired = nextStage === "paused" || nextStage === "closed";

  return (
    <section id="actions" className="ops-panel ops-panel--signal ops-anchor">
      <div className="ops-section-head">
        <div>
          <span className="ops-label">Operating controls</span>
          <h2 className="ops-section-title">Move the Program forward</h2>
        </div>
      </div>

      <div className="ops-actions" style={{ justifyContent: "flex-start" }}>
        {!isHistorical && !(partnerConfirmed && ["ready_to_launch", "active"].includes(stage)) && (
          <Button variant={partnerConfirmed ? "secondary" : "emphasis"} size="sm" disabled={busy} onClick={() => run(() => setProgramPartnerConfirmation(programId, !partnerConfirmed))}>
            {partnerConfirmed ? "Remove Partner Confirmation" : "Record Partner Confirmation"}
          </Button>
        )}
        {!isHistorical && !(materialsStatus === "ready" && ["ready_to_launch", "active"].includes(stage)) && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => setProgramMaterialsStatus(programId, materialsStatus === "ready" ? "not_ready" : "ready"))}>
            {materialsStatus === "ready" ? "Mark Materials Not Ready" : "Mark Materials Ready"}
          </Button>
        )}
        {availableTransitions.filter((candidate) => candidate !== "completed").length > 0 && (
          <Button variant="primary" size="sm" disabled={busy} onClick={openStage}>Move Program Stage</Button>
        )}
        {stage === "active" && <Button variant="emphasis" size="sm" disabled={busy} onClick={() => setModal("complete")}>Complete Program</Button>}
        {stage === "active" && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => openContinuation("expansion")}>Plan Expansion</Button>
        )}
        {(stage === "completed" || stage === "renewal_review") && (
          <Button variant="emphasis" size="sm" disabled={busy} onClick={() => openContinuation("renewal")}>Renew or Expand</Button>
        )}
        {(stage === "completed" || stage === "renewal_review") && !["renewed", "expanded"].includes(renewalStatus) && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => {
              setHoldReason("");
              setHoldReviewDate(defaultContinuationReviewDate());
              setModal("continuationHold");
            }}
          >
            Hold Continuation
          </Button>
        )}
        {canChangeDeliveryPlan && <Button variant="secondary" size="sm" disabled={busy} onClick={() => setModal("class")}>Create Delivery Class</Button>}
        {canChangeDeliveryPlan && <Button variant="secondary" size="sm" disabled={busy || unassignedClasses.length === 0} onClick={() => setModal("attach")}>Connect Existing Class</Button>}
        {!isHistorical && <Button variant="secondary" size="sm" disabled={busy || classes.length === 0 || !Object.values(recommendationsByClass).some((items) => items.lead.length > 0 || items.additional.length > 0)} onClick={openAssign}>Assign Recommended Instructor</Button>}
        {!isHistorical && <Button variant="secondary" size="sm" disabled={busy || assignedInstructors.length === 0} onClick={openTeam}>Manage Delivery Team</Button>}
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setOperatingNote(""); setModal("note"); }}>Add Operating Note</Button>
      </div>
      {error && <p className="ops-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}

      <Modal open={modal === "stage"} onClose={close} title="Move Program Stage" accent="var(--bow-orange)" dismissible={!busy}>
        <div className="ops-field">
          <label htmlFor="program-next-stage">Next stage</label>
          <select id="program-next-stage" value={nextStage} onChange={(event) => setNextStage(event.target.value as ProgramStage)}>
            {availableTransitions.filter((candidate) => candidate !== "completed").map((candidate) => (
              <option key={candidate} value={candidate}>{programStageLabel(candidate)}</option>
            ))}
          </select>
        </div>
        <div className="ops-field" style={{ marginTop: 14 }}>
          <label htmlFor="program-stage-note">Decision note</label>
          <textarea id="program-stage-note" value={stageNote} onChange={(event) => setStageNote(event.target.value)} placeholder="What changed, who owns the next step, and why this move is correct." />
          <span className="ops-field__help">
            {decisionNoteRequired ? "Required for pause or closure so the recovery/closure record is complete." : "Optional context for the next operator."}
          </span>
        </div>
        {(nextStage === "ready_to_launch" || nextStage === "active") && !readinessCanLaunch && canApproveLaunchException && (
          <div className="ops-field" style={{ marginTop: 14 }}>
            <label htmlFor="program-launch-exception">Founder launch exception</label>
            <textarea id="program-launch-exception" value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} placeholder="Required only if leadership is intentionally accepting unresolved launch blockers." />
            <span className="ops-field__help">Only an administrator acting as founder can approve an exception.</span>
          </div>
        )}
        {(nextStage === "ready_to_launch" || nextStage === "active") && !readinessCanLaunch && !canApproveLaunchException && (
          <div className="ops-alert" data-tone="warning" style={{ marginTop: 14 }}>
            <span className="ops-alert__title">Launch blockers must be resolved</span>
            <p className="ops-body" style={{ marginTop: 4 }}>
              Your role can manage the operating plan but cannot approve a launch exception. Resolve readiness or ask a founder-authorized administrator to review the exact blockers.
            </p>
          </div>
        )}
        {error && <p className="ops-error" role="alert">{error}</p>}
        <div style={{ marginTop: 18 }}>
          <Button
            variant="emphasis"
            full
            disabled={busy || !nextStage || (decisionNoteRequired && stageNote.trim().length < 3) || ((nextStage === "ready_to_launch" || nextStage === "active") && !readinessCanLaunch && !canApproveLaunchException)}
            onClick={() => run(() => transitionProgram(programId, nextStage, stageNote, exceptionReason))}
          >
            {busy ? "Moving Program…" : `Move to ${programStageLabel(nextStage)}`}
          </Button>
        </div>
      </Modal>

      <Modal open={modal === "team"} onClose={close} title="Manage Delivery Team" maxWidth={620} dismissible={!busy}>
        <div className="ops-field">
          <label htmlFor="program-team-assignment">Current assignment</label>
          <select id="program-team-assignment" value={assignmentKey} onChange={(event) => setAssignmentKey(event.target.value)}>
            {assignedInstructors.map((assignment) => (
              <option key={`${assignment.classId}:${assignment.instructorId}`} value={`${assignment.classId}:${assignment.instructorId}`}>
                {assignment.name} · {assignment.role} · {assignment.classTitle}
              </option>
            ))}
          </select>
        </div>
        <div className="ops-alert" data-tone="warning" style={{ marginTop: 14 }}>
          <span className="ops-alert__title">Readiness recalculates immediately</span>
          <p className="ops-body" style={{ marginTop: 4 }}>Removing a lead will block launch until a qualified replacement is assigned.</p>
        </div>
        <div className="ops-field" style={{ marginTop: 14 }}>
          <label htmlFor="program-team-removal-reason">Removal decision record</label>
          <textarea
            id="program-team-removal-reason"
            value={removalReason}
            onChange={(event) => setRemovalReason(event.target.value)}
            placeholder="Why is this change necessary, and who owns replacement coverage or follow-up?"
          />
          <span className="ops-field__help">Required so staffing history remains useful to the next operator.</span>
        </div>
        {error && <p className="ops-error" role="alert">{error}</p>}
        <div style={{ marginTop: 18 }}>
          <Button
            variant="secondary"
            full
            disabled={busy || !selectedAssignment || removalReason.trim().length < 3}
            onClick={() => selectedAssignment && run(() => removeInstructorFromProgramClass(programId, selectedAssignment.classId, selectedAssignment.instructorId, removalReason))}
          >
            {busy ? "Removing…" : "Remove Selected Instructor"}
          </Button>
        </div>
      </Modal>

      <Modal open={modal === "attach"} onClose={close} title="Connect Existing Class" dismissible={!busy}>
        <div className="ops-field">
          <label htmlFor="program-existing-class">Unassigned Class</label>
          <select id="program-existing-class" value={unassignedClassId} onChange={(event) => setUnassignedClassId(event.target.value)}>
            {unassignedClasses.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.title} · {candidate.status.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        {error && <p className="ops-error" role="alert">{error}</p>}
        <div style={{ marginTop: 18 }}><Button variant="primary" full disabled={busy || !unassignedClassId} onClick={() => run(() => attachClassToProgram(programId, unassignedClassId))}>{busy ? "Connecting…" : "Connect Class"}</Button></div>
      </Modal>

      <Modal open={modal === "class"} onClose={close} title="Create Delivery Class" dismissible={!busy}>
        <p className="ops-body" style={{ marginBottom: 14 }}>
          The new Class inherits this Program&apos;s partner, Location, Curriculum, audience, dates, schedule, and capacity.
        </p>
        <div className="ops-field">
          <label htmlFor="program-class-title">Class title</label>
          <input id="program-class-title" value={classTitle} onChange={(event) => setClassTitle(event.target.value)} />
        </div>
        {error && <p className="ops-error" role="alert">{error}</p>}
        <div style={{ marginTop: 18 }}><Button variant="emphasis" full disabled={busy || !classTitle.trim()} onClick={() => run(() => createClassForProgram(programId, classTitle))}>{busy ? "Creating Class…" : "Create Delivery Class"}</Button></div>
      </Modal>

      <Modal open={modal === "assign"} onClose={close} title="Assign Instructor" maxWidth={620} dismissible={!busy}>
        <div className="ops-field">
          <label htmlFor="program-assignment-class">Delivery Class</label>
          <select
            id="program-assignment-class"
            value={classId}
            onChange={(event) => {
              const nextClassId = event.target.value;
              setClassId(nextClassId);
              setInstructorId(recommendationsByClass[nextClassId]?.[assignmentRole][0]?.instructorId ?? "");
              setStaffingDecision("");
            }}
          >
            {classes.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}
          </select>
        </div>
        <div className="ops-field" style={{ marginTop: 14 }}>
          <label htmlFor="program-assignment-role">Delivery role</label>
          <select
            id="program-assignment-role"
            value={assignmentRole}
            onChange={(event) => {
              const nextRole = event.target.value as "lead" | "additional";
              setAssignmentRole(nextRole);
              setInstructorId(recommendationsByClass[classId]?.[nextRole][0]?.instructorId ?? "");
              setStaffingDecision("");
            }}
          >
            <option value="lead">Lead instructor</option>
            <option value="additional">Additional instructor</option>
          </select>
        </div>
        <div className="ops-field" style={{ marginTop: 14 }}>
          <label htmlFor="program-assignment-instructor">Recommended instructor</label>
          <select id="program-assignment-instructor" value={instructorId} onChange={(event) => setInstructorId(event.target.value)}>
            {classRecommendations.map((recommendation) => (
              <option key={recommendation.instructorId} value={recommendation.instructorId}>
                #{recommendation.rank} {recommendation.name} · {recommendation.tier}
              </option>
            ))}
          </select>
        </div>
        {selectedRecommendation && (
          <div className="ops-alert" data-tone={selectedRecommendation.tier === "strong" ? "positive" : "warning"} style={{ marginTop: 14 }}>
            <span className="ops-alert__title">{selectedRecommendation.tier} fit</span>
            <p className="ops-body" style={{ marginTop: 4 }}>
              {selectedRecommendation.matches.join(" · ") || "No confirmed matches."}
              {selectedRecommendation.missing.length > 0 ? ` Missing: ${selectedRecommendation.missing.join(", ")}.` : ""}
              {selectedRecommendation.conflicts.length > 0 ? ` Review: ${selectedRecommendation.conflicts.join(", ")}.` : ""}
            </p>
          </div>
        )}
        {selectedRecommendation?.tier === "possible" && (
          <div className="ops-field" style={{ marginTop: 14 }}>
            <label htmlFor="program-staffing-decision">Staffing decision record</label>
            <textarea
              id="program-staffing-decision"
              value={staffingDecision}
              onChange={(event) => setStaffingDecision(event.target.value)}
              placeholder="Why is this assignment still the right decision, and how will the known conflict be managed?"
            />
            <span className="ops-field__help">Required whenever the recommendation has an unresolved conflict.</span>
          </div>
        )}
        {error && <p className="ops-error" role="alert">{error}</p>}
        <div style={{ marginTop: 18 }}><Button variant="emphasis" full disabled={busy || !classId || !instructorId || (selectedRecommendation?.tier === "possible" && !staffingDecision.trim())} onClick={() => run(() => assignInstructorToProgramClass(programId, classId, instructorId, assignmentRole, staffingDecision))}>{busy ? "Assigning…" : assignmentRole === "lead" ? "Assign as Lead Instructor" : "Assign as Additional Instructor"}</Button></div>
      </Modal>

      <Modal open={modal === "note"} onClose={close} title="Add Operating Note" dismissible={!busy}>
        <div className="ops-field">
          <label htmlFor="program-note">Note</label>
          <textarea id="program-note" value={operatingNote} onChange={(event) => setOperatingNote(event.target.value)} placeholder="Record the decision, commitment, blocker, or context the next operator needs." />
        </div>
        {error && <p className="ops-error" role="alert">{error}</p>}
        <div style={{ marginTop: 18 }}><Button variant="primary" full disabled={busy || !operatingNote.trim()} onClick={() => run(() => addProgramNote(programId, operatingNote))}>{busy ? "Saving Note…" : "Save Operating Note"}</Button></div>
      </Modal>

      <Modal open={modal === "complete"} onClose={close} title="Complete Program" maxWidth={620} accent="var(--bow-orange)" dismissible={!busy}>
        <p className="ops-body" style={{ marginBottom: 14 }}>
          Capture the outcome before closing delivery. This becomes the evidence used for renewal, expansion, and future planning.
        </p>
        <div className="ops-field">
          <label htmlFor="program-outcome">Outcome summary</label>
          <textarea id="program-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="What was delivered, what changed for students and the partner, what worked, and what should happen next." />
        </div>
        {error && <p className="ops-error" role="alert">{error}</p>}
        <div style={{ marginTop: 18 }}><Button variant="emphasis" full disabled={busy || !outcome.trim()} onClick={() => run(() => completeProgram(programId, outcome))}>{busy ? "Completing Program…" : "Complete and Start Outcome Review"}</Button></div>
      </Modal>

      <Modal open={modal === "continuation"} onClose={close} title={stage === "active" ? "Plan Expansion" : "Renew or Expand"} maxWidth={620} accent="var(--bow-orange)" dismissible={!busy}>
        <div className="ops-field">
          <label htmlFor="program-continuation-mode">Decision</label>
          <select id="program-continuation-mode" value={continuationMode} onChange={(event) => setContinuationMode(event.target.value as typeof continuationMode)} disabled={stage === "active"}>
            {stage !== "active" && <option value="renewal">Renew this Program</option>}
            <option value="expansion">Expand into a new plan or Location</option>
          </select>
        </div>
        <div className="ops-field" style={{ marginTop: 14 }}>
          <label htmlFor="program-continuation-name">New Program name</label>
          <input id="program-continuation-name" value={continuationName} onChange={(event) => setContinuationName(event.target.value)} placeholder={`${programName} — ${continuationMode === "renewal" ? "Renewal" : "Expansion"}`} />
        </div>
        {error && <p className="ops-error" role="alert">{error}</p>}
        <div style={{ marginTop: 18 }}><Button variant="emphasis" full disabled={busy} onClick={() => run(() => createProgramContinuation(programId, continuationMode, continuationName, continuationKey), (result) => router.push(result.id ? `/app/programs/${result.id}` : "/app/programs"))}>{busy ? "Creating Plan…" : continuationMode === "renewal" ? "Create Renewal Program" : "Create Expansion Program"}</Button></div>
      </Modal>

      <Modal open={modal === "continuationHold"} onClose={close} title="Hold Continuation" maxWidth={620} accent="var(--bow-orange)" dismissible={!busy}>
        <p className="ops-body" style={{ marginBottom: 14 }}>
          Delivery stays completed and immutable. The hold records why BOW is waiting and creates dated review Work so the decision cannot disappear.
        </p>
        <div className="ops-field">
          <label htmlFor="program-hold-reason">Hold decision and restart condition</label>
          <textarea
            id="program-hold-reason"
            value={holdReason}
            onChange={(event) => setHoldReason(event.target.value)}
            placeholder="Why are we waiting, what must change, and who needs to be consulted before renewal or expansion?"
          />
        </div>
        <div className="ops-field" style={{ marginTop: 14 }}>
          <label htmlFor="program-hold-review-date">Review date</label>
          <input
            id="program-hold-review-date"
            type="date"
            value={holdReviewDate}
            onChange={(event) => setHoldReviewDate(event.target.value)}
          />
          <span className="ops-field__help">The Program owner receives a continuation-review Work item on this date.</span>
        </div>
        {error && <p className="ops-error" role="alert">{error}</p>}
        <div style={{ marginTop: 18 }}>
          <Button
            variant="secondary"
            full
            disabled={busy || holdReason.trim().length < 3 || !holdReviewDate}
            onClick={() => run(() => holdProgramContinuation(programId, holdReason, holdReviewDate))}
          >
            {busy ? "Recording Hold…" : "Place Continuation on Hold"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
