"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { submitClassProposal } from "@/app/actions/classes";

export default function SubmitProposalButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const result = await submitClassProposal(proposalId);
            if (!result.ok) {
              setError(result.error ?? "The proposal could not be submitted.");
              return;
            }
            router.refresh();
          } catch {
            setError("The proposal could not be submitted. Refresh and try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Submitting…" : "Submit"}
      </Button>
      {error && <p role="alert" style={{ margin: "4px 0 0", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-negative)" }}>{error}</p>}
    </div>
  );
}
