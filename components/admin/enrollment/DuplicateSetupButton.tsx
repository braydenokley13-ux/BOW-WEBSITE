"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ds/Button";
import ActionDialog from "@/components/admin/dialogs/ActionDialog";
import { duplicateProgramSetup } from "@/app/actions/program-setup";

export default function DuplicateSetupButton({ sourceProgramId, programName }: { sourceProgramId: string; programName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? "Duplicating…" : "Duplicate as new draft"}
      </Button>
      <ActionDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          new Promise((resolve) => {
            startTransition(async () => {
              const result = await duplicateProgramSetup(sourceProgramId);
              if (!result.ok || !result.newProgramId) {
                resolve({ ok: false, error: result.error ?? "Could not duplicate this program." });
                return;
              }
              resolve({ ok: true });
              router.push(`/app/programs/${result.newProgramId}/setup`);
            });
          })
        }
        title="Duplicate program setup"
        description="Creates a new draft program that copies this program's basics, schedule, capacity, requirements, and communication setup. Registrations, roster, and history are not copied."
        details={[{ label: "Source program", value: programName ?? sourceProgramId }, { label: "Resulting state", value: "New program in Draft" }]}
        notice={null}
        reversible
        reversibleNote="the new draft can be deleted before it opens registration"
        confirmLabel="Duplicate as new draft"
      />
    </>
  );
}
