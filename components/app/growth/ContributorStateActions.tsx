"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  closeGrowthAssignment,
  updateGrowthContributorStatus,
} from "@/app/actions/growth";
import { Button, Modal } from "@/components/ds";

type ContributorStatus = "candidate" | "active" | "paused" | "alumni";

interface Props {
  contributorId: string;
  contributorName: string;
  contributorStatus: ContributorStatus;
  contributorUpdatedAt: number;
  assignmentId: string | null;
  assignmentStartsOn: string | null;
  assignmentUpdatedAt: number | null;
  today: string;
}

const statusTransitions: Record<ContributorStatus, Array<"active" | "paused" | "alumni">> = {
  candidate: [],
  active: ["paused", "alumni"],
  paused: ["active", "alumni"],
  alumni: [],
};

export default function ContributorStateActions({
  contributorId,
  contributorName,
  contributorStatus,
  contributorUpdatedAt,
  assignmentId,
  assignmentStartsOn,
  assignmentUpdatedAt,
  today,
}: Props) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState<"completed" | "cancelled">("completed");
  const [nextContributorStatus, setNextContributorStatus] = useState<"active" | "paused" | "alumni">(
    statusTransitions[contributorStatus][0] ?? "active",
  );
  const assignment = assignmentId && assignmentStartsOn && assignmentUpdatedAt != null
    ? { id: assignmentId, startsOn: assignmentStartsOn, updatedAt: assignmentUpdatedAt }
    : null;
  const managesAssignment = assignment !== null;
  const availableStatuses = statusTransitions[contributorStatus];

  if (!managesAssignment && availableStatuses.length === 0) return null;

  const reset = () => {
    setError(null);
    setAssignmentStatus("completed");
    setNextContributorStatus(availableStatuses[0] ?? "active");
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    reset();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = assignment
        ? await closeGrowthAssignment({
          id: assignment.id,
          expectedUpdatedAt: assignment.updatedAt,
          status: assignmentStatus,
          endsOn: String(form.get("effectiveOn") ?? ""),
          closureReason: String(form.get("reason") ?? ""),
        })
        : await updateGrowthContributorStatus({
          id: contributorId,
          expectedUpdatedAt: contributorUpdatedAt,
          nextStatus: nextContributorStatus,
          effectiveOn: String(form.get("effectiveOn") ?? ""),
          reason: String(form.get("reason") ?? ""),
        });
      if (!result.ok) {
        setError(result.error ?? "BOW could not save this contributor lifecycle decision.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("BOW could not save this contributor lifecycle decision. Nothing changed; try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {managesAssignment ? "Manage role" : "Update status"}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={managesAssignment ? `Close ${contributorName}'s role` : `Update ${contributorName}`}
        maxWidth={600}
        dismissible={!busy}
      >
        <form className="ops-form" onSubmit={submit}>
          <fieldset className="ops-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="ops-field ops-field--wide">
              <label htmlFor={`growth-contributor-state-${contributorId}`}>
                {managesAssignment ? "Assignment outcome" : "Contributor status"}
              </label>
              {managesAssignment ? (
                <select
                  id={`growth-contributor-state-${contributorId}`}
                  value={assignmentStatus}
                  onChange={(event) => setAssignmentStatus(event.target.value as "completed" | "cancelled")}
                >
                  <option value="completed">Completed / role transition</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              ) : (
                <select
                  id={`growth-contributor-state-${contributorId}`}
                  value={nextContributorStatus}
                  onChange={(event) => setNextContributorStatus(event.target.value as "active" | "paused" | "alumni")}
                >
                  {availableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              )}
            </div>
            <div className="ops-field">
              <label htmlFor={`growth-contributor-effective-${contributorId}`}>Effective date</label>
              <input
                id={`growth-contributor-effective-${contributorId}`}
                name="effectiveOn"
                type="date"
                required
                min={assignment?.startsOn}
                max={today}
                defaultValue={today}
              />
            </div>
            <div className="ops-field ops-field--wide">
              <label htmlFor={`growth-contributor-reason-${contributorId}`}>Decision reason</label>
              <textarea
                id={`growth-contributor-reason-${contributorId}`}
                name="reason"
                required
                minLength={10}
                maxLength={1000}
                rows={4}
              />
              <span className="ops-field__help">
                This closes or changes the current lifecycle state; prior assignments and impact remain historical evidence.
              </span>
            </div>
          </fieldset>
          {error && <p className="ops-error" role="alert">{error}</p>}
          <div className="ops-form-footer">
            <Button variant="secondary" disabled={busy} onClick={close}>Keep current</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save Decision"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
