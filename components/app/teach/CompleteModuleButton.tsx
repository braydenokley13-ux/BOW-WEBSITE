"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { completeTrainingModule } from "@/app/actions/instructors";

export default function CompleteModuleButton({ instructorId, moduleId }: { instructorId: string; moduleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = async () => {
    setBusy(true);
    setError(null);
    const res = await completeTrainingModule(instructorId, moduleId);
    if (res.ok) router.refresh();
    else setError(res.error || "Something went wrong.");
    setBusy(false);
  };

  return (
    <div>
      <Button size="sm" variant="secondary" disabled={busy} onClick={complete}>
        {busy ? "Saving…" : "Mark complete"}
      </Button>
      {error && <p style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}
