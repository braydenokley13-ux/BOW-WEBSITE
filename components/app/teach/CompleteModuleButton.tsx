"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { completeTrainingModule } from "@/app/actions/instructors";

export default function CompleteModuleButton({ instructorId, moduleId, disabled = false }: { instructorId: string; moduleId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await completeTrainingModule(instructorId, moduleId);
      if (res.ok) router.refresh();
      else setError(res.error || "The module could not be completed.");
    } catch {
      setError("The module could not be completed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button size="sm" variant="secondary" disabled={busy || disabled} onClick={complete}>
        {busy ? "Saving…" : "Mark complete"}
      </Button>
      {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}
