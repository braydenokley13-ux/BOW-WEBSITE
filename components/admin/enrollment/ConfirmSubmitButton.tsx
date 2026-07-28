"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ds/Button";

/**
 * Every consequential enrollment action must show its effect before it runs.
 * A native confirm() is the smallest honest way to do that without a modal
 * per action; the message is the actual consequence text, not a generic
 * "Are you sure?" — callers pass what will happen.
 */
export default function ConfirmSubmitButton({
  action,
  confirmMessage,
  children,
  variant = "primary",
  size = "sm",
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  confirmMessage: string;
  children: React.ReactNode;
  variant?: "primary" | "emphasis" | "ink" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
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
          if (!window.confirm(confirmMessage)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (!result.ok) setError(result.error ?? "That action could not be completed.");
          });
        }}
      >
        {pending ? "Working…" : children}
      </Button>
      {error && <span style={{ fontSize: 12, color: "var(--bow-red, #b3261e)" }}>{error}</span>}
    </div>
  );
}
