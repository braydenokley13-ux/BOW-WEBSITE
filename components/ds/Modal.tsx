"use client";

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: number;
  accent?: string;
  /** Prevent backdrop, Escape, and close-button dismissal during a committed write. */
  dismissible?: boolean;
}

/**
 * Modal — extracted from the inline dialog in
 * app/app/admin/invitations/page.tsx so new BOW HQ surfaces (the
 * instructor detail action panel, etc.) reuse one dialog shell instead
 * of re-implementing the overlay/close/stop-propagation dance.
 */
export default function Modal({ open, onClose, title, children, maxWidth = 480, accent = "var(--bow-blue)", dismissible = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    dismissibleRef.current = dismissible;
  }, [dismissible]);

  useEffect(() => {
    if (!open) return;
    const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'button:not(:disabled), [href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const panel = panelRef.current;
    const initialTarget =
      panel?.querySelector<HTMLElement>('input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled)') ??
      panel?.querySelector<HTMLElement>(focusableSelector) ??
      panel;
    initialTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = priorOverflow;
      priorFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  const overlay: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 4500,
    background: "rgba(10,10,11,0.62)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "36px 18px",
    overflowY: "auto",
  };

  const panel: CSSProperties = {
    background: "var(--bow-white)",
    maxWidth,
    width: "100%",
    borderRadius: 6,
    borderTop: `4px solid ${accent}`,
    padding: 28,
  };

  return (
    <div style={overlay} onClick={() => dismissible && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={panel}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <h2
            id={titleId}
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              color: "var(--bow-ink)",
              margin: 0,
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label={`Close ${title}`}
            disabled={!dismissible}
            onClick={onClose}
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 13,
              color: "var(--bow-slate)",
              cursor: dismissible ? "pointer" : "not-allowed",
              background: "transparent",
              border: 0,
              padding: "6px 0 6px 10px",
              opacity: dismissible ? 1 : 0.45,
            }}
          >
            Cancel ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
