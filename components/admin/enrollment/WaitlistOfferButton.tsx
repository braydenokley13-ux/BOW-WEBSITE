"use client";

import ReasonSubmitButton from "./ReasonSubmitButton";
import { adminSendManualOffer } from "@/app/actions/registration-admin";

export default function WaitlistOfferButton({ registrationId, studentName }: { registrationId: string; studentName: string }) {
  return (
    <ReasonSubmitButton
      action={(reason) => adminSendManualOffer(registrationId, reason)}
      promptLabel={`Internal reason for offering this seat to ${studentName}'s family:`}
      confirmMessage="Takes a seat immediately and starts the offer's expiration clock."
      details={[
        { label: "Child", value: studentName },
        { label: "Current state", value: "Waitlisted" },
        { label: "Resulting state", value: "Offer sent (holds a seat)" },
        { label: "Capacity consequence", value: "1 seat taken from availability" },
      ]}
      notice="Family is emailed the offer and its expiration deadline."
    >
      Offer seat
    </ReasonSubmitButton>
  );
}
