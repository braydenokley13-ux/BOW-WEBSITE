"use client";

import { useId, useState } from "react";
import Modal from "@/components/ds/Modal";
import Button from "@/components/ds/Button";

export interface ActionDialogDetail {
  label: string;
  value: React.ReactNode;
}

export interface ActionDialogProps {
  open: boolean;
  onClose: () => void;
  /** Runs the server action. Receives the typed reason when `requireReason` is set. */
  onConfirm: (reason: string) => Promise<{ ok: boolean; error?: string }>;
  title: string;
  /** One line stating what this action does, in plain language. */
  description: string;
  /** Who is affected, program, current state → resulting state, capacity consequence. */
  details: ActionDialogDetail[];
  /** What happens to any family-facing notification. Pass null if none goes out. */
  notice: string | null;
  reversible: boolean;
  reversibleNote?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmLabel: string;
  /** Destructive actions render the confirm button in the "ghost" (red-adjacent) treatment and add extra emphasis. */
  destructive?: boolean;
}

/**
 * Shared accessible-dialog shell for every consequential admin action.
 * Built on components/ds/Modal (which already owns the focus trap, focus
 * restoration, and Escape handling) so every call site gets the same
 * keyboard/AT behavior instead of re-implementing it per action.
 *
 * Covers all four patterns from the launch-completion brief:
 *   - Confirmation      (requireReason = false)
 *   - Reason-required    (requireReason = true)
 *   - Review-and-confirm (pass multiple `details` rows — capacity, records affected)
 *   - Destructive         (destructive = true)
 *
 * Never closes on error — the error stays in the dialog next to the button
 * so a failed action can be retried without losing a typed reason.
 */
export default function ActionDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  details,
  notice,
  reversible,
  reversibleNote,
  requireReason = false,
  reasonLabel = "Reason",
  reasonPlaceholder,
  confirmLabel,
  destructive = false,
}: ActionDialogProps) {
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descId = useId();

  const reasonInvalid = requireReason && reasonTouched && !reason.trim();
  // Escape must not silently discard a reason the admin already typed.
  const dismissible = !pending && !(requireReason && reason.trim().length > 0);

  function handleClose() {
    if (!dismissible) return;
    setReason("");
    setReasonTouched(false);
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    if (requireReason && !reason.trim()) {
      setReasonTouched(true);
      return;
    }
    setError(null);
    setPending(true);
    const result = await onConfirm(reason.trim());
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "That action could not be completed.");
      return;
    }
    setReason("");
    setReasonTouched(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={title} dismissible={dismissible} accent={destructive ? "var(--bow-red, #b3261e)" : undefined}>
      <div style={{ display: "grid", gap: 16 }} aria-describedby={descId}>
        <p id={descId} style={{ margin: 0, fontSize: 14, color: "var(--bow-ink)" }}>
          {description}
        </p>

        {details.length > 0 && (
          <dl style={{ display: "grid", gap: 6, margin: 0, border: "1px solid var(--border-rule)", borderRadius: 6, padding: 12 }}>
            {details.map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                <dt style={{ color: "var(--bow-slate)" }}>{d.label}</dt>
                <dd style={{ margin: 0, textAlign: "right", fontWeight: 600 }}>{d.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--bow-slate)" }}>
          <div>{notice ? `Notification: ${notice}` : "Notification: none will be sent."}</div>
          <div>{reversible ? `Reversible${reversibleNote ? ` — ${reversibleNote}` : "."}` : "This action cannot be undone."}</div>
        </div>

        {requireReason && (
          <div>
            <label htmlFor={`${descId}-reason`} style={{ display: "block", fontSize: 12, color: "var(--bow-slate)", marginBottom: 4 }}>
              {reasonLabel}
            </label>
            <textarea
              id={`${descId}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setReasonTouched(true)}
              placeholder={reasonPlaceholder}
              rows={3}
              aria-required="true"
              aria-invalid={reasonInvalid || undefined}
              style={{
                width: "100%",
                padding: 8,
                border: `1px solid ${reasonInvalid ? "var(--bow-red, #b3261e)" : "var(--border-rule)"}`,
                borderRadius: 6,
                fontFamily: "inherit",
                fontSize: 14,
              }}
            />
            {reasonInvalid && (
              <div role="alert" style={{ fontSize: 12, color: "var(--bow-red, #b3261e)", marginTop: 4 }}>
                A reason is required and is recorded on the audit trail.
              </div>
            )}
          </div>
        )}

        {error && (
          <div role="alert" style={{ fontSize: 13, color: "var(--bow-red, #b3261e)" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" variant={destructive ? "ghost" : "primary"} size="sm" disabled={pending} onClick={handleConfirm}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
