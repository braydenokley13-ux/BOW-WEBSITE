"use client";

/* ============================================================
 * components/learn/player/blocks/MCQBlock.tsx — `mc` (multiple choice).
 * Knowledge check: correct/incorrect, not a tradeoff — feedback is
 * unambiguous ("Correct"/"Not quite") per the plan's knowledge-vs-decision
 * design principle.
 * ============================================================ */

import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type McBlockT = Extract<Block, { type: "mc" }>;

export default function MCQBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<McBlockT>) {
  const selected = typeof value === "string" ? value : undefined;
  const isCorrect = committed ? selected === block.correctOptionId : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
      <div role="radiogroup" aria-label={block.prompt} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {block.options.map((opt) => {
          const isSelected = selected === opt.id;
          const showCorrect = committed && opt.id === block.correctOptionId;
          const showWrong = committed && isSelected && opt.id !== block.correctOptionId;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={committed}
              onClick={() => !committed && onChange(opt.id)}
              style={{
                textAlign: "left",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                padding: "12px 16px",
                borderRadius: 4,
                border: `1px solid ${showCorrect ? "var(--bow-positive)" : showWrong ? "var(--bow-negative)" : isSelected ? "var(--bow-blue)" : "var(--border-rule)"}`,
                background: showCorrect ? "rgba(50,140,90,0.1)" : showWrong ? "rgba(180,40,40,0.08)" : isSelected ? "rgba(30,90,180,0.06)" : "var(--bow-white)",
                cursor: committed ? "default" : "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {committed ? (
        <p style={{ fontSize: 14, color: isCorrect ? "var(--bow-positive)" : "var(--bow-negative)", margin: 0 }}>
          {isCorrect ? "Correct" : "Not quite"}
          {feedback ? ` — ${feedback}` : ""}
        </p>
      ) : (
        <Button variant="primary" disabled={!selected} onClick={onCommit} aria-label="Submit answer">
          Submit
        </Button>
      )}
    </div>
  );
}
