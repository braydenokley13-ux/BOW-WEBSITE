"use client";

/* ============================================================
 * components/learn/builder/inspectors/SliderPriceInspector.tsx — inspector
 * shared by slider and price_set: min/max/step/unit, EffectsEditor, and a
 * bands editor (rubric_bands grading: "when [condition] -> points/feedback").
 * Conditions in bands stay simple in V1: a threshold on this block's own
 * response value, expressed as a `response` Ref gte/lte/between.
 * ============================================================ */

import type { Block, Condition, VariableDef } from "@/lib/learn/types";
import type { RubricBandSchema } from "@/lib/learn/schema";
import type { z } from "zod";

type RubricBand = z.infer<typeof RubricBandSchema>;
import Button from "@/components/ds/Button";
import EffectsEditor from "../EffectsEditor";
import { fieldStyle, labelStyle, rowStyle } from "../formStyles";
import type { BlockInspectorProps } from "./ContentInspectors";

type SliderLike = Extract<Block, { type: "slider" | "price_set" }>;

export interface SliderPriceInspectorProps extends BlockInspectorProps<SliderLike> {
  variables: VariableDef[];
}

function bandLabel(when: Condition): string {
  if ("op" in when && (when.op === "gte" || when.op === "lte" || when.op === "eq")) {
    return `response ${when.op} ${when.value ?? ""}`;
  }
  if ("op" in when && when.op === "between") return `response between ${when.min ?? ""}-${when.max ?? ""}`;
  return "custom condition";
}

export default function SliderPriceInspector({ block, onChange, variables }: SliderPriceInspectorProps) {
  function updateBand(i: number, patch: Partial<RubricBand>) {
    onChange({ bands: block.bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  }
  function removeBand(i: number) {
    onChange({ bands: block.bands.filter((_, idx) => idx !== i) });
  }
  function addBand() {
    const nextBand: RubricBand = {
      when: { op: "gte", ref: { kind: "response", key: block.id }, value: block.min },
      points: 0,
      feedback: "",
    };
    onChange({ bands: [...block.bands, nextBand] });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <span style={labelStyle}>Prompt</span>
        <textarea style={{ ...fieldStyle, minHeight: 60 }} value={block.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </div>

      <div style={rowStyle}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Min</span>
          <input style={fieldStyle} type="number" value={block.min} onChange={(e) => onChange({ min: Number(e.target.value) })} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Max</span>
          <input style={fieldStyle} type="number" value={block.max} onChange={(e) => onChange({ max: Number(e.target.value) })} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>Step</span>
          <input style={fieldStyle} type="number" value={block.step} onChange={(e) => onChange({ step: Number(e.target.value) })} />
        </div>
      </div>

      {block.type === "slider" ? (
        <div>
          <span style={labelStyle}>Unit</span>
          <select
            style={fieldStyle}
            value={block.unit}
            onChange={(e) => onChange({ unit: e.target.value as Extract<Block, { type: "slider" }>["unit"] } as Partial<SliderLike>)}
          >
            <option value="number">Number</option>
            <option value="currency">Currency</option>
            <option value="percent">Percent</option>
          </select>
        </div>
      ) : (
        <div>
          <span style={labelStyle}>Currency</span>
          <input style={fieldStyle} value={block.currency} onChange={(e) => onChange({ currency: e.target.value } as Partial<SliderLike>)} />
        </div>
      )}

      <div>
        <span style={labelStyle}>Grading mode</span>
        <select style={fieldStyle} value={block.grading} onChange={(e) => onChange({ grading: e.target.value as SliderLike["grading"] })}>
          <option value="variable_effects">Variable effects (tradeoff — no single right answer)</option>
          <option value="weighted">Weighted points</option>
          <option value="rubric_bands">Rubric bands</option>
        </select>
      </div>

      <div>
        <span style={labelStyle}>Effects — what this decision changes</span>
        <EffectsEditor effects={block.effects} variables={variables} onChange={(effects) => onChange({ effects })} />
      </div>

      {block.grading === "rubric_bands" && (
        <div>
          <span style={labelStyle}>Score bands</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {block.bands.map((band, i) => (
              <div key={i} style={{ border: "1px solid var(--bow-border, #e4e4e7)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>When {bandLabel(band.when)}</span>
                <div style={rowStyle}>
                  <input
                    style={fieldStyle}
                    type="number"
                    placeholder="Points"
                    value={band.points}
                    onChange={(e) => updateBand(i, { points: Number(e.target.value) })}
                  />
                  <input
                    style={fieldStyle}
                    placeholder="Feedback"
                    value={band.feedback ?? ""}
                    onChange={(e) => updateBand(i, { feedback: e.target.value })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => removeBand(i)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addBand}>
              + Add band
            </Button>
          </div>
        </div>
      )}

      <div>
        <span style={labelStyle}>Points (weighted grading)</span>
        <input style={fieldStyle} type="number" value={block.points} onChange={(e) => onChange({ points: Number(e.target.value) })} />
      </div>
    </div>
  );
}
