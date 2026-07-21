"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { retryCandidateInvitation } from "@/app/actions/people-work";

export default function RetryCandidateInvitation({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const retry = async () => {
    setBusy(true); setMessage(null);
    const result = await retryCandidateInvitation(applicationId);
    setBusy(false);
    setMessage(result.ok ? "Replacement invitation queued." : result.error ?? "Retry failed.");
    if (result.ok) router.refresh();
  };
  return <div><Button size="sm" variant="emphasis" disabled={busy} onClick={retry}>{busy ? "Queuing…" : "Retry Invitation"}</Button>{message && <p role="status" className="ops-field__help" style={{ marginTop: 6 }}>{message}</p>}</div>;
}
