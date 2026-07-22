"use client";

/* ============================================================
 * components/learn/player/blocks/StrategyChoiceBlock.tsx — `strategy_choice`.
 * A business decision (tradeoff), not a knowledge quiz: options carry
 * variable effects/points/feedback/branch, no single "correct" answer is
 * highlighted. Stage 6 closes the gap — schema/engine/registry already
 * existed but no Player was registered.
 * ============================================================ */

import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type StrategyChoiceBlockT = Extract<Block, { type: "strategy_choice" }>;

export default function StrategyChoiceBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<StrategyChoiceBlockT>) {
  const selected = typeof value === "string" ? value : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
      <div role="radiogroup" aria-label={block.prompt} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {block.options.map((opt) => {
          const isSelected = selected === opt.id;
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
                border: `1px solid ${isSelected ? "var(--bow-blue)" : "var(--border-rule)"}`,
                background: isSelected ? "rgba(30,90,180,0.06)" : "var(--bow-white)",
                cursor: committed ? "default" : "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {committed ? (
        feedback && <p style={{ fontSize: 14, margin: 0, color: "var(--bow-slate)" }}>{feedback}</p>
      ) : (
        <Button variant="primary" disabled={!selected} onClick={onCommit} aria-label="Commit decision">
          Commit
        </Button>
      )}
    </div>
  );
}
