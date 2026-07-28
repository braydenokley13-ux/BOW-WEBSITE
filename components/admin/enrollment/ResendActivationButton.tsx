"use client";

import ConfirmSubmitButton from "./ConfirmSubmitButton";
import { resendActivation } from "@/app/actions/registration-admin";

export default function ResendActivationButton({ personId, guardianName }: { personId: string; guardianName: string }) {
  return (
    <ConfirmSubmitButton
      action={() => resendActivation(personId)}
      confirmMessage={`Resend an activation invitation to ${guardianName}?`}
      variant="secondary"
    >
      Resend activation
    </ConfirmSubmitButton>
  );
}
