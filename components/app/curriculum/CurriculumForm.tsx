"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import { createCurriculum, updateCurriculum } from "@/app/actions/curriculum";

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
    <form onSubmit={onSubmit} className="ops-form">
      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Curriculum details</h2>
          <p className="ops-form-section__help">The title, age range, and description classes will reference.</p>
        </div>
        <div className="ops-fields">
          <div className="ops-field ops-field--wide">
            <label htmlFor="cur-title">Title</label>
            <input id="cur-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="ops-field">
            <label htmlFor="cur-age">Age range</label>
            <input id="cur-age" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} placeholder="e.g. 8–12" />
          </div>
          {mode === "edit" && (
            <div className="ops-field">
              <span className="ops-field__label">Published</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-interface)", fontSize: 14, minHeight: 43 }}>
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} style={{ width: "auto" }} />
                Published
              </label>
            </div>
          )}
          <div className="ops-field ops-field--wide">
            <label htmlFor="cur-desc">Description</label>
            <textarea id="cur-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      </section>

      {error && <p className="ops-error">{error}</p>}

      <div className="ops-form-footer">
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? "Saving…" : mode === "create" ? "Create Curriculum" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
