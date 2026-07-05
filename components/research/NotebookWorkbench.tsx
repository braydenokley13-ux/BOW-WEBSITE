"use client";

/* ============================================================
 * NotebookWorkbench — arrange clipped evidence into an argument.
 *
 * The client half of /analytics/notebook: a hypothesis bar, three
 * stance columns (supports / challenges / open) built from
 * STANCE_LABELS so the product's vocabulary never drifts from the
 * type contract, and a draft compiler that turns the whole notebook
 * into a paste-ready markdown draft via lib/notebook-draft.
 *
 * No drag-and-drop library — moving a clip between stances is a
 * plain <select>, same affordance as NotebookTray so the two never
 * teach the reader two different interactions for one action.
 * ============================================================ */

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Button } from "@/components/ds";
import { useNotebook } from "@/components/research/useNotebook";
import { draftFromNotebook } from "@/lib/notebook-draft";
import { formatClipAge } from "@/lib/notebook";
import { fmtMillions } from "@/lib/aasv";
import { STANCE_LABELS, type Clip, type Stance } from "@/lib/research-types";

const STANCE_ORDER = Object.keys(STANCE_LABELS) as Stance[];

const STANCE_ACCENT: Record<Stance, string> = {
  supports: "var(--bow-positive)",
  challenges: "var(--bow-negative)",
  open: "var(--bow-slate)",
};

const columnGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "clamp(14px,2vw,20px)",
  alignItems: "start",
};

const columnStyle: CSSProperties = {
  background: "var(--bow-white)",
  border: "1px solid var(--border-rule)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "clamp(14px,1.8vw,18px)",
  minHeight: 140,
};

const cardStyle: CSSProperties = {
  border: "1px solid var(--border-rule)",
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "var(--bow-paper)",
};

const monoMeta: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.03em",
  color: "var(--bow-slate)",
};

function ClipCard({ clip, onStance, onNote, onRemove }: {
  clip: Clip;
  onStance: (s: Stance) => void;
  onNote: (n: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ ...cardStyle, borderLeft: `3px solid ${STANCE_ACCENT[clip.stance]}` }}>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14.5, lineHeight: 1.4, color: "var(--bow-ink)" }}>
        {clip.title || "Untitled clip"}
      </p>
      {clip.detail && <p style={{ margin: 0, ...monoMeta, lineHeight: 1.5 }}>{clip.detail}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, ...monoMeta, textTransform: "uppercase" }}>
        <span>{clip.lensName} · {fmtMillions(clip.assumptions.dollarsPerWin)}/win</span>
        <span>{formatClipAge(clip.capturedAt)}</span>
      </div>

      <input
        value={clip.note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Why this matters to your argument…"
        style={{
          fontFamily: "var(--font-interface)",
          fontSize: 13,
          padding: "7px 9px",
          border: "1px solid var(--border-rule)",
          background: "var(--bow-white)",
          color: "var(--bow-ink)",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <select
          value={clip.stance}
          onChange={(e) => onStance(e.target.value as Stance)}
          style={{
            flex: "1 1 140px",
            fontFamily: "var(--font-data)",
            fontSize: 11.5,
            padding: "6px 7px",
            border: "1px solid var(--border-rule)",
            background: "var(--bow-white)",
            color: "var(--bow-ink)",
          }}
        >
          {STANCE_ORDER.map((s) => (
            <option key={s} value={s}>
              {STANCE_LABELS[s]}
            </option>
          ))}
        </select>
        <Link
          href={clip.sourcePath}
          style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-blue)" }}
        >
          Source →
        </Link>
        <button
          type="button"
          onClick={onRemove}
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            background: "none",
            border: "1px solid var(--border-rule)",
            color: "var(--bow-slate)",
            padding: "5px 8px",
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  const step: CSSProperties = { display: "flex", gap: 12, alignItems: "flex-start" };
  const num: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 20,
    color: "var(--bow-orange)",
    flex: "0 0 auto",
    lineHeight: 1,
  };
  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", padding: "clamp(20px,3vw,32px)", display: "flex", flexDirection: "column", gap: 18, maxWidth: 620 }}>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
        Nothing clipped yet. The notebook turns model output into an argument in three steps:
      </p>
      <div style={step}>
        <span style={num}>1</span>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55 }}>
          Adopt a lens on the <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>analytics dashboard</Link> — a
          named set of assumptions about what a win costs and how much the apron should scare you.
        </p>
      </div>
      <div style={step}>
        <span style={num}>2</span>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55 }}>
          Clip evidence — a verdict, a scenario band, a trade breakdown — from any player or team page, or from an{" "}
          <Link href="/analytics/questions" style={{ color: "var(--bow-blue)" }}>open research question</Link>. Every clip
          freezes both the numbers and the assumptions behind them.
        </p>
      </div>
      <div style={step}>
        <span style={num}>3</span>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55 }}>
          Come back here to arrange clips into supports / challenges / open, then compile the whole argument into a
          publication-ready draft.
        </p>
      </div>
    </div>
  );
}

