"use client";

/* ============================================================
 * components/learn/player/blocks/SliderBlock.tsx — `slider` + `price_set`.
 * Decision (tradeoff) blocks: grading is weighted/variable_effects/
 * rubric_bands, never a hidden single right answer — the value itself
 * drives variable effects shown on the Consequence phase.
 * ============================================================ */

import { useState } from "react";
import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type RangeBlockT = Extract<Block, { type: "slider" | "price_set" }>;

function formatValue(block: RangeBlockT, v: number): string {
  if (block.type === "price_set") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: block.currency, maximumFractionDigits: 0 }).format(v);
  }
  if (block.unit === "currency") return `$${v.toLocaleString()}`;
  if (block.unit === "percent") return `${v}%`;
  return String(v);
}

export default function SliderBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<RangeBlockT>) {
  const initial = typeof value === "number" ? value : block.type === "slider" ? (block.defaultValue ?? block.min) : block.min;
  const [local, setLocal] = useState(initial);
  const current = typeof value === "number" ? value : local;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <output style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32, color: "var(--bow-blue)" }}>
          {formatValue(block, current)}
        </output>
        <input
          type="range"
          aria-label={block.prompt}
          min={block.min}
          max={block.max}
          step={block.step}
          value={current}
          disabled={committed}
          onChange={(e) => {
            const next = Number(e.target.value);
            setLocal(next);
            onChange(next);
          }}
          style={{ width: "100%", accentColor: "var(--bow-blue)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--bow-slate)" }}>
          <span>{formatValue(block, block.min)}</span>
          <span>{formatValue(block, block.max)}</span>
        </div>
      </div>

      {committed ? (
        feedback && <p style={{ fontSize: 14, color: "var(--bow-slate)", margin: 0 }}>{feedback}</p>
      ) : (
        <Button variant="primary" onClick={onCommit} aria-label="Lock in decision">
          Lock in decision
        </Button>
      )}
    </div>
  );
}
