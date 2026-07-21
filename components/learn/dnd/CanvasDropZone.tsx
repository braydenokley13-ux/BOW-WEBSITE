"use client";

/* ============================================================
 * components/learn/dnd/CanvasDropZone.tsx — palette -> canvas drop target.
 *
 * Pairs with PaletteDragSource.tsx. Wraps the canvas block list in a
 * DndContext + droppable region; on drop of a palette item it calls
 * onDropPaletteItem with the dragged payload. BuilderShell decides how to
 * turn that payload (a block type) into a new block appended to the active
 * phase. Kept deliberately simple for V1 — insertion position is "end of
 * phase"; precise in-list insertion is handled by SortableList's own
 * reorder once the block exists on canvas.
 * ============================================================ */

import type { CSSProperties, ReactNode } from "react";
import { DndContext, useDroppable, type DragEndEvent } from "@dnd-kit/core";

export interface CanvasDropZoneProps {
  id: string;
  onDropPaletteItem: (payload: unknown) => void;
  children: ReactNode;
  style?: CSSProperties;
}

export function CanvasDropZone({ id, onDropPaletteItem, children, style }: CanvasDropZoneProps) {
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || over.id !== id) return;
    const data = active.data.current as { kind?: string; payload?: unknown } | undefined;
    if (data?.kind === "palette") onDropPaletteItem(data.payload);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <DropTarget id={id} style={style}>
        {children}
      </DropTarget>
    </DndContext>
  );
}

function DropTarget({ id, children, style }: { id: string; children: ReactNode; style?: CSSProperties }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ ...style, outline: isOver ? "2px dashed var(--bow-orange-solid)" : "none" }}>
      {children}
    </div>
  );
}
