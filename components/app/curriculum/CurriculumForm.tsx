"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { createCurriculum, updateCurriculum } from "@/app/actions/curriculum";

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

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
  display: "block",
  marginBottom: 6,
};

interface Props {
  mode: "create" | "edit";
  curriculumId?: string;
  initial?: { title: string; description: string; ageRange: string; published: boolean };
}

export default function CurriculumForm({ mode, curriculumId, initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [ageRange, setAgeRange] = useState(initial?.ageRange ?? "");
  const [published, setPublished] = useState(initial?.published ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      mode === "create"
        ? await createCurriculum({ title, description, ageRange })
        : await updateCurriculum(curriculumId!, { title, description, ageRange, published });
    if (res.ok) {
      if (mode === "create" && "id" in res && res.id) router.push(`/app/curriculum/${res.id}`);
      else router.refresh();
    } else {
      setError(res.error ?? "Something went wrong.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
      <div>
        <label style={labelStyle} htmlFor="cur-title">Title</label>
        <input id="cur-title" style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label style={labelStyle} htmlFor="cur-age">Age range</label>
        <input id="cur-age" style={inputStyle} value={ageRange} onChange={(e) => setAgeRange(e.target.value)} placeholder="e.g. 8–12" />
      </div>
      <div>
        <label style={labelStyle} htmlFor="cur-desc">Description</label>
        <textarea id="cur-desc" rows={4} style={{ ...inputStyle, resize: "vertical" }} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {mode === "edit" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-interface)", fontSize: 13 }}>
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
      )}
      {error && <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)" }}>{error}</p>}
      <div>
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create Curriculum" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
