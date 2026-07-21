"use client";

/* ============================================================
 * components/learn/builder/inspectors/GenericQuestionInspector.tsx —
 * fallback prompt/points editor for question/decision block types beyond
 * Stage 2's representative set (multi_select, true_false, numeric,
 * short_response, long_text, strategy_choice). These render fine in the
 * player (registered in a later stage per plan §6 "Interaction expansion")
 * but still need a basic authoring surface now so a doc containing them
 * (e.g. hand-authored or imported) doesn't dead-end the builder.
 * ============================================================ */

import type { Block } from "@/lib/learn/types";
import { fieldStyle, labelStyle } from "../formStyles";
import type { BlockInspectorProps } from "./ContentInspectors";

export default function GenericQuestionInspector({ block, onChange }: BlockInspectorProps) {
  const prompt = "prompt" in block ? block.prompt : "";
  const points = "points" in block ? block.points : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ fontSize: 13, color: "var(--bow-muted-text, #767a85)" }}>
        This block type ({block.type}) has basic editing here; its full visual inspector ships in a later stage.
      </p>
      {"prompt" in block && (
        <div>
          <span style={labelStyle}>Prompt</span>
          <textarea
            style={{ ...fieldStyle, minHeight: 60 }}
            value={prompt}
            onChange={(e) => onChange({ prompt: e.target.value } as Partial<Block>)}
          />
        </div>
      )}
      {points !== undefined && (
        <div>
          <span style={labelStyle}>Points</span>
          <input
            style={fieldStyle}
            type="number"
            value={points}
            onChange={(e) => onChange({ points: Number(e.target.value) } as Partial<Block>)}
          />
        </div>
      )}
    </div>
  );
}
