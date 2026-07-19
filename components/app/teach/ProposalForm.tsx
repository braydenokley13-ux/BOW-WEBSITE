"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { createClassProposal } from "@/app/actions/classes";

const inputStyle: CSSProperties = {
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: "10px 12px",
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  width: "100%",
  borderRadius: 4,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
};

export default function ProposalForm({ instructorId }: { instructorId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await createClassProposal(instructorId, { title, ageGroup, description });
    if (res.ok) {
      setTitle("");
      setAgeGroup("");
      setDescription("");
      router.refresh();
    } else setError(res.error || "Something went wrong.");
    setBusy(false);
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label htmlFor="proposal-title" style={labelStyle}>Proposal title</label>
        <input id="proposal-title" required placeholder="Title" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="proposal-age-group" style={labelStyle}>Age group</label>
        <input id="proposal-age-group" placeholder="Age group" style={inputStyle} value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} />
      </div>
      <div>
        <label htmlFor="proposal-description" style={labelStyle}>Description</label>
        <textarea id="proposal-description" placeholder="Description" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <p role="alert" style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
      <div>
        <Button type="submit" size="sm" variant="primary" disabled={busy || !title.trim()}>
          {busy ? "Saving…" : "Save Draft"}
        </Button>
      </div>
    </form>
  );
}
