import type { CSSProperties, ReactNode } from "react";

interface FactRowProps {
  label: string;
  /**
   * The value. `null` / `undefined` is not an error — it renders "Still
   * deciding" in slate, because a real relationship can be real while its
   * details are open.
   */
  value?: ReactNode;
  /** Override the undecided wording where a different sentence fits better. */
  undecidedLabel?: string;
  /** Numbers, dates, times and statuses set in mono; sentences stay in Inter. */
  mono?: boolean;
  style?: CSSProperties;
}

/**
 * FactRow — one label and one value, separated by a hairline.
 *
 * Replaces the `.ops-meta-grid` / `.ops-label` / `.ops-value` markup that had
 * been copied across ~15 files. The undecided state is deliberately slate and
 * deliberately worded, never amber and never an empty cell: TBD is a stage,
 * not a fault.
 */
export default function FactRow({ label, value, undecidedLabel = "Still deciding", mono = false, style }: FactRowProps) {
  const undecided = value === null || value === undefined || value === "";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(96px, 148px) 1fr",
        gap: 16,
        alignItems: "baseline",
        padding: "9px 0",
        borderBottom: "1px solid var(--border-rule)",
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-interface)",
          fontSize: 12.5,
          color: "var(--bow-slate)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono && !undecided ? "var(--font-data)" : "var(--font-interface)",
          fontSize: mono && !undecided ? 12.5 : 13.5,
          letterSpacing: mono && !undecided ? "0.02em" : undefined,
          lineHeight: 1.45,
          color: undecided ? "var(--bow-slate)" : "var(--bow-ink)",
          fontStyle: undecided ? "italic" : undefined,
        }}
      >
        {undecided ? undecidedLabel : value}
      </span>
    </div>
  );
}
