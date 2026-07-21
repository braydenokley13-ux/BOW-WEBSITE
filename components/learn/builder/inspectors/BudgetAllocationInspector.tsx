"use client";

import type { Block, VariableDef } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import EffectsEditor from "../EffectsEditor";
import { fieldStyle, labelStyle, rowStyle } from "../formStyles";
import type { BlockInspectorProps } from "./ContentInspectors";

type BudgetBlock = Extract<Block, { type: "budget_allocation" }>;

function browserSafeId(): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

export interface BudgetAllocationInspectorProps extends BlockInspectorProps<BudgetBlock> {
  variables: VariableDef[];
}

export default function BudgetAllocationInspector({ block, onChange, variables }: BudgetAllocationInspectorProps) {
  function updateCategory(i: number, patch: Partial<{ id: string; label: string }>) {
    onChange({ categories: block.categories.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  }
  function removeCategory(i: number) {
    onChange({ categories: block.categories.filter((_, idx) => idx !== i) });
  }
  function addCategory() {
    onChange({ categories: [...block.categories, { id: `cat-${browserSafeId()}`, label: "" }] });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Total budget</span>
        <input style={fieldStyle} type="number" value={block.totalBudget} onChange={(e) => onChange({ totalBudget: Number(e.target.value) })} />
      </div>
      <div>
        <span style={labelStyle}>Categories</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {block.categories.map((cat, i) => (
            <div key={cat.id} style={rowStyle}>
              <input
                style={fieldStyle}
                placeholder="e.g. Social Media Ads"
                value={cat.label}
                onChange={(e) => updateCategory(i, { label: e.target.value })}
              />
              <Button variant="ghost" size="sm" onClick={() => removeCategory(i)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={addCategory} style={{ marginTop: 8 }}>
          + Add category
        </Button>
      </div>
      <div>
        <span style={labelStyle}>Grading mode</span>
        <select style={fieldStyle} value={block.grading} onChange={(e) => onChange({ grading: e.target.value as BudgetBlock["grading"] })}>
          <option value="weighted">Weighted points</option>
          <option value="variable_effects">Variable effects</option>
          <option value="rubric_bands">Rubric bands</option>
        </select>
      </div>
      <div>
        <span style={labelStyle}>Effects — what this allocation changes</span>
        <EffectsEditor effects={block.effects} variables={variables} onChange={(effects) => onChange({ effects })} />
      </div>
      <div>
        <span style={labelStyle}>Points (weighted grading)</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}
