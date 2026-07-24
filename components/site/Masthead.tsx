"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, SITE } from "@/lib/site";
import Button from "@/components/ds/Button";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Masthead() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const closeMenu = () => setMenuOpen(false);

  // Route changes must close the sheet — otherwise a tapped link navigates
  // underneath an overlay that is still covering the page. Adjusted during
  // render rather than in an effect, so the sheet is already gone on the
  // first paint of the new route instead of flashing for a frame.
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  // Escape closes; the body locks while the sheet covers the page.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  return (
    <header className="bow-masthead">
      <div className="bow-container-wide bow-masthead-bar">
        <Link href="/" onClick={closeMenu} aria-label={`${SITE.name} home`} className="bow-wordmark">
          <span className="bow-wordmark-name">BOW</span>
          <span className="bow-wordmark-sub">{SITE.tagline}</span>
        </Link>

        <nav className="bow-nav-desktop" aria-label="Primary">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className="bow-nav-link"
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : undefined}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="bow-nav-desktop bow-masthead-account">
          <Link href="/sign-in" className="bow-nav-link">Sign In</Link>
          <Button href="/programs" variant="primary" size="sm">Find a Program</Button>
        </div>

        <button
          type="button"
          className="bow-nav-mobile-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="bow-mobile-menu"
        >
          <span aria-hidden className="bow-burger" data-open={menuOpen ? "true" : undefined} />
        </button>
      </div>

      {menuOpen && (
        <div id="bow-mobile-menu" className="bow-nav-mobile">
          <nav aria-label="Primary mobile">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={closeMenu}
                className="bow-nav-mobile-link"
                aria-current={isActive(pathname, n.href) ? "page" : undefined}
                data-active={isActive(pathname, n.href) ? "true" : undefined}
              >
                {n.label}
              </Link>
            ))}
            <Link href="/sign-in" onClick={closeMenu} className="bow-nav-mobile-link">
              Sign In
            </Link>
          </nav>
          {/* Stacked: two full-width buttons side by side overflow narrow screens. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            <Button href="/programs" variant="primary" size="md" full onClick={closeMenu}>
              Find a Program
            </Button>
            <Button href="/teach" variant="secondary" size="md" full onClick={closeMenu}>
              Apply to Teach
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
