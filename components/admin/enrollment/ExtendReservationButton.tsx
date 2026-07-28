"use client";

import ReasonSubmitButton from "./ReasonSubmitButton";
import { adminExtendReservation } from "@/app/actions/registration-admin";

export default function ExtendReservationButton({ registrationId }: { registrationId: string }) {
  return (
    <ReasonSubmitButton
      action={(reason) => adminExtendReservation(registrationId, 72, reason)}
      promptLabel="Reason for extending this reservation (72 hours added):"
      variant="ghost"
    >
      Extend 72h
    </ReasonSubmitButton>
  );
}
