"use client";

import type { VariableDef } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import { fieldStyle, labelStyle, rowStyle } from "./formStyles";
import { newId } from "./builderReducer";

export interface VariablesPanelProps {
  variables: VariableDef[];
  onChange: (variables: VariableDef[]) => void;
}

const UNITS: VariableDef["unit"][] = ["number", "currency", "percent", "points"];

export default function VariablesPanel({ variables, onChange }: VariablesPanelProps) {
  function update(index: number, patch: Partial<VariableDef>) {
    onChange(variables.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  function remove(index: number) {
    onChange(variables.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...variables, { key: newId("var"), label: "New Variable", initial: 0, unit: "number", visible: true }]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: "var(--bow-muted-text, #767a85)" }}>
        Variables track the lesson&rsquo;s live numbers (attendance, revenue, sentiment…). Decision blocks change them via
        effects; content blocks can display them live.
      </p>
      {variables.map((v, i) => (
        <div key={v.key} style={{ border: "1px solid var(--bow-border, #e4e4e7)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Label</span>
              <input style={fieldStyle} value={v.label} onChange={(e) => update(i, { label: e.target.value })} />
            </div>
            <div style={{ width: 120 }}>
              <span style={labelStyle}>Unit</span>
              <select style={fieldStyle} value={v.unit} onChange={(e) => update(i, { unit: e.target.value as VariableDef["unit"] })}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={rowStyle}>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Initial value</span>
              <input style={fieldStyle} type="number" value={v.initial} onChange={(e) => update(i, { initial: Number(e.target.value) })} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Min (optional)</span>
              <input
                style={fieldStyle}
                type="number"
                value={v.min ?? ""}
                onChange={(e) => update(i, { min: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Max (optional)</span>
              <input
                style={fieldStyle}
                type="number"
                value={v.max ?? ""}
                onChange={(e) => update(i, { max: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={v.visible !== false}
              onChange={(e) => update(i, { visible: e.target.checked })}
            />
            Visible in the student HUD while playing
          </label>
          <Button variant="ghost" size="sm" onClick={() => remove(i)} aria-label={`Remove ${v.label}`}>
            Remove variable
          </Button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={add}>
        + Add variable
      </Button>
    </div>
  );
}
