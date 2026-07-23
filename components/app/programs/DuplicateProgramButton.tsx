"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { duplicateProgram } from "@/app/actions/programs";

export default function DuplicateProgramButton({ programId }: { programId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    const result = await duplicateProgram(programId);
    if (!result.ok || !result.id) {
      setError(result.error ?? "Could not duplicate this Program.");
      setBusy(false);
      return;
    }
    router.push(`/app/programs/${result.id}`);
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <Button variant="secondary" disabled={busy} onClick={run}>
        {busy ? "Duplicating…" : "Duplicate"}
      </Button>
      {error && <span className="ops-error" role="alert">{error}</span>}
    </div>
  );
}
