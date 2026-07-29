"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ds";
import { createTrackAction } from "@/app/actions/website";

/** Create a track. It starts as a draft, so nothing appears publicly yet. */
export default function NewTrackForm() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const derivedSlug = (slug || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");

  return (
    <section style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "16px 18px", marginTop: 18 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
        Add a track
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 220px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
            Public title
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="301"
            style={{ padding: "9px 11px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", fontFamily: "var(--font-interface)", fontSize: 14.5 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: "1 1 220px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
            Web address
          </span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="track-301"
            style={{ padding: "9px 11px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", fontFamily: "var(--font-interface)", fontSize: 14.5 }}
          />
        </label>
        <Button
          onClick={() =>
            startTransition(async () => {
              const result = await createTrackAction({ publicTitle: title.trim(), slug: derivedSlug });
              setNotice(result.ok ? "Track created as a draft — open it to write the page." : result.error);
              if (result.ok) {
                setTitle("");
                setSlug("");
              }
            })
          }
          variant="secondary"
          size="sm"
          disabled={pending || !title.trim()}
        >
          {pending ? "Creating…" : "Create draft track"}
        </Button>
      </div>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--text-secondary)" }}>
        {derivedSlug ? `It will live at /programs/${derivedSlug} once published.` : "It starts as a draft and stays private until you publish it."}
      </p>
      {notice ? (
        <p role="status" style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 14 }}>{notice}</p>
      ) : null}
    </section>
  );
}
