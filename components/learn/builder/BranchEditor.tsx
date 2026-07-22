"use client";

/* ============================================================
 * components/learn/builder/BranchEditor.tsx — shared simple branching UI
 * (V1, plan §4): "When [answer is X] -> go to [block/phase, human titles]" +
 * default continue. Targets are block IDs under the hood; the picker shows
 * "Phase title -> Block summary" so authors never see raw ids.
 * ============================================================ */

import type { LessonDoc } from "@/lib/learn/types";
import { getBlockRegistryEntry } from "@/lib/learn/registry";
import { labelStyle, selectStyle } from "./formStyles";

export interface BranchEditorProps {
  doc: LessonDoc;
  /** Human label for the option/condition this branch applies to (e.g. an MC option's label). */
  fromLabel: string;
  /** Current goTo block id, or undefined for "continue to next block". */
  value: string | undefined;
  onChange: (blockId: string | undefined) => void;
}

function blockChoices(doc: LessonDoc): { id: string; label: string }[] {
  const choices: { id: string; label: string }[] = [];
  for (const phase of doc.phases) {
    for (const block of phase.blocks) {
      const entry = getBlockRegistryEntry(block.type);
      const summary = entry.summarize(block);
      choices.push({ id: block.id, label: `${phase.title} → ${summary}` });
    }
  }
  return choices;
}

export default function BranchEditor({ doc, fromLabel, value, onChange }: BranchEditorProps) {
  const choices = blockChoices(doc);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={labelStyle}>
        When answer is “{fromLabel}” →
      </span>
      <select
        style={selectStyle}
        value={value ?? "__continue__"}
        onChange={(e) => onChange(e.target.value === "__continue__" ? undefined : e.target.value)}
      >
        <option value="__continue__">Continue (default next block)</option>
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            Go to: {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
