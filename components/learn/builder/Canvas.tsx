"use client";

/* ============================================================
 * components/learn/builder/Canvas.tsx — CENTER panel: phase tabs
 * (add/remove/rename/reorder) + blocks rendered via the SAME registry
 * Player components in a non-interactive authoring mode, wrapped with a
 * selection outline, drag handle, and duplicate/delete controls.
 * ============================================================ */

import { useState } from "react";
import type { Block, LessonDoc, PhaseKind } from "@/lib/learn/types";
import { getBlockRegistryEntry } from "@/lib/learn/registry";
import { getPlayerComponent } from "@/components/learn/player/blockRegistry";
import { SortableList } from "@/components/learn/dnd/SortableList";
import { CanvasDropZone } from "@/components/learn/dnd/CanvasDropZone";
import type { BuilderAction, Selection } from "./builderReducer";

const PHASE_KINDS: PhaseKind[] = ["Briefing", "Learn", "Decision", "Consequence", "FollowUp", "Challenge"];

export interface CanvasProps {
  doc: LessonDoc;
  selection: Selection;
  dispatch: (action: BuilderAction) => void;
}

export default function Canvas({ doc, selection, dispatch }: CanvasProps) {
  const [renamingPhaseId, setRenamingPhaseId] = useState<string | null>(null);
  const activePhase = doc.phases.find((p) => p.id === selection.phaseId) ?? doc.phases[0];

  if (!activePhase) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Phase tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", padding: "10px 12px", borderBottom: "1px solid var(--bow-border, #e4e4e7)", alignItems: "center" }}>
        {doc.phases.map((phase) => (
          <div key={phase.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {renamingPhaseId === phase.id ? (
              <input
                autoFocus
                defaultValue={phase.title}
                style={{ fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--bow-border, #d7d7db)" }}
                onBlur={(e) => {
                  dispatch({ type: "RENAME_PHASE", phaseId: phase.id, title: e.target.value || phase.title });
                  setRenamingPhaseId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => dispatch({ type: "SELECT", phaseId: phase.id, blockId: null })}
                onDoubleClick={() => setRenamingPhaseId(phase.id)}
                style={{
                  fontSize: 13,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--bow-border, #e4e4e7)",
                  background: phase.id === activePhase.id ? "var(--bow-orange-solid)" : "transparent",
                  color: phase.id === activePhase.id ? "#fff" : "inherit",
                  cursor: "pointer",
                }}
                title="Double-click to rename"
              >
                {phase.title}
              </button>
            )}
            {doc.phases.length > 1 && (
              <button
                type="button"
                aria-label={`Remove phase ${phase.title}`}
                onClick={() => dispatch({ type: "REMOVE_PHASE", phaseId: phase.id })}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--bow-negative, #b3261e)", fontSize: 12 }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <select
          aria-label="Add phase"
          value=""
          onChange={(e) => {
            if (e.target.value) dispatch({ type: "ADD_PHASE", kind: e.target.value as PhaseKind });
          }}
          style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--bow-border, #e4e4e7)" }}
        >
          <option value="">+ Add phase…</option>
          {PHASE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </div>

      {/* Block canvas */}
      <CanvasDropZone
        id={`canvas-${activePhase.id}`}
        onDropPaletteItem={(payload) => {
          if (typeof payload === "string") dispatch({ type: "ADD_BLOCK", phaseId: activePhase.id, blockType: payload as never });
        }}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}
      >
        {activePhase.blocks.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--bow-muted-text, #767a85)" }}>
            No blocks yet — add one from the palette on the left.
          </p>
        ) : (
          <SortableList
            items={activePhase.blocks}
            getId={(b) => b.id}
            onReorder={(next) => dispatch({ type: "REORDER_BLOCKS", phaseId: activePhase.id, orderedIds: next.map((b) => b.id) })}
            renderItem={(block, drag) => (
              <BlockCard
                block={block}
                selected={selection.blockId === block.id}
                dragAttributes={drag.attributes}
                dragListeners={drag.listeners}
                onSelect={() => dispatch({ type: "SELECT", phaseId: activePhase.id, blockId: block.id })}
                onDuplicate={() => dispatch({ type: "DUPLICATE_BLOCK", phaseId: activePhase.id, blockId: block.id })}
                onDelete={() => dispatch({ type: "REMOVE_BLOCK", phaseId: activePhase.id, blockId: block.id })}
              />
            )}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          />
        )}
      </CanvasDropZone>
    </div>
  );
}

function BlockCard({
  block,
  selected,
  dragAttributes,
  dragListeners,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  block: Block;
  selected: boolean;
  dragAttributes: Record<string, unknown>;
  dragListeners: Record<string, unknown> | undefined;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const entry = getBlockRegistryEntry(block.type);
  const Player = getPlayerComponent(block.type);

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      style={{
        border: selected ? "2px solid var(--bow-orange-solid)" : "1px solid var(--bow-border, #e4e4e7)",
        borderRadius: 10,
        padding: 12,
        cursor: "pointer",
        background: "var(--bow-surface, #fff)",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span
          {...dragAttributes}
          {...(dragListeners ?? {})}
          aria-label="Drag to reorder"
          style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bow-muted-text, #767a85)", cursor: "grab" }}
        >
          ⠿ {entry.label}
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            style={{ fontSize: 11, border: "none", background: "none", cursor: "pointer", color: "var(--bow-blue)" }}
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{ fontSize: 11, border: "none", background: "none", cursor: "pointer", color: "var(--bow-negative, #b3261e)" }}
          >
            Delete
          </button>
        </span>
      </div>

      {/* Authoring-mode render: the same registry Player component, with
          interaction disabled (no-op handlers, pointer-events off on the
          inner content) so authors see a true WYSIWYG preview of the block
          without being able to "answer" it while building. */}
      {Player ? (
        <div style={{ pointerEvents: "none", opacity: 0.92 }}>
          {/* eslint-disable-next-line react-hooks/static-components -- stable registry lookup, not created per render */}
          <Player
            block={block as never}
            value={undefined}
            committed={false}
            variables={{}}
            onChange={() => {}}
            onCommit={() => {}}
            onAdvance={() => {}}
          />
        </div>
      ) : (
        <p style={{ fontSize: 13 }}>{entry.summarize(block)}</p>
      )}
    </div>
  );
}
