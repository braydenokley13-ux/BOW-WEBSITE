"use client";

import { useAppState } from "./AppState";

const TONE: Record<string, string> = {
  positive: "var(--bow-positive)",
  warning: "var(--bow-warning)",
  negative: "var(--bow-negative)",
};

export default function Toast() {
  const { toast } = useAppState();
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 26,
        transform: "translateX(-50%)",
        zIndex: 4000,
        background: "var(--bow-ink)",
        color: "#fff",
        padding: "13px 22px",
        borderRadius: 6,
        boxShadow: "var(--shadow-pop, 0 12px 40px rgba(0,0,0,0.3))",
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: "90vw",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: TONE[toast.tone] ?? "var(--bow-positive)", flexShrink: 0 }} />
      <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, fontWeight: 500 }}>{toast.msg}</span>
    </div>
  );
}
