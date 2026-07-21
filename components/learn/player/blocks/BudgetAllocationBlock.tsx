"use client";

/* ============================================================
 * components/learn/player/blocks/BudgetAllocationBlock.tsx — `budget_allocation`.
 * Response shape: Record<categoryId, number>. Engine grading rejects an
 * over-budget allocation (lib/learn/engine.ts gradeBlock case "budget_allocation").
 * ============================================================ */

import { useState } from "react";
import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type BudgetBlockT = Extract<Block, { type: "budget_allocation" }>;

export default function BudgetAllocationBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<BudgetBlockT>) {
  const initial = (value as Record<string, number> | undefined) ?? {};
  const [allocation, setAllocation] = useState<Record<string, number>>(initial);
  const current = (value as Record<string, number> | undefined) ?? allocation;
  const sum = Object.values(current).reduce((s, v) => s + (Number(v) || 0), 0);
  const remaining = block.totalBudget - sum;
  const overBudget = remaining < 0;

  const setCategory = (id: string, amount: number) => {
    const next = { ...current, [id]: amount };
    setAllocation(next);
    onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>

      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 16,
          color: overBudget ? "var(--bow-negative)" : "var(--bow-slate)",
        }}
        aria-live="polite"
      >
        Remaining: ${remaining.toLocaleString()} of ${block.totalBudget.toLocaleString()}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {block.categories.map((cat) => (
          <label key={cat.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, color: "var(--bow-slate)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{cat.label}</span>
            <input
              type="number"
              min={0}
              max={block.totalBudget}
              step={1}
              disabled={committed}
              value={current[cat.id] ?? 0}
              onChange={(e) => setCategory(cat.id, Number(e.target.value))}
              aria-label={cat.label}
              style={{ padding: "10px 12px", border: "1px solid var(--border-rule)", borderRadius: 4, fontSize: 15, fontFamily: "var(--font-body)" }}
            />
          </label>
        ))}
      </div>

      {committed ? (
        feedback && <p style={{ fontSize: 14, color: "var(--bow-slate)", margin: 0 }}>{feedback}</p>
      ) : (
        <>
          {overBudget && (
            <p role="alert" style={{ fontSize: 13, color: "var(--bow-negative)", margin: 0 }}>
              Allocation exceeds the total budget.
            </p>
          )}
          <Button variant="primary" disabled={overBudget} onClick={onCommit} aria-label="Lock in budget">
            Lock in budget
          </Button>
        </>
      )}
    </div>
  );
}
