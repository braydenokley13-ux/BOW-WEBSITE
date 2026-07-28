"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";
import { openRegistration } from "@/app/actions/program-setup";

/**
 * Blockers stop the action outright; an authorized override requires typing
 * why the risk is acceptable, recorded on the program the same way the
 * delivery-side launch exception is.
 */
export default function OpenRegistrationButton({ programId, hasBlockers }: { programId: string; hasBlockers: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <Button
        type="button"
        variant={hasBlockers ? "ghost" : "primary"}
        size="sm"
        disabled={pending}
        onClick={() => {
          let overrideReason: string | null = null;
          if (hasBlockers) {
            overrideReason = window.prompt(
              "Registration has blockers. Opening anyway requires an override reason that will be recorded — leave blank to cancel:",
            );
            if (!overrideReason || !overrideReason.trim()) return;
          } else if (!window.confirm("Open registration for this program? Families will be able to register.")) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await openRegistration(programId, { overrideReason });
            if (!result.ok) setError(result.error ?? "Could not open registration.");
          });
        }}
      >
        {pending ? "Opening…" : hasBlockers ? "Open registration anyway (override)" : "Open registration"}
      </Button>
      {error && <span style={{ fontSize: 12, color: "var(--bow-red, #b3261e)" }}>{error}</span>}
    </div>
  );
}
