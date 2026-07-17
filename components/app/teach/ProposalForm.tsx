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
  outline: "none",
  width: "100%",
  borderRadius: 4,
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
      <input placeholder="Title" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
      <input placeholder="Age group" style={inputStyle} value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} />
      <textarea placeholder="Description" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
      <div>
        <Button type="submit" size="sm" variant="primary" disabled={busy || !title.trim()}>
          {busy ? "Saving…" : "Save Draft"}
        </Button>
      </div>
    </form>
  );
}
