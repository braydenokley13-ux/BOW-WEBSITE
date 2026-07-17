"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { registerForTrainingSession } from "@/app/actions/training";

export default function RegisterSessionButton({ sessionId, instructorId }: { sessionId: string; instructorId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = async () => {
    setBusy(true);
    setError(null);
    const res = await registerForTrainingSession(sessionId, instructorId);
    if (res.ok) router.refresh();
    else setError(res.error || "Something went wrong.");
    setBusy(false);
  };

  return (
    <div>
      <Button size="sm" variant="secondary" disabled={busy} onClick={register}>
        {busy ? "Registering…" : "Register"}
      </Button>
      {error && <p style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)", margin: "4px 0 0" }}>{error}</p>}
    </div>
  );
}
