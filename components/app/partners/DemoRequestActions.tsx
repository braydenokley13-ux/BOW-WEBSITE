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
    try {
      const res = await createFollowUpFromDemoRequest(demoRequestId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error || "The follow-up task could not be created.");
      }
    } catch {
      setError("The follow-up task could not be created. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
        <Button
          size="sm"
          variant="emphasis"
          disabled={busy}
          href={`/app/programs/new?source=demo_request&sourceId=${encodeURIComponent(demoRequestId)}`}
        >
          Create Program
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={run}>
          {busy ? "Creating…" : "Create Follow-up Task"}
        </Button>
      </div>
      {error && <span role="alert" className="ops-error" style={{ maxWidth: 320, textAlign: "right" }}>{error}</span>}
    </div>
  );
}
