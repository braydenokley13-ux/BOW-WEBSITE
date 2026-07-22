"use client";

/* ============================================================
 * components/learn/builder/BuilderShell.tsx — Stage 3 Playbook Studio.
 *
 * Three panels: LEFT BlockPalette, CENTER Canvas (phase tabs + blocks),
 * RIGHT InspectorPanel. Desktop-first (>=1024px 3-column grid); below that,
 * a simplified stacked layout so the builder still functions (not a fully
 * optimized mobile authoring flow — the plan's north star is Brayden at a
 * desk building a lesson).
 * ============================================================ */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockType, LessonDoc } from "@/lib/learn/types";
import Button from "@/components/ds/Button";
import { validateLessonDoc } from "@/lib/learn/validate";
import { publishLesson } from "@/app/actions/learn-author";
import { useBuilderStore } from "./useBuilderStore";
import BlockPalette from "./BlockPalette";
import Canvas from "./Canvas";
import InspectorPanel from "./InspectorPanel";
import ValidationModal from "./ValidationModal";
import ConflictDialog from "./ConflictDialog";
import PreviewModal from "./PreviewModal";
import { fieldStyle } from "./formStyles";

export interface BuilderShellProps {
  lessonId: string;
  initialDoc: LessonDoc;
  initialRevision: number;
  publishedVersion: number | null;
}

export default function BuilderShell({ lessonId, initialDoc, initialRevision, publishedVersion }: BuilderShellProps) {
  const router = useRouter();
  const store = useBuilderStore(lessonId, initialDoc, initialRevision);
  const { state, dispatch } = store;

  const [validationOpen, setValidationOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedVersionLocal, setPublishedVersionLocal] = useState(publishedVersion);

  const validation = useMemo(() => validateLessonDoc(state.doc), [state.doc]);

  const selectBlockById = useCallback(
    (blockId: string) => {
      const phase = state.doc.phases.find((p) => p.blocks.some((b) => b.id === blockId));
      if (phase) dispatch({ type: "SELECT", phaseId: phase.id, blockId });
      setValidationOpen(false);
    },
    [state.doc, dispatch],
  );

  async function handlePublishClick() {
    setPublishError(null);
    setValidationOpen(true);
  }

  async function confirmPublish() {
    setPublishing(true);
    setPublishError(null);
    // Force-save first so publish validates the exact doc the author sees.
    const saveResult = await store.saveNow();
    if (!saveResult.ok) {
      setPublishing(false);
      setPublishError(saveResult.error);
      return;
    }
    const result = await publishLesson(lessonId, saveResult.revision);
    setPublishing(false);
    if (result.ok) {
      setPublishedVersionLocal(result.version);
      setValidationOpen(false);
    } else {
      setPublishError(result.error);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", minHeight: 0 }}>
      <BuilderToolbar
        title={state.doc.meta.title}
        onTitleChange={(title) => dispatch({ type: "SET_META", patch: { title } })}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        onUndo={() => dispatch({ type: "UNDO" })}
        onRedo={() => dispatch({ type: "REDO" })}
        saving={store.saving}
        dirty={state.dirty}
        saveError={store.saveError}
        onSaveNow={() => void store.saveNow()}
        publishedVersion={publishedVersionLocal}
        onPreview={() => setPreviewOpen(true)}
        onPublish={handlePublishClick}
        onBack={() => router.push("/app/admin/learn")}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "240px 1fr 340px",
        }}
        className="bow-builder-grid"
      >
        <div style={{ borderRight: "1px solid var(--bow-border, #e4e4e7)", minHeight: 0 }}>
          <BlockPalette onAdd={(type: BlockType) => dispatch({ type: "ADD_BLOCK", phaseId: state.selection.phaseId, blockType: type })} />
        </div>
        <div style={{ minHeight: 0 }}>
          <Canvas doc={state.doc} selection={state.selection} dispatch={dispatch} />
        </div>
        <div style={{ borderLeft: "1px solid var(--bow-border, #e4e4e7)", minHeight: 0 }}>
          <InspectorPanel doc={state.doc} selection={state.selection} dispatch={dispatch} />
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .bow-builder-grid { grid-template-columns: 1fr !important; grid-auto-rows: minmax(240px, auto); }
        }
      `}</style>

      <ValidationModal
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
        validation={validation}
        onSelectBlock={selectBlockById}
        onConfirmPublish={confirmPublish}
        publishing={publishing}
        publishError={publishError}
      />

      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} doc={state.doc} />

      {store.conflict && (
        <ConflictDialog
          open
          lessonId={lessonId}
          serverRevision={store.conflict.serverRevision}
          serverUpdatedAt={store.conflict.serverUpdatedAt}
          onLoadNewest={(doc, revision) => dispatch({ type: "REPLACE_DOC", doc, baseRevision: revision })}
          onKeepWorking={() => void store.resolveConflictKeepWorking()}
          onDuplicateAsNew={() => {
            // Minimal V1: duplicating as a new lesson is a curriculum-manager
            // action (createFromTemplate/duplicateLesson); from here we just
            // route back so the author can duplicate explicitly, keeping
            // their local doc intact in this tab meanwhile.
            store.clearConflict();
          }}
        />
      )}
    </div>
  );
}

function BuilderToolbar({
  title,
  onTitleChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saving,
  dirty,
  saveError,
  onSaveNow,
  publishedVersion,
  onPreview,
  onPublish,
  onBack,
}: {
  title: string;
  onTitleChange: (title: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saving: boolean;
  dirty: boolean;
  saveError: string | null;
  onSaveNow: () => void;
  publishedVersion: number | null;
  onPreview: () => void;
  onPublish: () => void;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid var(--bow-border, #e4e4e7)",
        flexWrap: "wrap",
      }}
    >
      <Button variant="ghost" size="sm" onClick={onBack}>
        ← Curriculum
      </Button>
      <input
        style={{ ...fieldStyle, width: 260, fontWeight: 600 }}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="Lesson title"
      />
      <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo}>
        Undo
      </Button>
      <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo}>
        Redo
      </Button>
      <span style={{ fontSize: 12, color: "var(--bow-muted-text, #767a85)" }}>
        {saveError ? <span style={{ color: "var(--bow-negative, #b3261e)" }}>Save failed: {saveError}</span> : saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
      </span>
      {dirty && !saving && (
        <Button variant="ghost" size="sm" onClick={onSaveNow} aria-label="Save now">
          Save now
        </Button>
      )}
      <span style={{ fontSize: 12, color: "var(--bow-muted-text, #767a85)" }}>
        {publishedVersion ? `Published V${publishedVersion}` : "Never published"}
      </span>
      <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={onPreview}>
          Preview
        </Button>
        <Button variant="emphasis" size="sm" onClick={onPublish}>
          Publish
        </Button>
      </span>
    </div>
  );
}
