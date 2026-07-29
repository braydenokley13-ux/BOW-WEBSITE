import Link from "next/link";
import type { FooterColumnsData } from "@/lib/cms/sections";

/**
 * Site footer.
 *
 * Description, columns, contact line, social links, and legal links are all
 * founder-edited (Website → Navigation → Footer). The year and the layout are
 * the only things this file decides.
 */
export default function Footer({
  footer,
  organizationName,
}: {
  footer: FooterColumnsData;
  organizationName: string;
}) {
  const columns = footer.columns.filter((column) => column.heading && column.links.length > 0);
  const social = footer.socialLinks.filter((link) => link.label && link.href);
  const legal = footer.legalLinks.filter((link) => link.label && link.href);

  return (
    <footer className="bow-footer">
      <div className="bow-container-wide">
        <div className="bow-footer-grid">
          <div className="bow-footer-brand">
            <div className="bow-wordmark">
              <span className="bow-wordmark-name" style={{ fontSize: 30 }}>BOW</span>
              <span className="bow-wordmark-sub">{footer.tagline || organizationName}</span>
            </div>
            {footer.description ? (
              <p style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", lineHeight: "var(--lh-body)", color: "var(--bow-on-ink-muted)" }}>
                {footer.description}
              </p>
            ) : null}
            {footer.contactText ? (
              <p style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", lineHeight: "var(--lh-body)", color: "var(--bow-on-ink-faint)" }}>
                {footer.contactText}
              </p>
            ) : null}
            {social.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                {social.map((link) => (
                  <a key={link.href} href={link.href} className="bow-footer-link" rel="noreferrer noopener" target="_blank">
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="bow-footer-col">
              <span className="bow-eyebrow" style={{ color: "var(--bow-on-ink-faint)" }}>{column.heading}</span>
              {column.links.map((link) => (
                <Link key={`${column.heading}-${link.label}`} href={link.href} className="bow-footer-link">
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="bow-footer-base bow-data">
          <span>© {new Date().getFullYear()} {organizationName.toUpperCase()}</span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            {legal.map((link) => (
              <Link key={link.href} href={link.href} className="bow-footer-link">
                {link.label}
              </Link>
            ))}
            {footer.baseNote ? <span>{footer.baseNote}</span> : null}
          </span>
        </div>
      </div>
    </footer>
  );
}
