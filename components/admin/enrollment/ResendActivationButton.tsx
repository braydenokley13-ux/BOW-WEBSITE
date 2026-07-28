"use client";

import ConfirmSubmitButton from "./ConfirmSubmitButton";
import { resendActivation } from "@/app/actions/registration-admin";

export default function ResendActivationButton({ personId, guardianName }: { personId: string; guardianName: string }) {
  return (
    <ConfirmSubmitButton
      action={() => resendActivation(personId)}
      confirmMessage="Sends a new activation invitation email. Any prior invitation link stops working once this is sent."
      details={[{ label: "Guardian", value: guardianName }]}
      notice="Guardian receives a new activation email."
      variant="secondary"
    >
      Resend activation
    </ConfirmSubmitButton>
  );
}
