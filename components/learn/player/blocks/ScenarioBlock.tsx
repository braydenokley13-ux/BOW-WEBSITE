"use client";

/* ============================================================
 * components/learn/player/blocks/ScenarioBlock.tsx — `scenario`.
 * Narrative + choices, each with its own effects/points/feedback/goTo —
 * this is the primary vehicle for the Decision→Consequence rhythm and the
 * one simple branch Stage 2 requires.
 * ============================================================ */

import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type ScenarioBlockT = Extract<Block, { type: "scenario" }>;

export default function ScenarioBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<ScenarioBlockT>) {
  const selected = typeof value === "string" ? value : undefined;
  const chosen = committed ? block.choices.find((c) => c.id === selected) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 16, lineHeight: 1.6, margin: 0 }}>{block.narrative}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {block.choices.map((choice) => {
          const isSelected = selected === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              disabled={committed}
              onClick={() => !committed && onChange(choice.id)}
              aria-pressed={isSelected}
              style={{
                textAlign: "left",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                padding: "14px 16px",
                borderRadius: 4,
                border: `1px solid ${isSelected ? "var(--bow-blue)" : "var(--border-rule)"}`,
                background: isSelected ? "rgba(30,90,180,0.06)" : "var(--bow-white)",
                cursor: committed ? "default" : "pointer",
              }}
            >
              {choice.label}
            </button>
          );
        })}
      </div>

      {committed ? (
        <div
          role="status"
          style={{
            border: "1px solid var(--border-rule)",
            borderRadius: 4,
            padding: "12px 16px",
            fontSize: 14,
            color: "var(--text-primary)",
          }}
        >
          {chosen?.feedback ?? feedback ?? "Choice recorded."}
        </div>
      ) : (
        <Button variant="primary" disabled={!selected} onClick={onCommit} aria-label="Confirm choice">
          Confirm choice
        </Button>
      )}
    </div>
  );
}
