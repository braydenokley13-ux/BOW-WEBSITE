"use client";

/* ============================================================
 * components/learn/player/blocks/RankBlock.tsx — `rank` decision block.
 * Student-facing reorder via components/learn/dnd's SortableList (pointer +
 * touch + keyboard, per plan §6/rules — no hand-rolled DnD here).
 * ============================================================ */

import { useEffect, useState } from "react";
import Button from "@/components/ds/Button";
import { SortableList } from "@/components/learn/dnd/SortableList";
import type { BlockPlayerProps } from "../types";
import type { Block } from "@/lib/learn/types";

type RankBlockT = Extract<Block, { type: "rank" }>;

export default function RankBlock({ block, value, committed, feedback, onChange, onCommit }: BlockPlayerProps<RankBlockT>) {
  const initialOrder = Array.isArray(value) ? (value as string[]) : block.items.map((i) => i.id);
  const [order, setOrder] = useState<string[]>(initialOrder);

  // A student may submit the displayed (default) order without ever dragging
  // a row. Seed the lesson-player's response state with that default order on
  // mount so committing always has a real value instead of `undefined`
  // (dispatching to the PARENT's onChange, not this component's own state —
  // the set-state-in-effect lint rule only concerns local setState calls).
  useEffect(() => {
    if (!Array.isArray(value)) onChange(initialOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = new Map(block.items.map((i) => [i.id, i]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: 0 }}>{block.prompt}</p>
      <p style={{ fontSize: 13, color: "var(--bow-slate)", margin: 0 }}>Drag to reorder (or use arrow keys after focusing a row).</p>
      <SortableList
        items={order}
        getId={(id) => id}
        onReorder={(next) => {
          if (committed) return;
          setOrder(next);
          onChange(next);
        }}
        renderItem={(id, drag) => {
          const item = byId.get(id);
          const index = order.indexOf(id);
          const correctIndex = committed ? block.correctOrder.indexOf(id) : -1;
          const isCorrectSlot = committed && correctIndex === index;
          return (
            <div
              {...(committed ? {} : drag.attributes)}
              {...(committed ? {} : drag.listeners)}
              tabIndex={committed ? -1 : 0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "var(--font-body)",
                fontSize: 15,
                padding: "12px 16px",
                marginBottom: 8,
                borderRadius: 4,
                border: `1px solid ${committed ? (isCorrectSlot ? "var(--bow-positive)" : "var(--bow-negative)") : "var(--border-rule)"}`,
                background: "var(--bow-white)",
                cursor: committed ? "default" : "grab",
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--bow-slate)" }}>{index + 1}.</span>
              {item?.label}
            </div>
          );
        }}
      />
      {committed ? (
        feedback && <p style={{ fontSize: 14, margin: 0, color: "var(--bow-slate)" }}>{feedback}</p>
      ) : (
        <Button variant="primary" onClick={onCommit} aria-label="Submit ranking">
          Submit Ranking
        </Button>
      )}
    </div>
  );
}
