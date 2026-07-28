"use client";

import ReasonSubmitButton from "@/components/admin/enrollment/ReasonSubmitButton";
import { addSupportNote } from "@/app/actions/family-support";

/**
 * "Contact family" from the first-session prep view — records the same
 * family_support_notes row (kind: 'contact') the Family Support Centre
 * writes, so a contact logged here shows up in that family's history too.
 */
export default function ContactFamilyButton({
  personId,
  studentId,
  programId,
  registrationId,
}: {
  personId?: string | null;
  studentId?: string | null;
  programId: string;
  registrationId?: string | null;
}) {
  return (
    <ReasonSubmitButton
      action={(note) => addSupportNote({ personId, studentId, programId, registrationId, note, kind: "contact" })}
      promptLabel="What did you tell the family?"
      confirmMessage="Logs that BOW staff reached out to this family, for the support history."
      title="Contact family"
      notice="No message is sent automatically — record what you said after contacting them directly."
      reversible
      confirmLabel="Log contact"
      variant="secondary"
    >
      Contact family
    </ReasonSubmitButton>
  );
}
