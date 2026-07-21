"use client";

/* ============================================================
 * components/learn/builder/ValidationModal.tsx — "Publish" flow modal:
 * lists blocking errors and warnings from validateLessonDoc, click-to-select
 * the offending block, confirm to actually call publishLesson.
 * ============================================================ */

import Modal from "@/components/ds/Modal";
import Button from "@/components/ds/Button";
import type { ValidationResult } from "@/lib/learn/validate";

export interface ValidationModalProps {
  open: boolean;
  onClose: () => void;
  validation: ValidationResult;
  onSelectBlock: (blockId: string) => void;
  onConfirmPublish: () => void;
  publishing: boolean;
  publishError: string | null;
}

/** Best-effort block id extraction from a validation message's quoted id. */
function extractBlockId(message: string): string | null {
  const match = message.match(/"([^"]+)"/);
  return match ? match[1] : null;
}

export default function ValidationModal({
  open,
  onClose,
  validation,
  onSelectBlock,
  onConfirmPublish,
  publishing,
  publishError,
}: ValidationModalProps) {
  const hasErrors = validation.errors.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Publish lesson" maxWidth={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {hasErrors && (
          <div>
            <h4 style={{ color: "var(--bow-negative, #b3261e)", margin: "0 0 8px", fontSize: 14 }}>
              Fix these before publishing
            </h4>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {validation.errors.map((message, i) => {
                const blockId = extractBlockId(message);
                return (
                  <li key={i} style={{ fontSize: 13 }}>
                    {message}{" "}
                    {blockId && (
                      <button
                        type="button"
                        onClick={() => onSelectBlock(blockId)}
                        style={{ border: "none", background: "none", color: "var(--bow-blue)", cursor: "pointer", fontSize: 12 }}
                      >
                        Go to block
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div>
            <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--bow-warning, #a15c00)" }}>Warnings</h4>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {validation.warnings.map((message, i) => {
                const blockId = extractBlockId(message);
                return (
                  <li key={i} style={{ fontSize: 13 }}>
                    {message}{" "}
                    {blockId && (
                      <button
                        type="button"
                        onClick={() => onSelectBlock(blockId)}
                        style={{ border: "none", background: "none", color: "var(--bow-blue)", cursor: "pointer", fontSize: 12 }}
                      >
                        Go to block
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!hasErrors && validation.warnings.length === 0 && (
          <p style={{ fontSize: 14 }}>This lesson passes every check. Ready to publish.</p>
        )}

        {publishError && (
          <p role="alert" style={{ color: "var(--bow-negative, #b3261e)", fontSize: 13 }}>
            {publishError}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="emphasis" onClick={onConfirmPublish} disabled={hasErrors || publishing}>
            {publishing ? "Publishing…" : "Confirm & Publish"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
