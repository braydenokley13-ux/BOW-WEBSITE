import Link from "next/link";
import { FOOTER_COLS, SITE } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="bow-footer">
      <div className="bow-container-wide">
        <div className="bow-footer-grid">
          <div className="bow-footer-brand">
            <div className="bow-wordmark">
              <span className="bow-wordmark-name" style={{ fontSize: 30 }}>BOW</span>
              <span className="bow-wordmark-sub">{SITE.tagline}</span>
            </div>
            <p style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", lineHeight: "var(--lh-body)", color: "var(--bow-on-ink-muted)" }}>
              {SITE.blurb}
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <nav key={col.head} aria-label={col.head} className="bow-footer-col">
              <span className="bow-eyebrow" style={{ color: "var(--bow-on-ink-faint)" }}>{col.head}</span>
              {col.links.map((lk) => (
                <Link key={lk.label} href={lk.href} className="bow-footer-link">
                  {lk.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="bow-footer-base bow-data">
          <span>© {new Date().getFullYear()} BOW SPORTS CAPITAL</span>
          <span>EDITORIAL ON THE OUTSIDE · FRONT OFFICE ON THE INSIDE</span>
        </div>
      </div>
    </footer>
  );
}
