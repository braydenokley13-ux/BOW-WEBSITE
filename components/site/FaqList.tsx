"use client";

import { useState } from "react";

/** A published question and answer, as stored in `site_faqs`. */
export interface FaqListItem {
  id: string;
  q: string;
  a: string;
}

export default function FaqList({ items }: { items: FaqListItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div style={{ borderTop: "1px solid var(--border-rule)" }}>
      {items.map((f) => {
        const isOpen = open === f.id;
        return (
          <div key={f.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
            <button
              onClick={() => setOpen(isOpen ? null : f.id)}
              aria-expanded={isOpen}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 18,
                padding: "22px 0",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(17px,1.7vw,21px)", lineHeight: 1.1, color: "var(--bow-ink)" }}>
                {f.q}
              </span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 22, fontWeight: 700, color: "var(--bow-blue)", flexShrink: 0, width: 28, textAlign: "center", lineHeight: 1 }}>
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: "0 40px 22px 0", maxWidth: 760 }}>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.3vw,18px)", lineHeight: 1.65, color: "var(--bow-slate)" }}>
                  {f.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
