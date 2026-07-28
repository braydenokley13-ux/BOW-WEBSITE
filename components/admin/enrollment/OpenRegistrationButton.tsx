"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";
import ActionDialog from "@/components/admin/dialogs/ActionDialog";
import { openRegistration } from "@/app/actions/program-setup";

/**
 * Blockers stop the action outright; an authorized override requires typing
 * why the risk is acceptable, recorded on the program the same way the
 * delivery-side launch exception is. Two distinct dialogs so a clean open
 * never reads like a risky override, and an override never reads like a
 * routine confirmation.
 */
export default function OpenRegistrationButton({
  programId,
  programName,
  hasBlockers,
  blockerLabels = [],
  capacity,
}: {
  programId: string;
  programName?: string;
  hasBlockers: boolean;
  blockerLabels?: string[];
  capacity?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (overrideReason: string | null) =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      startTransition(async () => {
        resolve(await openRegistration(programId, { overrideReason }));
      });
    });

  return (
    <>
      <Button type="button" variant={hasBlockers ? "ghost" : "primary"} size="sm" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? "Opening…" : hasBlockers ? "Open registration anyway (override)" : "Open registration"}
      </Button>
      <ActionDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={(reason) => run(hasBlockers ? reason : "")}
        title={hasBlockers ? "Open registration with an override" : "Open registration"}
        description={
          hasBlockers
            ? "This program has unresolved readiness blockers. Opening anyway makes registration publicly available while those blockers stand — the override reason is recorded on the program's audit trail."
            : "Families will be able to submit registrations for this program immediately."
        }
        details={[
          { label: "Program", value: programName ?? programId },
          { label: "Current state", value: "Registration closed" },
          { label: "Resulting state", value: "Registration open" },
          ...(capacity != null ? [{ label: "Capacity", value: `${capacity} seats` }] : []),
          ...(hasBlockers ? [{ label: "Unresolved blockers", value: blockerLabels.join(", ") || "See readiness list" }] : []),
        ]}
        notice="None automatically — families will discover the open program on the public listing."
        reversible
        reversibleNote="registration can be closed again at any time"
        requireReason={hasBlockers}
        reasonLabel="Override reason (required, recorded on the program)"
        destructive={hasBlockers}
        confirmLabel={hasBlockers ? "Open anyway" : "Open registration"}
      />
    </>
  );
}
