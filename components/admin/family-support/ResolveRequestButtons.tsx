"use client";

import ReasonSubmitButton from "@/components/admin/enrollment/ReasonSubmitButton";
import { resolveFamilyRequest } from "@/app/actions/family-support";

export default function ResolveRequestButtons({
  requestId,
  kind,
  studentName,
}: {
  requestId: string;
  kind: string;
  studentName: string;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 6 }}>
      <ReasonSubmitButton
        action={(note) => resolveFamilyRequest(requestId, "approved", note)}
        promptLabel="Resolution note (what was done / will happen):"
        confirmMessage={`Marks this ${kind.replace("_", " ")} request approved.`}
        details={[{ label: "Child", value: studentName }, { label: "Resulting state", value: "Approved" }]}
        notice="None sent automatically — follow up with the family directly if needed."
        size="sm"
      >
        Approve
      </ReasonSubmitButton>
      <ReasonSubmitButton
        action={(note) => resolveFamilyRequest(requestId, "declined", note)}
        promptLabel="Why is this request declined? (kept on the record)"
        confirmMessage={`Marks this ${kind.replace("_", " ")} request declined.`}
        details={[{ label: "Child", value: studentName }, { label: "Resulting state", value: "Declined" }]}
        notice="None sent automatically — follow up with the family directly if needed."
        destructive
        size="sm"
        variant="ghost"
      >
        Decline
      </ReasonSubmitButton>
    </div>
  );
}
