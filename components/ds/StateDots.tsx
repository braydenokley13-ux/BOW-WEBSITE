import type { CSSProperties } from "react";

export interface StateDotStep {
  label: string;
  /** Free text under the step — a date, a name, or a dash when nothing happened yet. */
  detail?: string | null;
}

interface StateDotsProps {
  steps: StateDotStep[];
  /** Index of the step currently reached. Earlier steps read as done. */
  currentIndex: number;
  style?: CSSProperties;
}

/**
 * StateDots — a short, honest progress line for a state machine small enough
 * that a person can hold it in their head (the applicant's four steps).
 *
 * It shows where something is, not how far along a percentage it is. Steps
 * carry their own word, so the filled/hollow distinction is never load-bearing
 * on its own.
 */
export default function StateDots({ steps, currentIndex, style }: StateDotsProps) {
  return (
    <ol
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0,
        listStyle: "none",
        margin: 0,
        padding: 0,
        flexWrap: "wrap",
        ...style,
      }}
    >
      {steps.map((step, index) => {
        const reached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li
            key={step.label}
            aria-current={isCurrent ? "step" : undefined}
            style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}
          >
            {index > 0 ? (
              <span
                aria-hidden
                style={{
                  width: 26,
                  height: 1,
                  background: "var(--border-rule)",
                  marginTop: 6,
                  flex: "none",
                }}
              />
            ) : null}
            <span style={{ display: "flex", alignItems: "flex-start", gap: 7, paddingRight: 4 }}>
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  marginTop: 3.5,
                  flex: "none",
                  boxSizing: "border-box",
                  background: reached ? "var(--bow-ink)" : "transparent",
                  border: reached ? "1.5px solid var(--bow-ink)" : "1.5px solid var(--bow-border)",
                }}
              />
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-data)",
                    fontSize: 10.5,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: reached ? "var(--bow-ink)" : "var(--bow-slate)",
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  {step.label}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontFamily: "var(--font-data)",
                    fontSize: 10,
                    letterSpacing: "0.04em",
                    color: "var(--bow-slate)",
                  }}
                >
                  {step.detail || "—"}
                </span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
