"use client";

/* ============================================================
 * components/learn/dnd/PaletteDragSource.tsx + CanvasDropZone (below).
 *
 * Palette -> canvas drag insertion, wrapped behind dnd-kit's core DndContext
 * so nothing outside components/learn/dnd/ imports @dnd-kit directly. The
 * palette item is draggable-only (useDraggable); the canvas is a single drop
 * target (useDroppable) that reports the dropped palette payload to the
 * caller, which decides where in the phase to insert it. Click-to-add (no
 * drag) is the accessible/mobile-friendly fallback and is handled entirely
 * by the caller's onClick — this file only supplies the drag affordance.
 * ============================================================ */

import type { CSSProperties, ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";

export interface PaletteDragSourceProps {
  id: string;
  payload: unknown;
  onClick?: () => void;
  children: ReactNode;
  style?: CSSProperties;
}

export function PaletteDragSource({ id, payload, onClick, children, style }: PaletteDragSourceProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${id}`,
    data: { kind: "palette", payload },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      role="button"
      tabIndex={0}
      style={{ cursor: "grab", opacity: isDragging ? 0.5 : 1, ...style }}
    >
      {children}
    </div>
  );
}
