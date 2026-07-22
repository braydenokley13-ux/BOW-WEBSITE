"use client";

/* ============================================================
 * components/learn/builder/EffectsEditor.tsx — shared human-verb effects
 * editor: "[Increase|Decrease|Increase by %|Decrease by %|Set] [variable]
 * [amount]" + "derive from response (scale)". Used by every decision block's
 * inspector (slider/price_set/budget_allocation/strategy_choice/scenario).
 * ============================================================ */

import type { EffectRule, VariableDef } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import { fieldStyle, labelStyle, rowStyle, selectStyle } from "./formStyles";

const VERB_LABELS: Record<EffectRule["verb"], string> = {
  increase_by: "Increase",
  decrease_by: "Decrease",
  increase_pct: "Increase by %",
  decrease_pct: "Decrease by %",
  set_to: "Set",
  from_response: "Derive from response (scale)",
};

export function summarizeEffect(effect: EffectRule, variables: VariableDef[]): string {
  const label = variables.find((v) => v.key === effect.variable)?.label ?? effect.variable;
  switch (effect.verb) {
    case "increase_by":
      return `Increase ${label} by ${effect.amount ?? 0}`;
    case "decrease_by":
      return `Decrease ${label} by ${effect.amount ?? 0}`;
    case "increase_pct":
      return `Increase ${label} by ${effect.amount ?? 0}%`;
    case "decrease_pct":
      return `Decrease ${label} by ${effect.amount ?? 0}%`;
    case "set_to":
      return `Set ${label} to ${effect.amount ?? 0}`;
    case "from_response":
      return `${label} follows the response (×${effect.scale ?? 1})`;
    default:
      return label;
  }
}

export interface EffectsEditorProps {
  effects: EffectRule[];
  variables: VariableDef[];
  onChange: (effects: EffectRule[]) => void;
}

export default function EffectsEditor({ effects, variables, onChange }: EffectsEditorProps) {
  function update(index: number, patch: Partial<EffectRule>) {
    onChange(effects.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function remove(index: number) {
    onChange(effects.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...effects, { variable: variables[0]?.key ?? "", verb: "increase_by", amount: 0 }]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {variables.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--bow-muted-text, #767a85)" }}>
          Add a variable in the Variables tab before adding effects.
        </p>
      )}
      {effects.map((effect, i) => (
        <div key={i} style={{ ...rowStyle, flexWrap: "wrap", alignItems: "center", border: "1px solid var(--bow-border, #e4e4e7)", borderRadius: 8, padding: 10 }}>
          <select style={selectStyle} value={effect.verb} onChange={(e) => update(i, { verb: e.target.value as EffectRule["verb"] })}>
            {Object.entries(VERB_LABELS).map(([verb, label]) => (
              <option key={verb} value={verb}>
                {label}
              </option>
            ))}
          </select>
          <select style={selectStyle} value={effect.variable} onChange={(e) => update(i, { variable: e.target.value })}>
            {variables.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
          {effect.verb === "from_response" ? (
            <input
              style={fieldStyle}
              type="number"
              placeholder="Scale"
              title="Multiplier applied to the student's response value. E.g. a $70 price response with scale 180 produces $12,600."
              value={effect.scale ?? 1}
              onChange={(e) => update(i, { scale: Number(e.target.value) })}
            />
          ) : (
            <input
              style={fieldStyle}
              type="number"
              placeholder="Amount"
              value={effect.amount ?? 0}
              onChange={(e) => update(i, { amount: Number(e.target.value) })}
            />
          )}
          <Button variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Remove effect">
            Remove
          </Button>
          <span style={{ ...labelStyle, flexBasis: "100%", opacity: 0.7 }}>
            {summarizeEffect(effect, variables)}
          </span>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={add} disabled={variables.length === 0}>
        + Add effect
      </Button>
    </div>
  );
}
