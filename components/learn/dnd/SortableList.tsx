"use client";

/* ============================================================
 * components/learn/dnd/SortableList.tsx — vertical sortable wrapper.
 *
 * Wraps @dnd-kit/core + @dnd-kit/sortable behind one generic component so no
 * other file in the repo imports dnd-kit directly (plan §4, stage gate §6
 * Stage 3). Supports pointer, touch, and keyboard reordering out of the box
 * via dnd-kit's built-in sensors.
 * ============================================================ */

import type { CSSProperties, ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (nextItems: T[], fromIndex: number, toIndex: number) => void;
  renderItem: (item: T, drag: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined }) => ReactNode;
  style?: CSSProperties;
}

/** Generic vertical sortable list — pointer + touch + keyboard reordering. */
export function SortableList<T>({ items, getId, onReorder, renderItem, style }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = items.findIndex((item) => getId(item) === String(active.id));
    const toIndex = items.findIndex((item) => getId(item) === String(over.id));
    if (fromIndex === -1 || toIndex === -1) return;
    const next = items.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next, fromIndex, toIndex);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <div style={style}>
          {items.map((item) => (
            <SortableRow key={getId(item)} id={getId(item)}>
              {(drag) => renderItem(item, drag)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (drag: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes: attributes as Record<string, unknown>, listeners: listeners as Record<string, unknown> | undefined })}
    </div>
  );
}
