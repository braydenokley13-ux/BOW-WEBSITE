"use client";

/* ============================================================
 * components/learn/builder/ConflictDialog.tsx — saveDraft conflict recovery
 * (plan §4/§5, deliverable 5). Non-destructive: never silently overwrite.
 * Three choices: Load newest (discard local), Keep working (retry overwrite
 * with explicit confirm), Duplicate my version as a new lesson.
 * ============================================================ */

import { useState } from "react";
import Modal from "@/components/ds/Modal";
import Button from "@/components/ds/Button";
import { getLessonDraft } from "@/app/actions/learn-author";
import type { LessonDoc } from "@/lib/learn/types";

export interface ConflictDialogProps {
  open: boolean;
  lessonId: string;
  serverRevision: number;
  serverUpdatedAt: number | null;
  onLoadNewest: (doc: LessonDoc, revision: number) => void;
  onKeepWorking: () => void;
  onDuplicateAsNew: () => void;
}

export default function ConflictDialog({
  open,
  lessonId,
  serverRevision,
  serverUpdatedAt,
  onLoadNewest,
  onKeepWorking,
  onDuplicateAsNew,
}: ConflictDialogProps) {
  const [loading, setLoading] = useState(false);
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);

  async function loadNewest() {
    setLoading(true);
    const result = await getLessonDraft(lessonId);
    setLoading(false);
    if (result.ok) onLoadNewest(result.doc, result.draftRevision);
  }

  return (
    <Modal open={open} onClose={() => {}} title="Someone else saved changes" maxWidth={520} dismissible={false}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 14 }}>
          This lesson was saved elsewhere (revision {serverRevision}
          {serverUpdatedAt ? `, ${new Date(serverUpdatedAt).toLocaleString()}` : ""}) while you were editing. Choose
          how to proceed — your local changes are never silently overwritten.
        </p>

        {!confirmingOverwrite ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="secondary" onClick={loadNewest} disabled={loading}>
              Load newest (discard my local changes)
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingOverwrite(true)}>
              Keep working (overwrite the newest save)
            </Button>
            <Button variant="ghost" onClick={onDuplicateAsNew}>
              Duplicate my version as a new lesson
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p role="alert" style={{ fontSize: 13, color: "var(--bow-negative, #b3261e)" }}>
              This will overwrite the other save with your local version. Confirm you want to do this.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" onClick={() => setConfirmingOverwrite(false)}>
                Back
              </Button>
              <Button variant="emphasis" onClick={onKeepWorking}>
                Yes, overwrite with my version
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
