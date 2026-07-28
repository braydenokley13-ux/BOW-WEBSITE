"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ds/Button";
import { duplicateProgramSetup } from "@/app/actions/program-setup";

export default function DuplicateSetupButton({ sourceProgramId }: { sourceProgramId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Duplicate this program's setup and requirements into a new draft program?")) return;
          startTransition(async () => {
            const result = await duplicateProgramSetup(sourceProgramId);
            if (!result.ok || !result.newProgramId) {
              setError(result.error ?? "Could not duplicate this program.");
              return;
            }
            router.push(`/app/programs/${result.newProgramId}/setup`);
          });
        }}
      >
        {pending ? "Duplicating…" : "Duplicate as new draft"}
      </Button>
      {error && <span style={{ fontSize: 12, color: "var(--bow-red, #b3261e)" }}>{error}</span>}
    </div>
  );
}
