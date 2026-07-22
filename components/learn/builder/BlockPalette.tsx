"use client";

/* ============================================================
 * components/learn/builder/BlockPalette.tsx — LEFT panel: registry-driven,
 * grouped by category. Click-to-add is the guaranteed path; each item is
 * also a PaletteDragSource for drag-to-canvas (progressive enhancement).
 * ============================================================ */

import type { BlockType } from "@/lib/learn/types";
import { listBlockRegistryEntries, type BlockCategory } from "@/lib/learn/registry";
import { PaletteDragSource } from "@/components/learn/dnd/PaletteDragSource";

const CATEGORY_LABELS: Record<BlockCategory, string> = {
  content: "Content",
  media: "Media",
  question: "Questions",
  reflection: "Reflection",
  decision: "Decisions",
  scenario: "Scenario",
};

const CATEGORY_ORDER: BlockCategory[] = ["content", "media", "question", "reflection", "decision", "scenario"];

export interface BlockPaletteProps {
  onAdd: (type: BlockType) => void;
}

export default function BlockPalette({ onAdd }: BlockPaletteProps) {
  const entries = listBlockRegistryEntries();
  const byCategory = new Map<BlockCategory, typeof entries>();
  for (const entry of entries) {
    if (!byCategory.has(entry.category)) byCategory.set(entry.category, []);
    byCategory.get(entry.category)!.push(entry);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: 12, overflowY: "auto" }}>
      <p style={{ fontSize: 12, color: "var(--bow-muted-text, #767a85)", margin: 0 }}>
        Click a block to add it to the current phase, or drag it onto the canvas.
      </p>
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
        <div key={category}>
          <h4 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--bow-muted-text, #767a85)", margin: "0 0 8px" }}>
            {CATEGORY_LABELS[category]}
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byCategory.get(category)!.map((entry) => (
              <PaletteDragSource
                key={entry.type}
                id={entry.type}
                payload={entry.type}
                onClick={() => onAdd(entry.type)}
                style={{
                  border: "1px solid var(--bow-border, #e4e4e7)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 13,
                  background: "var(--bow-surface, #fff)",
                }}
              >
                {entry.label}
              </PaletteDragSource>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
