"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";
import ActionDialog, { type ActionDialogDetail } from "@/components/admin/dialogs/ActionDialog";

/**
 * Every consequential enrollment action must show its effect before it runs.
 * Opens an accessible ActionDialog (focus trap, labelled title/description,
 * error preserved on failure) instead of window.confirm — callers pass the
 * actual consequence, not a generic "Are you sure?".
 */
export default function ConfirmSubmitButton({
  action,
  confirmMessage,
  title,
  details = [],
  notice = null,
  reversible = true,
  reversibleNote,
  children,
  confirmLabel,
  variant = "primary",
  size = "sm",
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  /** Plain-language description of what happens. */
  confirmMessage: string;
  /** Dialog title; defaults to the button label. */
  title?: string;
  /** Structured rows: who's affected, program, current → resulting state, capacity. */
  details?: ActionDialogDetail[];
  notice?: string | null;
  reversible?: boolean;
  reversibleNote?: string;
  children: React.ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "emphasis" | "ink" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
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
        onConfirm={() =>
          new Promise((resolve) => {
            startTransition(async () => {
              resolve(await action());
            });
          })
        }
        title={title ?? (typeof children === "string" ? children : "Confirm action")}
        description={confirmMessage}
        details={details}
        notice={notice}
        reversible={reversible}
        reversibleNote={reversibleNote}
        confirmLabel={confirmLabel ?? (typeof children === "string" ? children : "Confirm")}
      />
    </>
  );
}
