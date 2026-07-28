"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { proposeAssignment } from "@/app/actions/delivery";
import { ASSIGNMENT_ROLES, assignmentRoleLabel } from "@/lib/delivery-shared";

interface Props {
  classId: string;
  className: string;
  instructors: { id: string; name: string }[];
}

/** Offers a class to an instructor. Surfaces schedule conflicts before committing, per proposeAssignment's contract. */
export default function ProposeAssignmentForm({ classId, className, instructors }: Props) {
  const router = useRouter();
  const [instructorId, setInstructorId] = useState(instructors[0]?.id ?? "");
  const [role, setRole] = useState<(typeof ASSIGNMENT_ROLES)[number]>("lead");
  const [expectedCommitment, setExpectedCommitment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[] | null>(null);

  const submit = async (acknowledgeConflicts: boolean) => {
    if (!instructorId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await proposeAssignment({
        classId,
        instructorId,
        role,
        expectedCommitment: expectedCommitment || undefined,
        startDate: startDate || undefined,
        acknowledgeConflicts,
      });
      if (!result.ok) {
        setError(result.error ?? "That assignment could not be proposed.");
        setConflicts(result.conflicts ?? null);
        setBusy(false);
        return;
      }
      setConflicts(null);
      setExpectedCommitment("");
      setStartDate("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("The action was interrupted before it could be confirmed. Please retry.");
      setBusy(false);
    }
  };

  if (instructors.length === 0) {
    return <p className="ops-record-meta">No instructor has cleared readiness yet, so none can be proposed for {className}.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      <div className="ops-field">
        <label htmlFor={`propose-instructor-${classId}`}>Instructor</label>
        <select id={`propose-instructor-${classId}`} value={instructorId} onChange={(event) => setInstructorId(event.target.value)}>
          {instructors.map((instructor) => (
            <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
          ))}
        </select>
      </div>
      <div className="ops-field">
        <label htmlFor={`propose-role-${classId}`}>Role</label>
        <select id={`propose-role-${classId}`} value={role} onChange={(event) => setRole(event.target.value as (typeof ASSIGNMENT_ROLES)[number])}>
          {ASSIGNMENT_ROLES.map((r) => (
            <option key={r} value={r}>{assignmentRoleLabel(r)}</option>
          ))}
        </select>
      </div>
      <div className="ops-field">
        <label htmlFor={`propose-commitment-${classId}`}>Expected commitment (optional)</label>
        <input
          id={`propose-commitment-${classId}`}
          type="text"
          value={expectedCommitment}
          onChange={(event) => setExpectedCommitment(event.target.value)}
          placeholder="e.g. Every Tuesday for the semester"
        />
      </div>
      <div className="ops-field">
        <label htmlFor={`propose-start-${classId}`}>Start date (optional)</label>
        <input id={`propose-start-${classId}`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      </div>

      {conflicts && conflicts.length > 0 && (
        <div className="ops-alert" data-tone="warning">
          <span className="ops-alert__title">Schedule conflicts</span>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {conflicts.map((c) => (
              <li key={c} className="ops-body">{c}</li>
            ))}
          </ul>
          <div style={{ marginTop: 10 }}>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => submit(true)}>
              {busy ? "Assigning…" : "Assign anyway"}
            </Button>
          </div>
        </div>
      )}
      {error && !conflicts && <p className="ops-error" role="alert">{error}</p>}

      <Button variant="emphasis" size="sm" disabled={busy || !instructorId} onClick={() => submit(false)}>
        {busy ? "Proposing…" : "Propose assignment"}
      </Button>
    </div>
  );
}
