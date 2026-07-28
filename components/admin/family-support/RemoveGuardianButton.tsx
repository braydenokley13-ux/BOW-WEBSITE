"use client";

import ReasonSubmitButton from "@/components/admin/enrollment/ReasonSubmitButton";
import { removeGuardianFromStudent } from "@/app/actions/family-support";

export default function RemoveGuardianButton({
  studentId,
  personId,
  guardianName,
  studentName,
}: {
  studentId: string;
  personId: string;
  guardianName: string;
  studentName: string;
}) {
  return (
    <ReasonSubmitButton
      action={(reason) => removeGuardianFromStudent(studentId, personId, reason)}
      promptLabel="Reason for removing this guardian's access:"
      confirmMessage="Revokes this guardian's access immediately. Their history stays on the record; the link can be re-added later."
      details={[
        { label: "Guardian", value: guardianName },
        { label: "Child", value: studentName },
        { label: "Current state", value: "Active guardian" },
        { label: "Resulting state", value: "Revoked" },
      ]}
      notice={null}
      reversible
      reversibleNote="the guardian can be re-added"
      destructive
      size="sm"
      variant="ghost"
    >
      Remove
    </ReasonSubmitButton>
  );
}
