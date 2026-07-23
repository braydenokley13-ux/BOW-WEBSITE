import type { ReactNode } from "react";

interface RecordShellProps {
  /** Small label above the identity block, e.g. record type ("Instructor"). */
  eyebrow?: ReactNode;
  /** The record's name/title. */
  title: ReactNode;
  /** Short supporting identity line (role, email, program, ...). */
  subtitle?: ReactNode;
  /** Status pill/label slot, rendered beside the identity block. */
  status?: ReactNode;
  /** Primary/secondary actions, rendered top-right. */
  actions?: ReactNode;
  /** Main content area. */
  children: ReactNode;
  /** Optional side column (contextual info, related links, tasks, ...). */
  side?: ReactNode;
  className?: string;
}

/**
 * Shared record-detail shell: identity header (title, subtitle, status,
 * actions) plus a content area with an optional side column. Intended to be
 * adopted across People/Programs/Hiring record pages (Stage 3+) so every
 * detail page shares the same identity treatment.
 */
export default function RecordShell({
  eyebrow,
  title,
  subtitle,
  status,
  actions,
  children,
  side,
  className,
}: RecordShellProps) {
  return (
    <div className={["ds-record-shell", className].filter(Boolean).join(" ")}>
      <header className="ds-record-shell__header">
        <div className="ds-record-shell__identity">
          {eyebrow && <span className="ds-record-shell__eyebrow">{eyebrow}</span>}
          <div className="ds-record-shell__title-row">
            <h1 className="ds-record-shell__title">{title}</h1>
            {status && <div className="ds-record-shell__status">{status}</div>}
          </div>
          {subtitle && <p className="ds-record-shell__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="ds-record-shell__actions">{actions}</div>}
      </header>
      <div className={side ? "ds-record-shell__body ds-record-shell__body--split" : "ds-record-shell__body"}>
        <div className="ds-record-shell__content">{children}</div>
        {side && <aside className="ds-record-shell__side">{side}</aside>}
      </div>
    </div>
  );
}
