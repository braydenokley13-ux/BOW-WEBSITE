"use client";

import ConfirmSubmitButton from "@/components/admin/enrollment/ConfirmSubmitButton";
import { retryDelivery } from "@/app/actions/family-notifications";

export default function RetryDeliveryButton({
  notificationId,
  title,
  studentName,
  alreadySent,
  attempts,
}: {
  notificationId: string;
  title: string;
  studentName: string | null;
  alreadySent: boolean;
  attempts: number;
}) {
  return (
    <ConfirmSubmitButton
      action={async () => {
        const result = await retryDelivery(notificationId);
        return { ok: result.ok, error: result.error };
      }}
      confirmMessage={
        alreadySent
          ? "This message already shows delivered — retrying sends a second copy to the same family."
          : "Attempts delivery again with the current guardian email on file."
      }
      details={[
        { label: "Message", value: title },
        ...(studentName ? [{ label: "Child", value: studentName }] : []),
        { label: "Prior attempts", value: attempts },
      ]}
      notice="Family receives the email if delivery succeeds this time."
      reversible={false}
      variant={alreadySent ? "ghost" : "secondary"}
      size="sm"
    >
      Retry
    </ConfirmSubmitButton>
  );
}
