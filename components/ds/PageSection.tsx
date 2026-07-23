import type { ReactNode } from "react";

interface PageSectionProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Omit the top hairline — use for the first section on a page. */
  noRule?: boolean;
}

/**
 * Hairline-separated content section. Not boxed, no shadow — sections read
 * as a continuous page divided by rules, matching the calm front-office
 * visual direction (no SaaS card grids).
 */
export default function PageSection({ title, action, children, className, noRule }: PageSectionProps) {
  return (
    <section className={["ds-page-section", noRule && "ds-page-section--no-rule", className].filter(Boolean).join(" ")}>
      {(title || action) && (
        <div className="ds-page-section__head">
          {title && <h2 className="ds-page-section__title">{title}</h2>}
          {action && <div className="ds-page-section__action">{action}</div>}
        </div>
      )}
      <div className="ds-page-section__body">{children}</div>
    </section>
  );
}
