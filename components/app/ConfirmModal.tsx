"use client";

import { Button, Modal } from "@/components/ds";
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
    <Modal open onClose={confirmNo} title={confirm.title} maxWidth={440} accent={color}>
      <p style={{ margin: "0 0 22px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>
        {confirm.body}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          onClick={confirmYes}
          style={{ background: color, borderColor: color }}
        >
          {confirm.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
