"use client";

import { useMemo, useState } from "react";
import type { GlossaryTerm, GlossaryCategory } from "@/lib/glossary";

type Filter = "all" | GlossaryCategory;

// Inlined (rather than imported from lib/glossary) so this client component
// doesn't pull the server-only DB module into the browser bundle.
const CATEGORY_LABEL: Record<GlossaryCategory, string> = {
  cap_mechanics: "Cap Mechanics",
  economics: "Economics",
  analytics: "Analytics",
  business: "Business",
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "cap_mechanics", label: CATEGORY_LABEL.cap_mechanics },
  { key: "economics", label: CATEGORY_LABEL.economics },
  { key: "analytics", label: CATEGORY_LABEL.analytics },
  { key: "business", label: CATEGORY_LABEL.business },
];

export default function GlossaryView({ terms }: { terms: GlossaryTerm[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return terms.filter((t) => {
      if (filter !== "all" && t.category !== filter) return false;
      if (q && !t.term.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [terms, query, filter]);

  return (
    <div>
      {/* SEARCH + FILTER */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search terms — e.g. luxury tax, opportunity cost…"
          aria-label="Search glossary terms"
          style={{
            width: "100%",
            background: "var(--bow-white)",
            border: "1px solid var(--border-rule)",
            borderRadius: 6,
            padding: "13px 16px",
            fontFamily: "var(--font-interface)",
            fontSize: 16,
            color: "var(--bow-ink)",
            outline: "none",
          }}
        />
        <div role="tablist" aria-label="Filter by category" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            {shown.length} term{shown.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* TERM LIST */}
      {shown.length === 0 ? (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
          No terms match “{query}”. Try a different word.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {shown.map((t) => (
            <article key={t.id} id={t.id} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "18px 20px", scrollMarginTop: 90 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
                  {t.term}
                </h3>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-blue)", flexShrink: 0 }}>
                  {CATEGORY_LABEL[t.category]}
                </span>
              </div>
              <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)" }}>
                {t.definition}
              </p>
              <p style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)", fontStyle: "italic" }}>
                {t.realWorldExample}
              </p>
              <div style={{ marginTop: 10, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                {t.moduleName}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
