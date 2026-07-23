import type { ReactNode } from "react";

export interface PageHeaderMetaItem {
  label: string;
  value: ReactNode;
}

interface PageHeaderProps {
  /** Small label above the title, e.g. a section or record-type name. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Short supporting line under the title. */
  context?: ReactNode;
  /** Primary action rendered top-right of the title row (a Button, usually). */
  action?: ReactNode;
  /** Compact label/value row under the header (status, owner, dates, ...). */
  meta?: PageHeaderMetaItem[];
  className?: string;
}

/**
 * Compact page-level header for portal surfaces. No giant headings, no card
 * box — a title, optional context line, optional single primary action, and
 * an optional meta row. Used inside the shell's top-bar slot and by pages
 * adopting the new IA (Stage 2+).
 */
export default function PageHeader({ eyebrow, title, context, action, meta, className }: PageHeaderProps) {
  return (
    <header className={["ds-page-header", className].filter(Boolean).join(" ")}>
      <div className="ds-page-header__row">
        <div className="ds-page-header__titles">
          {eyebrow && <span className="ds-page-header__eyebrow">{eyebrow}</span>}
          <h1 className="ds-page-header__title">{title}</h1>
          {context && <p className="ds-page-header__context">{context}</p>}
        </div>
        {action && <div className="ds-page-header__action">{action}</div>}
      </div>
      {meta && meta.length > 0 && (
        <dl className="ds-page-header__meta">
          {meta.map((item, index) => (
            <div className="ds-page-header__meta-item" key={index}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
