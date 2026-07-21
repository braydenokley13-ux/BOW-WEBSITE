"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { retryCandidateCommunication } from "@/app/actions/people-work";

export default function RetryCandidateCommunication({ communicationId }: { communicationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = async () => {
    setBusy(true); setError(null);
    const result = await retryCandidateCommunication(communicationId);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "Retry could not be queued.");
    router.refresh();
  };
  return <div><Button size="sm" variant="secondary" disabled={busy} onClick={retry}>{busy ? "Queueing…" : "Retry email"}</Button>{error && <p role="alert" className="ops-error">{error}</p>}</div>;
}
