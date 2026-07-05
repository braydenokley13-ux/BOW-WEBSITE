"use client";

/* ============================================================
 * NotebookTray — the notebook's presence across every analytics page.
 *
 * Collapsed: a small pill, fixed bottom-right, "Notebook · N". Stays
 * hidden entirely until the reader has clipped at least one thing or
 * written a hypothesis — a first-time reader shouldn't be nagged by
 * an empty tray before they've discovered clipping.
 *
 * Expanded: a slide-over panel (fixed, right edge, dark surface)
 * listing every clip newest-first with its stance, lens, and capture
 * time, a per-clip stance select and remove button, and a link to
 * the full /analytics/notebook workbench. Escape closes it. Rendered
 * in place — no portal needed since it's already fixed-position.
 * ============================================================ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNotebook } from "@/components/research/useNotebook";
import { formatClipAge } from "@/lib/notebook";
import { STANCE_LABELS, type Stance } from "@/lib/research-types";

const pillStyle: React.CSSProperties = {
  position: "fixed",
  right: 20,
  bottom: 20,
  zIndex: 60,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#fff",
  background: "var(--bow-ink)",
  border: "1px solid var(--bow-dark-border)",
  borderRadius: 999,
  padding: "10px 16px",
  cursor: "pointer",
  boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 70,
  width: "min(380px, 100vw)",
  display: "flex",
  flexDirection: "column",
  background: "var(--bow-ink)",
  color: "#fff",
  borderLeft: "1px solid var(--bow-dark-border)",
  boxShadow: "-12px 0 32px rgba(0,0,0,0.35)",
};

export default function NotebookTray() {
  const { notebook, clipCount, remove, setStance } = useNotebook();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const hasHypothesis = notebook.hypothesis.trim().length > 0;
  if (clipCount === 0 && !hasHypothesis) return null;

  const clips = [...notebook.clips].sort((a, b) => b.capturedAt - a.capturedAt);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={pillStyle} aria-label="Open notebook">
        Notebook · {clipCount}
      </button>
    );
  }

  return (
    <div style={panelStyle} role="dialog" aria-label="Research notebook">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 18px",
          borderBottom: "1px solid var(--bow-dark-border)",
        }}
      >
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Notebook · {clipCount}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close notebook"
          style={{ background: "none", border: "none", color: "#9a9da6", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 4 }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {clips.length === 0 ? (
          <p style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: "#9a9da6" }}>
            No clips yet. Look for &ldquo;+ Clip&rdquo; next to any verdict, scenario, or trade breakdown.
          </p>
        ) : (
          clips.map((clip) => (
            <div key={clip.id} style={{ border: "1px solid var(--bow-dark-border)", borderRadius: 3, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13.5, lineHeight: 1.4, color: "#fff" }}>
                {clip.title || "Untitled clip"}
              </p>
              {clip.detail && (
                <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 11.5, lineHeight: 1.5, color: "#9a9da6" }}>{clip.detail}</p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "#6d7078" }}>
                <span>{clip.lensName}</span>
                <span>{formatClipAge(clip.capturedAt)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <select
                  value={clip.stance}
                  onChange={(e) => setStance(clip.id, e.target.value as Stance)}
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-data)",
                    fontSize: 11.5,
                    background: "var(--bow-dark-surface)",
                    color: "#fff",
                    border: "1px solid var(--bow-dark-border)",
                    borderRadius: 2,
                    padding: "5px 6px",
                  }}
                >
                  {(Object.keys(STANCE_LABELS) as Stance[]).map((s) => (
                    <option key={s} value={s}>
                      {STANCE_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(clip.id)}
                  aria-label={`Remove clip: ${clip.title || "untitled"}`}
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    background: "none",
                    border: "1px solid var(--bow-dark-border)",
                    borderRadius: 2,
                    color: "#9a9da6",
                    padding: "5px 8px",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: "14px 18px", borderTop: "1px solid var(--bow-dark-border)" }}>
        <Link
          href="/analytics/notebook"
          onClick={() => setOpen(false)}
          style={{
            display: "block",
            textAlign: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#6f8bff",
            textDecoration: "none",
          }}
        >
          Open the workbench →
        </Link>
      </div>
    </div>
  );
}
