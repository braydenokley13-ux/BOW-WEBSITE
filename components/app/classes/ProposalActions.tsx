"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button, Modal } from "@/components/ds";
import { decideClassProposal, convertProposalToClass } from "@/app/actions/classes";

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  width: "100%",
  borderRadius: 4,
  marginBottom: 12,
};

interface Props {
  proposalId: string;
  status: "draft" | "submitted" | "approved" | "declined";
  convertedClassId: string | null;
  convertedProgramId: string | null;
  description: string | null;
  curricula: { id: string; title: string }[];
}

export default function ProposalActions({ proposalId, status, convertedClassId, convertedProgramId, description, curricula }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "decline" | "convert">(null);
  const [note, setNote] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; programId?: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (res.ok) {
        setModal(null);
        setBusy(false);
        if (res.programId) router.push(`/app/programs/${res.programId}`);
        else router.refresh();
      } else {
        setError(res.error || "Something went wrong.");
        setBusy(false);
      }
    } catch {
      setError("The operation could not be completed. Refresh and try again.");
      setBusy(false);
    }
  };

  if (status === "approved" && convertedClassId) {
    return (
      <Button href={convertedProgramId ? `/app/programs/${convertedProgramId}` : `/app/classes/${convertedClassId}`} variant="secondary" size="sm">
        {convertedProgramId ? "View Program" : "View Class"}
      </Button>
    );
  }

  return (
    <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {status === "submitted" && (
        <>
          <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => decideClassProposal(proposalId, "approved"))}>
            Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setModal("decline")}>
            Decline
          </Button>
        </>
      )}
      {status === "approved" && (
        <Button size="sm" variant="primary" onClick={() => setModal("convert")}>
          Create Program
        </Button>
      )}

      <Modal open={modal === "decline"} onClose={() => setModal(null)} title="Decline Proposal" dismissible={!busy}>
        {description && <p style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)", marginBottom: 12 }}>{description}</p>}
        <label htmlFor={`proposal-decline-${proposalId}`} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>Decision note</label>
        <textarea id={`proposal-decline-${proposalId}`} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
        <Button variant="primary" full disabled={busy} onClick={() => run(() => decideClassProposal(proposalId, "declined", note))}>
          {busy ? "Saving…" : "Decline"}
        </Button>
      </Modal>

      <Modal open={modal === "convert"} onClose={() => setModal(null)} title="Create Program from Proposal" dismissible={!busy}>
        <label htmlFor={`proposal-curriculum-${proposalId}`} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>
          Curriculum (optional — a placeholder is created if left blank)
        </label>
        <select id={`proposal-curriculum-${proposalId}`} style={inputStyle} value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)}>
          <option value="">Create placeholder curriculum</option>
          {curricula.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        {error && <p role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
        <Button variant="primary" full disabled={busy} onClick={() => run(() => convertProposalToClass(proposalId, curriculumId || undefined))}>
          {busy ? "Creating…" : "Create Program + Class"}
        </Button>
      </Modal>
    </div>
  );
}
