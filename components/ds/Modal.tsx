"use client";

import type { CSSProperties, ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: number;
  accent?: string;
}

/**
 * Modal — extracted from the inline dialog in
 * app/app/admin/invitations/page.tsx so new BOW HQ surfaces (the
 * instructor detail action panel, etc.) reuse one dialog shell instead
 * of re-implementing the overlay/close/stop-propagation dance.
 */
export default function Modal({ open, onClose, title, children, maxWidth = 480, accent = "var(--bow-blue)" }: ModalProps) {
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
    <div role="dialog" aria-modal="true" style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              color: "var(--bow-ink)",
            }}
          >
            {title}
          </span>
          <span onClick={onClose} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)", cursor: "pointer" }}>
            Cancel ✕
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
