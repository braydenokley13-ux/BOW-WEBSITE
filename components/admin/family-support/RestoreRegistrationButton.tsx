"use client";

import ReasonSubmitButton from "@/components/admin/enrollment/ReasonSubmitButton";
import { restoreRegistrationChecked } from "@/app/actions/family-support";
import type { RestoreCheck } from "@/lib/program-operations";

/**
 * `check` is computed server-side (getRestoreCheck) before render, so the
 * dialog shows the honest resulting state — waitlisted if no seat is free —
 * instead of promising a seat that may not exist. The mutation re-checks the
 * same rule under lock, so this display can go stale without becoming unsafe.
 */
export default function RestoreRegistrationButton({
  registrationId,
  studentName,
  programName,
  check,
}: {
  registrationId: string;
  studentName: string;
  programName: string;
  check: RestoreCheck;
}) {
  if (!check.eligible) {
    return <span style={{ fontSize: 12, color: "var(--bow-slate)" }}>Cannot restore — {check.reason}</span>;
  }
  return (
    <ReasonSubmitButton
      action={(reason) => restoreRegistrationChecked(registrationId, reason)}
      promptLabel="Reason for restoring this registration:"
      confirmMessage="Re-checks capacity at the moment this runs — the resulting state below reflects what was true when the page loaded."
      details={[
        { label: "Child", value: studentName },
        { label: "Program", value: programName },
        { label: "Resulting state", value: check.targetStatus === "waitlisted" ? "Waitlisted (no seat free)" : "Under review (seat available)" },
      ]}
      notice={null}
      size="sm"
    >
      Restore registration
    </ReasonSubmitButton>
  );
}
