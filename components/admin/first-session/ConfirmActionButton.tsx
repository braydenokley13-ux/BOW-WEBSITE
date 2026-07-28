"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";
import ActionDialog, { type ActionDialogDetail } from "@/components/admin/dialogs/ActionDialog";

/**
 * Simple confirm-and-go action (no reason needed) — resend activation,
 * resend a failed reminder, mark a logistics issue resolved. Same
 * ActionDialog shell as the reason-required actions so every consequential
 * click on this page gets the same focus-trap/no-silent-Escape guarantees.
 */
export default function ConfirmActionButton({
  action,
  title,
  description,
  details = [],
  notice = null,
  reversible = true,
  reversibleNote,
  confirmLabel,
  variant = "secondary",
  size = "sm",
  children,
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  title: string;
  description: string;
  details?: ActionDialogDetail[];
  notice?: string | null;
  reversible?: boolean;
  reversibleNote?: string;
  confirmLabel: string;
  variant?: "primary" | "emphasis" | "ink" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
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
        title={title}
        description={description}
        details={details}
        notice={notice}
        reversible={reversible}
        reversibleNote={reversibleNote}
        confirmLabel={confirmLabel}
      />
    </>
  );
}
