"use client";

import ReasonSubmitButton from "./ReasonSubmitButton";
import { adminSendManualOffer } from "@/app/actions/registration-admin";

export default function WaitlistOfferButton({ registrationId, studentName }: { registrationId: string; studentName: string }) {
  return (
    <ReasonSubmitButton
      action={(reason) => adminSendManualOffer(registrationId, reason)}
      promptLabel={`Internal reason for offering this seat to ${studentName}'s family:`}
      confirmMessage={`Send a waitlist offer to ${studentName}'s family? This takes a seat and starts the offer's expiration clock.`}
    >
      Offer seat
    </ReasonSubmitButton>
  );
}
