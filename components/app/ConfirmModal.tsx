"use client";

import { useAppState } from "./AppState";

const TONE: Record<string, string> = {
  negative: "var(--bow-negative)",
  info: "var(--bow-blue)",
  warning: "var(--bow-warning)",
};

export default function ConfirmModal() {
  const { confirm, confirmYes, confirmNo } = useAppState();
  if (!confirm) return null;
  const color = TONE[confirm.tone] ?? "var(--bow-blue)";
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={confirmNo}
      style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(10,10,11,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bow-white)", maxWidth: 440, width: "100%", borderRadius: 6, borderTop: `4px solid ${color}`, padding: 28, boxShadow: "var(--shadow-pop, 0 20px 60px rgba(0,0,0,0.4))" }}
      >
        <h3 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", lineHeight: 1.05 }}>
          {confirm.title}
        </h3>
        <p style={{ margin: "0 0 22px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>{confirm.body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={confirmNo} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 20px", border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-ink)", borderRadius: 4, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={confirmYes} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 20px", border: "none", background: color, color: "#fff", borderRadius: 4, cursor: "pointer" }}>
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
