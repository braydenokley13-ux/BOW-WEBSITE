"use client";

/* ============================================================
 * components/learn/player/blocks/MatchBlock.tsx — `match` decision block.
 * Tap-to-select-then-tap-target pairing (same accessible/touch model as
 * CategorizeBlock) — pick a left item, then pick its right-hand pair.
 * ============================================================ */

import { useState } from "react";
import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type MatchBlockT = Extract<Block, { type: "match" }>;

export default function MatchBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<MatchBlockT>) {
  const pairing = (value ?? {}) as Record<string, string>; // left pair id -> right label
  const [selectedLeft, setSelectedLeft] = useState<string | undefined>();

  // Shuffle-stable right options (author order — fine for a Stage 6 block).
  const rightOptions = block.pairs.map((p) => p.right);
  const usedRights = new Set(Object.values(pairing));

  function selectRight(right: string) {
    if (committed || !selectedLeft) return;
    onChange({ ...pairing, [selectedLeft]: right });
    setSelectedLeft(undefined);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
      <p style={{ fontSize: 13, color: "var(--bow-slate)", margin: 0 }}>Tap a left item, then tap its match on the right.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {block.pairs.map((pair) => {
            const matchedRight = pairing[pair.id];
            const isCorrect = committed && matchedRight === pair.right;
            const isWrong = committed && matchedRight !== undefined && matchedRight !== pair.right;
            return (
              <button
                key={pair.id}
                type="button"
                disabled={committed}
                onClick={() => setSelectedLeft(pair.id === selectedLeft ? undefined : pair.id)}
                aria-pressed={selectedLeft === pair.id}
                style={{
                  textAlign: "left",
                  fontSize: 14,
                  padding: "10px 12px",
                  borderRadius: 4,
                  border: `1px solid ${isCorrect ? "var(--bow-positive)" : isWrong ? "var(--bow-negative)" : selectedLeft === pair.id ? "var(--bow-blue)" : "var(--border-rule)"}`,
                  background: selectedLeft === pair.id ? "rgba(30,90,180,0.06)" : "var(--bow-white)",
                }}
              >
                {pair.left}
                {matchedRight ? <span style={{ color: "var(--bow-slate)" }}> {"->"} {matchedRight}</span> : null}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rightOptions.map((right) => (
            <button
              key={right}
              type="button"
              disabled={committed || (usedRights.has(right) && !selectedLeft)}
              onClick={() => selectRight(right)}
              style={{
                textAlign: "left",
                fontSize: 14,
                padding: "10px 12px",
                borderRadius: 4,
                border: "1px solid var(--border-rule)",
                background: usedRights.has(right) ? "rgba(0,0,0,0.03)" : "var(--bow-white)",
                opacity: usedRights.has(right) ? 0.6 : 1,
              }}
            >
              {right}
            </button>
          ))}
        </div>
      </div>
      {committed ? (
        feedback && <p style={{ fontSize: 14, margin: 0, color: "var(--bow-slate)" }}>{feedback}</p>
      ) : (
        <Button
          variant="primary"
          disabled={Object.keys(pairing).length < block.pairs.length}
          onClick={onCommit}
          aria-label="Submit matches"
        >
          Submit
        </Button>
      )}
    </div>
  );
}
