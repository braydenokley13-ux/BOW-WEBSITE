"use client";

import { useEffect, useRef, useState } from "react";
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
  onSubmit?: (id: string) => void | Promise<void>;
  onSecondary?: () => void;
  submitting?: boolean;
  submitError?: string | null;
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
  submitting = false,
  submitError = null,
  style,
}: DecisionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [locallySubmitting, setLocallySubmitting] = useState(false);
  const submitGuardRef = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const result = submitted && consequence && selected ? consequence.byChoice?.[selected] : null;
  const busy = submitting || locallySubmitting;
  const resultChoiceId = result ? selected : null;

  useEffect(() => {
    if (resultChoiceId) resultRef.current?.focus();
  }, [resultChoiceId]);

  const commitSelection = async () => {
    if (!selected || submitGuardRef.current) return;
    const committedChoice = selected;
    submitGuardRef.current = true;
    setLocallySubmitting(true);
    try {
      await onSubmit?.(committedChoice);
      setSubmitted(true);
    } catch {
      // Keep the options available. Callers that persist decisions surface
      // their specific message through submitError.
    } finally {
      submitGuardRef.current = false;
      setLocallySubmitting(false);
    }
  };

  return (
    <div
      className="bow-front-office"
      aria-busy={busy}
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
            color: "var(--bow-blue)",
          }}
        >
          {desk}
        </span>
        {round && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.12em", color: "var(--bow-on-ink-subtle)" }}>
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
              style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-on-ink-subtle)" }}
            >
              {u}
            </span>
          ))}
        </div>
      )}

      {!result && (
        <div role="group" aria-label="Decision options" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {options.map((opt) => {
            const active = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                aria-pressed={active}
                onClick={() => setSelected(opt.id)}
                style={{
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  padding: "14px 16px",
                  cursor: busy ? "wait" : "pointer",
                  background: active ? "rgba(49,87,255,0.14)" : "transparent",
                  border: active ? "1px solid var(--bow-blue)" : "1px solid var(--bow-dark-border)",
                  borderRadius: "var(--radius-control)",
                  color: "var(--bow-white)",
                  transition: "border-color var(--dur-hover) var(--ease-out), background var(--dur-hover) var(--ease-out)",
                }}
              >
                <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 16 }}>{opt.label}</span>
                {opt.detail && (
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.02em", color: "var(--bow-on-ink-subtle)" }}>
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
          ref={resultRef}
          role="region"
          aria-label="Decision consequence"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
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
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, color: "var(--bow-on-ink-muted)" }}>
            {result.body}
          </p>
        </div>
      )}

      {!result ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button
            variant="primary"
            disabled={!selected || busy}
            onClick={() => void commitSelection()}
          >
            {busy ? "Recording Decision…" : primaryLabel}
          </Button>
          {onSecondary && (
            <Button variant="ghost" disabled={busy} onClick={onSecondary} style={{ color: "var(--bow-on-ink-subtle)" }}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            submitGuardRef.current = false;
            setSubmitted(false);
            setSelected(null);
          }}
          style={{ color: "var(--bow-white)", borderColor: "var(--bow-dark-border)", alignSelf: "flex-start" }}
        >
          Reconsider
        </Button>
      )}
      {busy && (
        <p role="status" style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-on-ink-muted)" }}>
          Saving this round before revealing the consequence…
        </p>
      )}
      {submitError && (
        <p role="alert" style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-warning-text)" }}>
          {submitError}
        </p>
      )}
    </div>
  );
}
