"use client";

import { useState } from "react";
import Link from "next/link";
import type { ConceptMapEntry, ConceptCategory } from "@/lib/concept-map";

type Filter = "all" | ConceptCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "micro", label: "AP Micro" },
  { key: "macro", label: "AP Macro" },
  { key: "sports_specific", label: "Sports-Specific" },
];

const CATEGORY_ACCENT: Record<ConceptCategory, string> = {
  micro: "var(--bow-blue)",
  macro: "var(--bow-positive)",
  sports_specific: "var(--bow-orange)",
};

export default function ConceptMapView({ entries }: { entries: ConceptMapEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? entries : entries.filter((e) => e.category === filter);

  return (
    <div>
      {/* FILTER BAR */}
      <div role="tablist" aria-label="Filter concepts" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 12,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "9px 18px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${active ? "var(--bow-ink)" : "var(--border-rule)"}`,
                background: active ? "var(--bow-ink)" : "transparent",
                color: active ? "#fff" : "var(--bow-ink)",
              }}
            >
              {f.label}
            </button>
          );
        })}
        <span style={{ marginLeft: "auto", alignSelf: "center", fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--bow-slate)" }}>
          {shown.length} concept{shown.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* CONCEPT GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {shown.map((e) => {
          const accent = CATEGORY_ACCENT[e.category];
          return (
            <article
              key={e.id}
              style={{
                background: "var(--bow-white)",
                border: "1px solid var(--border-rule)",
                borderTop: `4px solid ${accent}`,
                borderRadius: 6,
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 21, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
                    {e.conceptName}
                  </h3>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, flexShrink: 0 }}>
                    {e.category === "micro" ? "AP Micro" : e.category === "macro" ? "AP Macro" : "Sports"}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{e.moduleName}</div>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", marginBottom: 4 }}>
                  Front-office application
                </div>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)" }}>
                  {e.frontofficeApplication}
                </p>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", marginBottom: 4 }}>
                  Real example
                </div>
                <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)", fontStyle: "italic" }}>
                  {e.realExample}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{ marginTop: 40, background: "var(--bow-ink)", color: "#fff", borderRadius: 8, padding: "clamp(24px,4vw,40px)", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,3vw,32px)", textTransform: "uppercase", letterSpacing: "-0.01em" }}>
          Want to bring this curriculum to your students?
        </h2>
        <p style={{ margin: "0 auto 20px", maxWidth: 540, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#b9bcc4" }}>
          Every concept above maps to AP Economics standards and to how real front offices operate. Let&apos;s talk about a partnership.
        </p>
        <Link
          href="/contact"
          style={{ display: "inline-block", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 28px", background: "var(--bow-orange)", color: "#fff", borderRadius: 4, textDecoration: "none" }}
        >
          Request a Partnership →
        </Link>
      </div>
    </div>
  );
}
