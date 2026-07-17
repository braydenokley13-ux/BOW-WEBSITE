"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { createFollowUpFromDemoRequest } from "@/app/actions/partners";

export default function DemoRequestActions({ demoRequestId }: { demoRequestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    const res = await createFollowUpFromDemoRequest(demoRequestId);
    if (res.ok) {
      router.refresh();
    } else {
      setError(res.error || "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <Button size="sm" variant="secondary" disabled={busy} onClick={run}>
        {busy ? "Creating…" : "Create Follow-up Task"}
      </Button>
      {error && <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)" }}>{error}</span>}
    </div>
  );
}
