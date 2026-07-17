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
  outline: "none",
  width: "100%",
  borderRadius: 4,
  marginBottom: 12,
};

interface Props {
  proposalId: string;
  status: "draft" | "submitted" | "approved" | "declined";
  convertedClassId: string | null;
  description: string | null;
  curricula: { id: string; title: string }[];
}

export default function ProposalActions({ proposalId, status, convertedClassId, description, curricula }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "decline" | "convert">(null);
  const [note, setNote] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    if (res.ok) {
      setModal(null);
      setBusy(false);
      router.refresh();
    } else {
      setError(res.error || "Something went wrong.");
      setBusy(false);
    }
  };

  if (status === "approved" && convertedClassId) {
    return (
      <Button href={`/app/classes/${convertedClassId}`} variant="secondary" size="sm">
        View Class
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
          Convert to Class
        </Button>
      )}

      <Modal open={modal === "decline"} onClose={() => setModal(null)} title="Decline Proposal">
        {description && <p style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)", marginBottom: 12 }}>{description}</p>}
        <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
        <Button variant="primary" full disabled={busy} onClick={() => run(() => decideClassProposal(proposalId, "declined", note))}>
          {busy ? "Saving…" : "Decline"}
        </Button>
      </Modal>

      <Modal open={modal === "convert"} onClose={() => setModal(null)} title="Convert to Class">
        <label style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>
          Curriculum (optional — a placeholder is created if left blank)
        </label>
        <select style={inputStyle} value={curriculumId} onChange={(e) => setCurriculumId(e.target.value)}>
          <option value="">Create placeholder curriculum</option>
          {curricula.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        {error && <p style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
        <Button variant="primary" full disabled={busy} onClick={() => run(() => convertProposalToClass(proposalId, curriculumId || undefined))}>
          {busy ? "Converting…" : "Convert"}
        </Button>
      </Modal>
    </div>
  );
}
