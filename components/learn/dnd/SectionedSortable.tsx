"use client";

/* ============================================================
 * components/learn/dnd/SectionedSortable.tsx — multi-container sortable.
 *
 * Stage 7 map-editor need: drag-reorder nodes within a section AND between
 * sections (SortableList.tsx only handles one flat list). One DndContext
 * spans every container; each container is its own SortableContext so
 * dnd-kit's within-list reorder animation still works, while onDragEnd
 * reports (itemId, toContainerId, toIndex) for the caller (a server action)
 * to persist. Still the only file besides SortableList/CanvasDropZone/
 * PaletteDragSource that imports @dnd-kit directly.
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
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface SectionedContainer<T> {
  id: string;
  items: T[];
}

export interface SectionedSortableProps<T> {
  containers: SectionedContainer<T>[];
  getId: (item: T) => string;
  /** Called once per drop with the item's new container + 0-based index within it. */
  onMove: (itemId: string, toContainerId: string, toIndex: number) => void;
  renderItem: (item: T, drag: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined }) => ReactNode;
  renderContainer: (containerId: string, children: ReactNode, isEmpty: boolean) => ReactNode;
}

export function SectionedSortable<T>({ containers, getId, onMove, renderItem, renderContainer }: SectionedSortableProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containerOf = (itemId: string): string | undefined =>
    containers.find((c) => c.items.some((it) => getId(it) === itemId))?.id;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    // `over` is either another item (drop beside it) or an empty
    // container's droppable id (drop into an empty section).
    const overIsContainer = containers.some((c) => c.id === overId);
    const toContainerId = overIsContainer ? overId : containerOf(overId);
    if (!toContainerId) return;

    const destItems = containers.find((c) => c.id === toContainerId)?.items ?? [];
    let toIndex = overIsContainer ? destItems.length : destItems.findIndex((it) => getId(it) === overId);
    if (toIndex === -1) toIndex = destItems.length;

    onMove(activeId, toContainerId, toIndex);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {containers.map((container) => (
        <SortableContext key={container.id} items={container.items.map(getId)} strategy={verticalListSortingStrategy}>
          <EmptyDroppable id={container.id} active={container.items.length === 0}>
            {renderContainer(
              container.id,
              <>
                {container.items.map((item) => (
                  <SortableRow key={getId(item)} id={getId(item)}>
                    {(drag) => renderItem(item, drag)}
                  </SortableRow>
                ))}
              </>,
              container.items.length === 0,
            )}
          </EmptyDroppable>
        </SortableContext>
      ))}
    </DndContext>
  );
}

/** An empty section still needs a droppable target — dnd-kit's
 * SortableContext alone provides nothing to drop onto with zero items. */
function EmptyDroppable({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id, disabled: !active });
  return <div ref={active ? setNodeRef : undefined}>{children}</div>;
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
      {children({
        attributes: attributes as unknown as Record<string, unknown>,
        listeners: listeners as unknown as Record<string, unknown> | undefined,
      })}
    </div>
  );
}
