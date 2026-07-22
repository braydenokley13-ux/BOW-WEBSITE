"use client";

/* ============================================================
 * components/learn/builder/inspectors/QuestionInspector.tsx — Stage 6:
 * proper inspectors for the knowledge-question types that previously fell
 * back to GenericQuestionInspector (multi_select, true_false, numeric,
 * short_response, long_text) plus strategy_choice (missing entirely).
 * ============================================================ */

import type { Block } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import { fieldStyle, labelStyle, rowStyle } from "../formStyles";
import type { BlockInspectorProps } from "./ContentInspectors";

export function MultiSelectInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "multi_select" }>>) {
  function updateOption(i: number, label: string) {
    onChange({ options: block.options.map((o, idx) => (idx === i ? { ...o, label } : o)) });
  }
  function removeOption(i: number) {
    const id = block.options[i].id;
    onChange({
      options: block.options.filter((_, idx) => idx !== i),
      correctOptionIds: block.correctOptionIds.filter((c) => c !== id),
    });
  }
  function addOption() {
    const id = `opt-${block.options.length + 1}-${Math.random().toString(36).slice(2, 6)}`;
    onChange({ options: [...block.options, { id, label: "" }] });
  }
  function toggleCorrect(id: string) {
    const set = new Set(block.correctOptionIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ correctOptionIds: [...set] });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      {block.options.map((opt, i) => (
        <div key={opt.id} style={rowStyle}>
          <input
            type="checkbox"
            checked={block.correctOptionIds.includes(opt.id)}
            onChange={() => toggleCorrect(opt.id)}
            aria-label={`Mark "${opt.label}" correct`}
          />
          <input style={fieldStyle} value={opt.label} onChange={(e) => updateOption(i, e.target.value)} />
          <Button variant="ghost" size="sm" onClick={() => removeOption(i)}>Remove</Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addOption}>+ Add option</Button>
      <div>
        <span style={labelStyle}>Points</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}

export function TrueFalseInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "true_false" }>>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Correct answer</span>
        <select style={fieldStyle} value={String(block.correctAnswer)} onChange={(e) => onChange({ correctAnswer: e.target.value === "true" })}>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      </div>
      <div>
        <span style={labelStyle}>Points</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}

export function NumericInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "numeric" }>>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      <div style={rowStyle}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Correct value</span>
          <input style={fieldStyle} type="number" value={block.correctValue} onChange={(e) => onChange({ correctValue: Number(e.target.value) })} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Tolerance</span>
          <input style={fieldStyle} type="number" value={block.tolerance} onChange={(e) => onChange({ tolerance: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <span style={labelStyle}>Unit (optional)</span>
        <input style={fieldStyle} value={block.unit ?? ""} onChange={(e) => onChange({ unit: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Points</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}

export function ShortResponseInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "short_response" }>>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Accepted answers (comma-separated)</span>
        <input
          style={fieldStyle}
          value={block.acceptedAnswers.join(", ")}
          onChange={(e) => onChange({ acceptedAnswers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input type="checkbox" checked={block.caseSensitive} onChange={(e) => onChange({ caseSensitive: e.target.checked })} />
        Case sensitive
      </label>
      <div>
        <span style={labelStyle}>Points</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}

export function LongTextInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "long_text" }>>) {
  const mode = block.reflection.mode;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Placeholder (optional)</span>
        <input style={fieldStyle} value={block.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} />
      </div>
      <div>
        <span style={labelStyle}>Grading mode</span>
        <select
          style={fieldStyle}
          value={mode}
          onChange={(e) => {
            const next = e.target.value as "completion_only" | "min_words" | "manual_review";
            onChange({ reflection: next === "min_words" ? { mode: "min_words", minWords: 30 } : { mode: next } });
          }}
        >
          <option value="completion_only">Completion only</option>
          <option value="min_words">Minimum word count</option>
          <option value="manual_review">Manual review (instructor grades later)</option>
        </select>
      </div>
      {mode === "min_words" && (
        <div>
          <span style={labelStyle}>Minimum words</span>
          <input
            style={fieldStyle}
            type="number"
            value={block.reflection.mode === "min_words" ? block.reflection.minWords : 30}
            onChange={(e) => onChange({ reflection: { mode: "min_words", minWords: Number(e.target.value) } })}
          />
        </div>
      )}
      {mode === "manual_review" && (
        <p style={{ fontSize: 12, color: "var(--bow-muted-text, #767a85)", margin: 0 }}>
          Manual-review reflections are excluded from auto score — outcome is marked pending until an instructor reviews it.
        </p>
      )}
    </div>
  );
}

export function StrategyChoiceInspector({ block, onChange }: BlockInspectorProps<Extract<Block, { type: "strategy_choice" }>>) {
  function updateOption(i: number, patch: Partial<(typeof block.options)[number]>) {
    onChange({ options: block.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) });
  }
  function removeOption(i: number) {
    onChange({ options: block.options.filter((_, idx) => idx !== i) });
  }
  function addOption() {
    const id = `opt-${block.options.length + 1}-${Math.random().toString(36).slice(2, 6)}`;
    onChange({ options: [...block.options, { id, label: "", effects: [] }] });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>
      {block.options.map((opt, i) => (
        <div key={opt.id} style={{ border: "1px solid var(--bow-border, #eee)", borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <input style={fieldStyle} placeholder="Option label" value={opt.label} onChange={(e) => updateOption(i, { label: e.target.value })} />
          <input style={fieldStyle} placeholder="Feedback (optional)" value={opt.feedback ?? ""} onChange={(e) => updateOption(i, { feedback: e.target.value })} />
          <Button variant="ghost" size="sm" onClick={() => removeOption(i)}>Remove option</Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addOption}>+ Add option</Button>
      <div>
        <span style={labelStyle}>Grading</span>
        <select style={fieldStyle} value={block.grading} onChange={(e) => onChange({ grading: e.target.value as typeof block.grading })}>
          <option value="weighted">Weighted (points per option)</option>
          <option value="variable_effects">Variable effects only</option>
          <option value="rubric_bands">Rubric bands</option>
        </select>
      </div>
    </div>
  );
}
