"use client";

/* ============================================================
 * components/learn/player/blocks/CategorizeBlock.tsx — shared player for
 * `categorize` and `drag_drop` (same schema shape, same interaction; plan
 * §6 explicitly allows "a shared implementation ... if the schema
 * distinguishes them" — schema.ts keeps them as distinct literal types).
 *
 * Interaction: tap-to-select an item, then tap a bucket to place it — the
 * documented touch fallback for drag interactions (plan rules), and it
 * happens to also be fully keyboard operable with no extra work, so we use
 * it as the ONE interaction model on all devices rather than layering a
 * second pointer-drag path on top.
 * ============================================================ */

import { useState } from "react";
import Button from "@/components/ds/Button";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type CategorizeBlockT = Extract<Block, { type: "categorize" | "drag_drop" }>;

export default function CategorizeBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<CategorizeBlockT>) {
  const placements = (value ?? {}) as Record<string, string>;
  const [selectedItem, setSelectedItem] = useState<string | undefined>();

  const unplaced = block.items.filter((item) => !placements[item.id]);

  function placeInCategory(categoryId: string) {
    if (committed || !selectedItem) return;
    onChange({ ...placements, [selectedItem]: categoryId });
    setSelectedItem(undefined);
  }

  function removeFromCategory(itemId: string) {
    if (committed) return;
    const next = { ...placements };
    delete next[itemId];
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
      <p style={{ fontSize: 13, color: "var(--bow-slate)", margin: 0 }}>Tap an item, then tap the bucket it belongs in.</p>

      {unplaced.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {unplaced.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={committed}
              onClick={() => setSelectedItem(item.id === selectedItem ? undefined : item.id)}
              aria-pressed={selectedItem === item.id}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                padding: "8px 12px",
                borderRadius: 4,
                border: `1px solid ${selectedItem === item.id ? "var(--bow-blue)" : "var(--border-rule)"}`,
                background: selectedItem === item.id ? "rgba(30,90,180,0.08)" : "var(--bow-white)",
                cursor: committed ? "default" : "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(block.categories.length, 4)}, 1fr)`, gap: 12 }}>
        {block.categories.map((cat) => {
          const items = block.items.filter((i) => placements[i.id] === cat.id);
          return (
            <div
              key={cat.id}
              role="button"
              tabIndex={committed ? -1 : 0}
              onClick={() => placeInCategory(cat.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") placeInCategory(cat.id);
              }}
              style={{
                border: "1px dashed var(--border-rule)",
                borderRadius: 4,
                padding: 12,
                minHeight: 80,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                cursor: committed || !selectedItem ? "default" : "pointer",
              }}
            >
              <strong style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--bow-slate)" }}>{cat.label}</strong>
              {items.map((item) => {
                const isCorrect = committed && item.correctCategoryId === cat.id;
                const isWrong = committed && item.correctCategoryId !== cat.id;
                return (
                  <div
                    key={item.id}
                    style={{
                      fontSize: 14,
                      padding: "6px 10px",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      border: `1px solid ${isCorrect ? "var(--bow-positive)" : isWrong ? "var(--bow-negative)" : "var(--bow-blue)"}`,
                      background: isCorrect ? "rgba(50,140,90,0.1)" : isWrong ? "rgba(180,40,40,0.08)" : "rgba(30,90,180,0.06)",
                    }}
                  >
                    <span>{item.label}</span>
                    {/* Only this control removes the item — clicking elsewhere in the
                       bucket (including empty space beside a placed chip) reaches the
                       bucket's own onClick so a second item can still be placed without
                       accidentally un-placing the first (the chip used to fill nearly
                       the whole bucket's tap target, so tapping "the bucket" tapped the
                       chip instead). */}
                    {!committed && (
                      <button
                        type="button"
                        aria-label={`Remove ${item.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCategory(item.id);
                        }}
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          fontSize: 14,
                          lineHeight: 1,
                          color: "var(--bow-slate)",
                          padding: 2,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {committed ? (
        feedback && <p style={{ fontSize: 14, margin: 0, color: "var(--bow-slate)" }}>{feedback}</p>
      ) : (
        <Button variant="primary" disabled={unplaced.length > 0} onClick={onCommit} aria-label="Submit categorization">
          Submit
        </Button>
      )}
    </div>
  );
}
