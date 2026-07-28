"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";
import ActionDialog, { type ActionDialogDetail } from "@/components/admin/dialogs/ActionDialog";

/**
 * Actions that require a recorded reason (reject, waive, extend, cancel).
 * Opens an accessible ActionDialog with a required reason field instead of
 * window.prompt — the reason is what recordAudit stores, so an admin can
 * never fire the action silently, and Escape will not discard a typed
 * reason (ActionDialog blocks dismissal while the field is dirty).
 */
export default function ReasonSubmitButton({
  action,
  promptLabel,
  confirmMessage,
  title,
  details = [],
  notice = null,
  reversible = true,
  reversibleNote,
  destructive = false,
  children,
  confirmLabel,
  variant = "secondary",
  size = "sm",
  extra,
}: {
  action: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  /** Used as the required-reason field label. */
  promptLabel: string;
  /** Plain-language description of what happens; falls back to promptLabel. */
  confirmMessage?: string;
  title?: string;
  details?: ActionDialogDetail[];
  notice?: string | null;
  reversible?: boolean;
  reversibleNote?: string;
  destructive?: boolean;
  children: React.ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "emphasis" | "ink" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant={variant} size={size} disabled={pending} onClick={() => setOpen(true)}>
        {pending ? "Working…" : children}
      </Button>
      <ActionDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={(reason) =>
          new Promise((resolve) => {
            startTransition(async () => {
              resolve(await action(reason));
            });
          })
        }
        title={title ?? (typeof children === "string" ? children : "Confirm action")}
        description={confirmMessage ?? promptLabel}
        details={details}
        notice={notice}
        reversible={reversible}
        reversibleNote={reversibleNote}
        requireReason
        reasonLabel={promptLabel}
        destructive={destructive}
        confirmLabel={confirmLabel ?? (typeof children === "string" ? children : "Confirm")}
      />
      {extra}
    </>
  );
}
