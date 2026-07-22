"use client";

/* ============================================================
 * components/learn/player/blocks/ForecastBlock.tsx — `forecast`: a numeric
 * prediction graded against a tolerance band (weighted partial credit via
 * lib/learn/engine.ts's forecast case), distinct from `numeric` (a
 * correct/incorrect knowledge check) because forecast is scenario-graded
 * with effects/bands like other decision blocks.
 * ============================================================ */

import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type ForecastBlockT = Extract<Block, { type: "forecast" }>;

export default function ForecastBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<ForecastBlockT>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {block.unit === "currency" && <span>$</span>}
        <input
          type="number"
          inputMode="decimal"
          disabled={committed}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          aria-label={block.prompt}
          style={{ fontSize: 16, padding: "10px 12px", borderRadius: 4, border: "1px solid var(--border-rule)", maxWidth: 220 }}
        />
        {block.unit === "percent" && <span>%</span>}
      </div>
      {committed ? (
        feedback && <p style={{ fontSize: 14, margin: 0, color: "var(--bow-slate)" }}>{feedback}</p>
      ) : (
        <Button variant="primary" disabled={typeof value !== "number"} onClick={onCommit} aria-label="Submit forecast">
          Submit Forecast
        </Button>
      )}
    </div>
  );
}
