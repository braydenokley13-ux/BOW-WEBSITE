"use client";

/* ============================================================
 * components/learn/builder/inspectors/ScenarioInspector.tsx — narrative +
 * choices, each with its own EffectsEditor and a BranchEditor targeting
 * the choice's goTo.
 * ============================================================ */

import type { Block, LessonDoc, VariableDef } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import EffectsEditor from "../EffectsEditor";
import BranchEditor from "../BranchEditor";
import { fieldStyle, labelStyle } from "../formStyles";
import type { BlockInspectorProps } from "./ContentInspectors";

type ScenarioBlock = Extract<Block, { type: "scenario" }>;

function browserSafeId(): string {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

export interface ScenarioInspectorProps extends BlockInspectorProps<ScenarioBlock> {
  variables: VariableDef[];
  doc: LessonDoc;
}

export default function ScenarioInspector({ block, onChange, variables, doc }: ScenarioInspectorProps) {
  function updateChoice(i: number, patch: Partial<ScenarioBlock["choices"][number]>) {
    onChange({ choices: block.choices.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  }
  function removeChoice(i: number) {
    onChange({ choices: block.choices.filter((_, idx) => idx !== i) });
  }
  function addChoice() {
    onChange({ choices: [...block.choices, { id: `choice-${browserSafeId()}`, label: "", effects: [] }] });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <span style={labelStyle}>Narrative</span>
        <textarea style={{ ...fieldStyle, minHeight: 90 }} value={block.narrative} onChange={(e) => onChange({ narrative: e.target.value })} />
      </div>
      {block.choices.map((choice, i) => (
        <div key={choice.id} style={{ border: "1px solid var(--bow-border, #e4e4e7)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <span style={labelStyle}>Choice label</span>
            <input style={fieldStyle} value={choice.label} onChange={(e) => updateChoice(i, { label: e.target.value })} />
          </div>
          <div>
            <span style={labelStyle}>Feedback (optional)</span>
            <input style={fieldStyle} value={choice.feedback ?? ""} onChange={(e) => updateChoice(i, { feedback: e.target.value })} />
          </div>
          <div>
            <span style={labelStyle}>Points (optional)</span>
            <input
              style={fieldStyle}
              type="number"
              value={choice.points ?? ""}
              onChange={(e) => updateChoice(i, { points: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>
          <EffectsEditor effects={choice.effects} variables={variables} onChange={(effects) => updateChoice(i, { effects })} />
          <BranchEditor doc={doc} fromLabel={choice.label || `Choice ${i + 1}`} value={choice.goTo} onChange={(goTo) => updateChoice(i, { goTo })} />
          <Button variant="ghost" size="sm" onClick={() => removeChoice(i)}>
            Remove choice
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={addChoice}>
        + Add choice
      </Button>
    </div>
  );
}
