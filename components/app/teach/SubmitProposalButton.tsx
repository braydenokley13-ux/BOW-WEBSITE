"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { submitClassProposal } from "@/app/actions/classes";

export default function SubmitProposalButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await submitClassProposal(proposalId);
        router.refresh();
      }}
    >
      {busy ? "Submitting…" : "Submit"}
    </Button>
  );
}
