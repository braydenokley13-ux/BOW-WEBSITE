"use client";

/* ============================================================
 * components/learn/player/blocks/TradeoffMatrixBlock.tsx — `tradeoff_matrix`.
 * Shows a reference table of option x criteria values (informational, not
 * graded) then lets the student pick one option, same "business decision,
 * not quiz" shape as strategy_choice — no single correct answer highlighted.
 * ============================================================ */

import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type TradeoffMatrixBlockT = Extract<Block, { type: "tradeoff_matrix" }>;

export default function TradeoffMatrixBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<TradeoffMatrixBlockT>) {
  const selected = typeof value === "string" ? value : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--border-rule)" }}></th>
              {block.criteria.map((c) => (
                <th key={c.id} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--border-rule)", color: "var(--bow-slate)" }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.options.map((opt) => (
              <tr key={opt.id}>
                <td style={{ padding: "6px 10px", fontWeight: 600 }}>{opt.label}</td>
                {block.criteria.map((c) => (
                  <td key={c.id} style={{ padding: "6px 10px" }}>{opt.values[c.id] ?? "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
                fontSize: 15,
                padding: "12px 16px",
                borderRadius: 4,
                border: `1px solid ${isSelected ? "var(--bow-blue)" : "var(--border-rule)"}`,
                background: isSelected ? "rgba(30,90,180,0.06)" : "var(--bow-white)",
                cursor: committed ? "default" : "pointer",
              }}
            >
              Choose {opt.label}
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
