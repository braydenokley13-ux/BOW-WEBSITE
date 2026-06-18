"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Button from "./Button";
import DataStrip, { type DataItem } from "./DataStrip";

export interface DecisionOption {
  id: string;
  label: string;
  detail?: string;
  primary?: boolean;
}

export interface Consequence {
  byChoice: Record<string, { status?: "positive" | "warning" | "negative" | "info"; headline: string; body: string }>;
}

interface DecisionCardProps {
  desk?: string;
  round?: string;
  prompt: string;
  facts?: DataItem[];
  unknowns?: string[];
  options?: DecisionOption[];
  primaryLabel?: string;
  secondaryLabel?: string;
  consequence?: Consequence | null;
  onSubmit?: (id: string) => void;
  onSecondary?: () => void;
  style?: CSSProperties;
}

const resultColor: Record<string, string> = {
  positive: "var(--bow-positive)",
  warning: "var(--bow-warning)",
  negative: "var(--bow-negative)",
  info: "var(--bow-blue)",
};

/**
 * DecisionCard — BOW's signature interactive component. The reader becomes the
 * decision-maker: the decision, the constraint, 2–4 options, what's known vs
 * uncertain, and the consequence after submission. Lives on a dark surface.
 */
export default function DecisionCard({
  desk = "Decision Desk",
  round,
  prompt,
  facts = [],
  unknowns = [],
  options = [],
  primaryLabel = "Make the Offer",
  secondaryLabel = "Review the Cap Sheet",
  consequence = null,
  onSubmit,
  onSecondary,
  style,
}: DecisionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const result = submitted && consequence && selected ? consequence.byChoice?.[selected] : null;

  return (
    <div
      className="bow-front-office"
      style={{
        border: "1px solid var(--bow-dark-border)",
        borderTop: "4px solid var(--bow-blue)",
        background: "var(--bow-ink)",
        color: "var(--bow-white)",
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 22,
        borderRadius: "var(--radius-card)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--bow-orange)",
          }}
        >
          {desk}
        </span>
        {round && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.12em", color: "#9a9da6" }}>
            · {round}
          </span>
        )}
      </div>

      <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 26, lineHeight: 1.18, textWrap: "balance" }}>
        {prompt}
      </h3>

      {facts.length > 0 && <DataStrip dark dense items={facts} />}

      {unknowns.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          {unknowns.map((u, i) => (
            <span
              key={i}
              style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6" }}
            >
              {u}
            </span>
          ))}
        </div>
      )}

      {!result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {options.map((opt) => {
            const active = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                style={{
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  padding: "14px 16px",
                  cursor: "pointer",
                  background: active ? "rgba(49,87,255,0.14)" : "transparent",
                  border: active ? "1px solid var(--bow-blue)" : "1px solid var(--bow-dark-border)",
                  borderRadius: "var(--radius-control)",
                  color: "var(--bow-white)",
                  transition: "border-color var(--dur-hover) var(--ease-out), background var(--dur-hover) var(--ease-out)",
                }}
              >
                <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 16 }}>{opt.label}</span>
                {opt.detail && (
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.02em", color: "#9a9da6" }}>
                    {opt.detail}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {result && (
        <div
          style={{
            borderLeft: `4px solid ${resultColor[result.status || "info"] || "var(--bow-blue)"}`,
            paddingLeft: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: resultColor[result.status || "info"] || "var(--bow-blue)",
            }}
          >
            Consequence
          </span>
          <strong style={{ fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 21, lineHeight: 1.2 }}>
            {result.headline}
          </strong>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, color: "#c8cad0" }}>
            {result.body}
          </p>
        </div>
      )}

      {!result ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button
            variant="primary"
            disabled={!selected}
            onClick={() => {
              setSubmitted(true);
              if (selected) onSubmit?.(selected);
            }}
          >
            {primaryLabel}
          </Button>
          <Button variant="ghost" onClick={onSecondary} style={{ color: "#9a9da6" }}>
            {secondaryLabel}
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setSubmitted(false);
            setSelected(null);
          }}
          style={{ color: "var(--bow-white)", borderColor: "var(--bow-dark-border)", alignSelf: "flex-start" }}
        >
          Reconsider
        </Button>
      )}
    </div>
  );
}