export default function NotebookWorkbench() {
  const { notebook, clipCount, remove, setStance, setNote, setHypothesis, clear } = useNotebook();
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const columns: Record<Stance, Clip[]> = { supports: [], challenges: [], open: [] };
  for (const clip of notebook.clips) columns[clip.stance].push(clip);
  for (const s of STANCE_ORDER) columns[s].sort((a, b) => b.capturedAt - a.capturedAt);

  function handleCompile() {
    setDraft(draftFromNotebook(notebook));
  }

  async function handleCopy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the pre is still selectable by hand */
    }
  }

  function handleDownload() {
    if (!draft) return;
    const blob = new Blob([draft], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notebook-draft.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    if (confirm("Clear the notebook? This removes every clip and the working claim — it can't be undone.")) {
      clear();
      setDraft(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(24px,3.4vw,36px)" }}>
      {/* hypothesis bar */}
      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", padding: "clamp(16px,2.2vw,24px)", display: "flex", flexDirection: "column", gap: 8 }}>
        <label
          htmlFor="notebook-hypothesis"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}
        >
          Your working claim
        </label>
        <textarea
          id="notebook-hypothesis"
          value={notebook.hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder="e.g. The Celtics' second-apron roster is still a net asset through 2027."
          rows={2}
          style={{
            fontFamily: "var(--font-editorial)",
            fontSize: 17,
            lineHeight: 1.5,
            padding: "10px 12px",
            border: "1px solid var(--border-rule)",
            background: "var(--bow-paper)",
            color: "var(--bow-ink)",
            resize: "vertical",
          }}
        />
      </div>

      {/* stance columns */}
      {clipCount === 0 ? (
        <EmptyState />
      ) : (
        <div style={columnGrid}>
          {STANCE_ORDER.map((s) => (
            <div key={s} style={columnStyle}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: STANCE_ACCENT[s] }}>
                  {STANCE_LABELS[s]}
                </span>
                <span style={{ ...monoMeta }}>{columns[s].length}</span>
              </div>
              {columns[s].length === 0 ? (
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>Nothing here yet.</p>
              ) : (
                columns[s].map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    onStance={(next) => setStance(clip.id, next)}
                    onNote={(note) => setNote(clip.id, note)}
                    onRemove={() => remove(clip.id)}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {/* draft the piece */}
      <div style={{ background: "var(--bow-paper)", border: "1px solid var(--border-rule)", padding: "clamp(16px,2.2vw,24px)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
            Draft the piece
          </span>
          <Button size="sm" variant="ink" onClick={handleCompile} disabled={clipCount === 0}>
            Compile draft
          </Button>
        </div>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.55, color: "var(--bow-slate)" }}>
          The draft pastes straight into the publication&rsquo;s editor, and every embed inside it renders live data —
          nothing here is a screenshot.
        </p>
        {draft && (
          <>
            <pre
              style={{
                margin: 0,
                maxHeight: 360,
                overflow: "auto",
                background: "var(--bow-ink)",
                color: "#e4e4e7",
                fontFamily: "var(--font-data)",
                fontSize: 12.5,
                lineHeight: 1.6,
                padding: "14px 16px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {draft}
            </pre>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? "Copied" : "Copy markdown"}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDownload}>
                Download .md
              </Button>
            </div>
          </>
        )}
      </div>

      {/* clear */}
      <div>
        <button
          type="button"
          onClick={handleClear}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-data)",
            fontSize: 11.5,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--bow-slate)",
            padding: 0,
          }}
        >
          Clear notebook
        </button>
      </div>
    </div>
  );
}
