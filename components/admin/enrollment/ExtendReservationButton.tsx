"use client";

import ReasonSubmitButton from "./ReasonSubmitButton";
import { adminExtendReservation } from "@/app/actions/registration-admin";

export default function ExtendReservationButton({
  registrationId,
  studentName,
  currentDeadline,
}: {
  registrationId: string;
  studentName?: string;
  currentDeadline?: string;
}) {
  return (
    <ReasonSubmitButton
      action={(reason) => adminExtendReservation(registrationId, 72, reason)}
      promptLabel="Reason for extending this reservation (72 hours added):"
      confirmMessage="Adds 72 hours to the reservation deadline before the seat auto-releases."
      details={[
        ...(studentName ? [{ label: "Child", value: studentName }] : []),
        ...(currentDeadline ? [{ label: "Current deadline", value: currentDeadline }] : []),
        { label: "Resulting deadline", value: "+ 72 hours" },
      ]}
      notice={null}
      variant="ghost"
    >
      Extend 72h
    </ReasonSubmitButton>
  );
}
