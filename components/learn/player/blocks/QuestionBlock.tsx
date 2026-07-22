"use client";

/* ============================================================
 * components/learn/player/blocks/QuestionBlock.tsx — Stage 6 knowledge
 * question players: multi_select, true_false, numeric, short_response,
 * long_text (reflection). These share the schema+engine grading already
 * shipped in Stage 1 (lib/learn/schema.ts, lib/learn/engine.ts) — Stage 6
 * closes the gap by adding the missing Player surface. Knowledge checks
 * stay correct/incorrect (per the plan's knowledge-vs-decision principle);
 * long_text/manual_review renders as "submitted, pending review" and never
 * pretends to auto-grade open reflection.
 * ============================================================ */

import { useState } from "react";
import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type QuestionBlockT = Extract<
  Block,
  { type: "multi_select" | "true_false" | "numeric" | "short_response" | "long_text" }
>;

export default function QuestionBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<QuestionBlockT>) {
  const [draftText, setDraftText] = useState("");

  if (block.type === "multi_select") {
    const chosen = Array.isArray(value) ? (value as string[]) : [];
    const correctSet = new Set(block.correctOptionIds);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {block.options.map((opt) => {
            const isSelected = chosen.includes(opt.id);
            const showCorrect = committed && correctSet.has(opt.id);
            const showWrong = committed && isSelected && !correctSet.has(opt.id);
            return (
              <label
                key={opt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  padding: "12px 16px",
                  borderRadius: 4,
                  border: `1px solid ${showCorrect ? "var(--bow-positive)" : showWrong ? "var(--bow-negative)" : isSelected ? "var(--bow-blue)" : "var(--border-rule)"}`,
                  background: showCorrect ? "rgba(50,140,90,0.1)" : showWrong ? "rgba(180,40,40,0.08)" : isSelected ? "rgba(30,90,180,0.06)" : "var(--bow-white)",
                  cursor: committed ? "default" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  disabled={committed}
                  checked={isSelected}
                  onChange={() => {
                    if (committed) return;
                    const next = isSelected ? chosen.filter((id) => id !== opt.id) : [...chosen, opt.id];
                    onChange(next);
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        <SubmitOrFeedback committed={committed} disabled={chosen.length === 0} onCommit={onCommit} feedback={feedback} />
      </div>
    );
  }

  if (block.type === "true_false") {
    const selected = typeof value === "boolean" ? value : undefined;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
        <div role="radiogroup" aria-label={block.prompt} style={{ display: "flex", gap: 10 }}>
          {[true, false].map((option) => {
            const isSelected = selected === option;
            const showCorrect = committed && option === block.correctAnswer;
            const showWrong = committed && isSelected && option !== block.correctAnswer;
            return (
              <button
                key={String(option)}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={committed}
                onClick={() => !committed && onChange(option)}
                style={{
                  flex: 1,
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  padding: "12px 16px",
                  borderRadius: 4,
                  border: `1px solid ${showCorrect ? "var(--bow-positive)" : showWrong ? "var(--bow-negative)" : isSelected ? "var(--bow-blue)" : "var(--border-rule)"}`,
                  background: showCorrect ? "rgba(50,140,90,0.1)" : showWrong ? "rgba(180,40,40,0.08)" : isSelected ? "rgba(30,90,180,0.06)" : "var(--bow-white)",
                  cursor: committed ? "default" : "pointer",
                }}
              >
                {option ? "True" : "False"}
              </button>
            );
          })}
        </div>
        <SubmitOrFeedback committed={committed} disabled={selected === undefined} onCommit={onCommit} feedback={feedback} />
      </div>
    );
  }

  if (block.type === "numeric") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
        <input
          type="number"
          inputMode="decimal"
          disabled={committed}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          aria-label={block.prompt}
          style={{ fontSize: 16, padding: "10px 12px", borderRadius: 4, border: "1px solid var(--border-rule)", maxWidth: 220 }}
        />
        {block.unit && <span style={{ fontSize: 13, color: "var(--bow-slate)" }}>{block.unit}</span>}
        <SubmitOrFeedback committed={committed} disabled={typeof value !== "number"} onCommit={onCommit} feedback={feedback} />
      </div>
    );
  }

  if (block.type === "short_response") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
        <input
          type="text"
          disabled={committed}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label={block.prompt}
          style={{ fontSize: 16, padding: "10px 12px", borderRadius: 4, border: "1px solid var(--border-rule)" }}
        />
        <SubmitOrFeedback committed={committed} disabled={!value} onCommit={onCommit} feedback={feedback} />
      </div>
    );
  }

  // long_text (reflection)
  const text = typeof value === "string" ? value : draftText;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const isManualReview = block.reflection.mode === "manual_review";
  const minWords = block.reflection.mode === "min_words" ? block.reflection.minWords : undefined;
  const canSubmit = minWords ? words >= minWords : text.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
      <textarea
        disabled={committed}
        placeholder={block.placeholder}
        value={text}
        onChange={(e) => {
          setDraftText(e.target.value);
          onChange(e.target.value);
        }}
        style={{ fontSize: 15, padding: "10px 12px", borderRadius: 4, border: "1px solid var(--border-rule)", minHeight: 100, fontFamily: "var(--font-body)" }}
      />
      {minWords !== undefined && <span style={{ fontSize: 12, color: "var(--bow-slate)" }}>{words} / {minWords} words</span>}
      {committed ? (
        <p style={{ fontSize: 14, color: isManualReview ? "var(--bow-slate)" : "var(--bow-positive)", margin: 0 }}>
          {isManualReview ? "Submitted — pending instructor review." : "Submitted."}
        </p>
      ) : (
        <Button variant="primary" disabled={!canSubmit} onClick={onCommit} aria-label="Submit reflection">
          Submit
        </Button>
      )}
    </div>
  );
}

function SubmitOrFeedback({
  committed,
  disabled,
  onCommit,
  feedback,
}: {
  committed: boolean;
  disabled: boolean;
  onCommit: () => void;
  feedback?: string;
}) {
  if (committed) {
    return feedback ? <p style={{ fontSize: 14, margin: 0, color: "var(--bow-slate)" }}>{feedback}</p> : null;
  }
  return (
    <Button variant="primary" disabled={disabled} onClick={onCommit} aria-label="Submit answer">
      Submit
    </Button>
  );
}
