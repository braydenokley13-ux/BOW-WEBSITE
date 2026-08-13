import type { CSSProperties, ReactNode } from "react";

/**
 * settled  — done, green.
 * blocking — the one thing stopping the next step. The only amber allowed here.
 * waiting  — not needed yet. Hollow, and explicitly not a warning.
 */
export type ReadinessState = "settled" | "blocking" | "waiting";

interface ReadinessRowProps {
  /** The fact, written the way a person would say it. */
  label: string;
  detail?: ReactNode;
  state: ReadinessState;
  /** Offered only where there is something real to do about it. */
  action?: ReactNode;
  style?: CSSProperties;
}

const dot: Record<ReadinessState, CSSProperties> = {
  settled: { background: "var(--bow-positive)", border: "1.5px solid var(--bow-positive)" },
  blocking: { background: "var(--bow-warning)", border: "1.5px solid var(--bow-warning)" },
  waiting: { background: "transparent", border: "1.5px solid var(--bow-border)" },
};

const stateWord: Record<ReadinessState, string> = {
  settled: "Settled",
  blocking: "Blocking",
  waiting: "Not needed yet",
};

/**
 * ReadinessRow — a fact about whether something can run, not a launch gate.
 *
 * Four of these and at most one amber is the whole readiness surface. There are
 * no percentages, no checklist ceremony, and nothing that has to reach 100%
 * before a person is allowed to proceed. The state word is rendered for screen
 * readers so the dot is never the only carrier of meaning.
 */
export default function ReadinessRow({ label, detail, state, action, style }: ReadinessRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "11px 0",
        borderBottom: "1px solid var(--border-rule)",
        flexWrap: "wrap",
        ...style,
      }}
    >
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", flex: "none", marginTop: 5, boxSizing: "border-box", ...dot[state] }} />
      <span className="bow-sr-only">{stateWord[state]}: </span>
      <span style={{ flex: "1 1 240px", minWidth: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-interface)",
            fontWeight: 600,
            fontSize: 13.5,
            color: "var(--bow-ink)",
          }}
        >
          {label}
        </span>
        {detail ? (
          <span
            style={{
              fontFamily: "var(--font-interface)",
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--bow-slate)",
            }}
          >
            {" — "}
            {detail}
          </span>
        ) : null}
      </span>
      {action ? <span style={{ flex: "none" }}>{action}</span> : null}
    </div>
  );
}
