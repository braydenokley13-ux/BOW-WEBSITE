import type { CSSProperties } from "react";
import CapLine from "./CapLine";

export interface MemoSection {
  heading?: string;
  body: string;
}

interface FrontOfficeMemoProps {
  label?: string;
  date?: string;
  title?: string;
  sections?: MemoSection[];
  footer?: string;
  tone?: "paper" | "white";
  style?: CSSProperties;
  className?: string;
}

/**
 * FrontOfficeMemo — a cream/white editorial panel with a mono label that
 * connects articles, classes and simulations.
 */
export default function FrontOfficeMemo({
  label = "Front Office Memo",
  date,
  title,
  sections = [],
  footer,
  tone = "paper",
  style,
  className,
}: FrontOfficeMemoProps) {
  const surface = tone === "white" ? "var(--bow-white)" : "var(--bow-paper)";
  return (
    <article
      className={className}
      style={{
        background: surface,
        border: "1px solid var(--border-rule)",
        borderRadius: "var(--radius-card)",
        padding: 28,
        color: "var(--bow-ink)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: "var(--reading-max)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--bow-ink)",
          }}
        >
          {label}
        </span>
        {date && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.1em", color: "var(--bow-slate)" }}>
            / {date}
          </span>
        )}
      </div>

      {title && (
        <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "var(--type-card)", lineHeight: 1.2, textWrap: "balance" }}>
          {title}
        </h3>
      )}

      <CapLine weight={4} step={10} stepAt={0.32} width="120px" />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sections.map((s, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {s.heading && (
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--bow-blue)",
                }}
              >
                {s.heading}
              </span>
            )}
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-ink)", textWrap: "pretty" }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {footer && (
        <div
          style={{
            marginTop: 4,
            paddingTop: 14,
            borderTop: "1px solid var(--border-rule)",
            fontFamily: "var(--font-data)",
            fontSize: 12,
            letterSpacing: "0.04em",
            color: "var(--bow-slate)",
          }}
        >
          {footer}
        </div>
      )}
    </article>
  );
}
