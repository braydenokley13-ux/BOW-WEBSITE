"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { publishHiringPackage } from "@/app/actions/people-work";

export default function PublishOpeningButton({ openingId }: { openingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publish = async () => {
    setBusy(true); setError(null);
    const result = await publishHiringPackage(openingId);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "The opening could not be published.");
    router.refresh();
  };
  return <div><Button size="sm" variant="emphasis" disabled={busy} onClick={publish}>{busy ? "Publishing…" : "Publish immutable V1"}</Button>{error && <p role="alert" className="ops-error">{error}</p>}</div>;
}
