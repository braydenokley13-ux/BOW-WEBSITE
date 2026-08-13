import type { CSSProperties, ReactNode } from "react";

interface FacetChipProps {
  children: ReactNode;
  /** Rendered as a link when a href is given, so facets can filter the directory. */
  href?: string;
  active?: boolean;
  /** Trailing count, e.g. the number of people wearing this hat. */
  count?: number;
  style?: CSSProperties;
}

/**
 * FacetChip — one of the hats a person wears (Student, Parent, Instructor,
 * Contact, Applicant, Staff).
 *
 * Facets accumulate on one profile and filter one directory; they never split
 * People into separate modules. That is the whole reason this is a chip and not
 * a tab.
 */
export default function FacetChip({ children, href, active = false, count, style }: FacetChipProps) {
  const chrome: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "var(--font-data)",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "5px 10px",
    borderRadius: "var(--radius-pill)",
    textDecoration: "none",
    whiteSpace: "nowrap",
    color: active ? "var(--bow-white)" : "var(--bow-slate)",
    background: active ? "var(--bow-ink)" : "transparent",
    border: `1px solid ${active ? "var(--bow-ink)" : "var(--border-rule)"}`,
    ...style,
  };

  const body = (
    <>
      {children}
      {count !== undefined ? (
        <span style={{ color: active ? "var(--bow-on-ink-subtle)" : "var(--bow-inactive)", fontWeight: 500 }}>
          {count}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} style={chrome} aria-current={active ? "true" : undefined}>
        {body}
      </a>
    );
  }
  return <span style={chrome}>{body}</span>;
}
