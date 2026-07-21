"use client";

/* ============================================================
 * components/learn/builder/inspectors/McInspector.tsx — MCQ inspector:
 * options editor with a correct-answer toggle, grading mode, and points.
 * ============================================================ */

import type { Block } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import { fieldStyle, labelStyle, rowStyle } from "../formStyles";
import type { BlockInspectorProps } from "./ContentInspectors";

type McBlock = Extract<Block, { type: "mc" }>;

function browserSafeId(): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

export default function McInspector({ block, onChange }: BlockInspectorProps<McBlock>) {
  function updateOption(i: number, patch: Partial<{ id: string; label: string }>) {
    onChange({ options: block.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  }
  function removeOption(i: number) {
    const removed = block.options[i];
    onChange({
      options: block.options.filter((_, idx) => idx !== i),
      correctOptionId: block.correctOptionId === removed.id ? (block.options[0]?.id ?? "") : block.correctOptionId,
    });
  }
  function addOption() {
    onChange({ options: [...block.options, { id: `opt-${browserSafeId()}`, label: "" }] });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <span style={labelStyle}>Question prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>

      <div>
        <span style={labelStyle}>Options — select the correct answer</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {block.options.map((opt, i) => (
            <div key={opt.id} style={rowStyle}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="radio"
                  name={`mc-correct-${block.id}`}
                  checked={block.correctOptionId === opt.id}
                  onChange={() => onChange({ correctOptionId: opt.id })}
                  aria-label={`Mark "${opt.label}" as correct`}
                />
              </label>
              <input style={fieldStyle} value={opt.label} onChange={(e) => updateOption(i, { label: e.target.value })} />
              <Button variant="ghost" size="sm" onClick={() => removeOption(i)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={addOption} style={{ marginTop: 8 }}>
          + Add option
        </Button>
      </div>

      <div style={rowStyle}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Grading</span>
          <select style={fieldStyle} value={block.grading} onChange={(e) => onChange({ grading: e.target.value as McBlock["grading"] })}>
            <option value="correct">Correct / incorrect</option>
            <option value="weighted">Weighted</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Points</span>
          <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
        </div>
      </div>

      <div style={rowStyle}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Feedback — correct</span>
          <input
            style={fieldStyle}
            value={block.feedback?.correct ?? ""}
            onChange={(e) => onChange({ feedback: { ...block.feedback, correct: e.target.value } })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Feedback — incorrect</span>
          <input
            style={fieldStyle}
            value={block.feedback?.incorrect ?? ""}
            onChange={(e) => onChange({ feedback: { ...block.feedback, incorrect: e.target.value } })}
          />
        </div>
      </div>
    </div>
  );
}
