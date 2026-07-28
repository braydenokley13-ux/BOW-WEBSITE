"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";

/**
 * Actions that require a recorded reason (reject, waive, extend, cancel).
 * window.prompt is the smallest honest way to force a reason before the
 * request fires — the reason is what recordAudit stores, so an admin can
 * never fire the action silently.
 */
export default function ReasonSubmitButton({
  action,
  promptLabel,
  confirmMessage,
  children,
  variant = "secondary",
  size = "sm",
  extra,
}: {
  action: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  promptLabel: string;
  confirmMessage?: string;
  children: React.ReactNode;
  variant?: "primary" | "emphasis" | "ink" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  extra?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => {
          const reason = window.prompt(promptLabel);
          if (reason == null) return;
          if (!reason.trim()) {
            setError("A reason is required.");
            return;
          }
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          setError(null);
          startTransition(async () => {
            const result = await action(reason);
            if (!result.ok) setError(result.error ?? "That action could not be completed.");
          });
        }}
      >
        {pending ? "Working…" : children}
      </Button>
      {extra}
      {error && <span style={{ fontSize: 12, color: "var(--bow-red, #b3261e)" }}>{error}</span>}
    </div>
  );
}
