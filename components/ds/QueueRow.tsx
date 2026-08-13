import type { CSSProperties, ReactNode } from "react";

export type QueueTone = "attention" | "neutral" | "positive";

interface QueueRowProps {
  /** What needs doing, as a sentence. Inter — this is read, not scanned. */
  title: ReactNode;
  /** Why it is here: the one fact that lets the operator decide without opening it. */
  context?: ReactNode;
  /**
   * Amber is earned, not decorative: "attention" is for an item that is due or
   * blocking. Everything else stays neutral so the queue reads quiet when healthy.
   */
  tone?: QueueTone;
  /**
   * The resolving actions, rendered inline. A queue item always carries the way
   * to resolve it — there is no dismiss.
   */
  actions?: ReactNode;
  /** Optional wrapper (a Link) so the row body itself can be a target. */
  href?: string;
  style?: CSSProperties;
}

const dotColor: Record<QueueTone, string> = {
  attention: "var(--bow-warning)",
  neutral: "var(--bow-slate)",
  positive: "var(--bow-positive)",
};

/**
 * QueueRow — one thing that needs a person, with its resolving action attached.
 *
 * Replaces the hand-written `.ops-list-row` markup that had been copied across
 * ~22 files. The dot never carries meaning alone: `context` always says in words
 * what the colour is hinting at, which is also what keeps it accessible.
 */
export default function QueueRow({ title, context, tone = "neutral", actions, href, style }: QueueRowProps) {
  const body = (
    <>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dotColor[tone],
          flex: "none",
          marginTop: 6,
        }}
      />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "block",
            fontFamily: "var(--font-interface)",
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1.4,
            color: "var(--bow-ink)",
          }}
        >
          {title}
        </span>
        {context ? (
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontFamily: "var(--font-interface)",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--bow-slate)",
            }}
          >
            {context}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "13px 0",
        borderTop: "1px solid var(--border-rule)",
        flexWrap: "wrap",
        ...style,
      }}
    >
      {href ? (
        <a
          href={href}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            flex: "1 1 280px",
            minWidth: 0,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          {body}
        </a>
      ) : (
        <span style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: "1 1 280px", minWidth: 0 }}>
          {body}
        </span>
      )}
      {actions ? (
        <span style={{ display: "flex", alignItems: "center", gap: 8, flex: "none", paddingTop: 1 }}>{actions}</span>
      ) : null}
    </div>
  );
}
