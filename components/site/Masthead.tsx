"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ds/Button";
import type { NavMenuData } from "@/lib/cms/sections";

/**
 * Primary navigation.
 *
 * Every label, destination, order, and button on this bar comes from the
 * Navigation document the founder edits in BOW HQ → Website → Navigation. The
 * component keeps only interaction: the mobile sheet, the escape key, and which
 * link is marked current.
 */

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Masthead({
  nav,
  siteName,
  tagline,
}: {
  nav: NavMenuData;
  siteName: string;
  tagline: string;
}) {
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

  const items = nav.items.filter((item) => item.visible && item.label && item.href);

  return (
    <header className="bow-masthead">
      <div className="bow-container-wide bow-masthead-bar">
        <Link href="/" onClick={closeMenu} aria-label={`${siteName} home`} className="bow-wordmark">
          <span className="bow-wordmark-name">BOW</span>
          <span className="bow-wordmark-sub">{tagline}</span>
        </Link>

        <nav className="bow-nav-desktop" aria-label="Primary">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const children = item.children.filter((child) => child.visible && child.label && child.href);
            return (
              <span key={`${item.label}-${item.href}`} className="bow-nav-item">
                <Link
                  href={item.href}
                  className="bow-nav-link"
                  aria-current={active ? "page" : undefined}
                  data-active={active ? "true" : undefined}
                >
                  {item.label}
                </Link>
                {children.length > 0 ? (
                  <span className="bow-nav-dropdown" role="group" aria-label={`${item.label} links`}>
                    {children.map((child) => (
                      <Link key={`${child.label}-${child.href}`} href={child.href} className="bow-nav-dropdown-link">
                        {child.label}
                      </Link>
                    ))}
                  </span>
                ) : null}
              </span>
            );
          })}
        </nav>

        <div className="bow-nav-desktop bow-masthead-account">
          <Link href={nav.signInHref || "/sign-in"} className="bow-nav-link">{nav.signInLabel || "Sign In"}</Link>
          {nav.primaryCtaLabel && nav.primaryCtaHref ? (
            <Button href={nav.primaryCtaHref} variant="primary" size="sm">{nav.primaryCtaLabel}</Button>
          ) : null}
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
            {items.flatMap((item) => [
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                onClick={closeMenu}
                className="bow-nav-mobile-link"
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                data-active={isActive(pathname, item.href) ? "true" : undefined}
              >
                {item.label}
              </Link>,
              ...item.children
                .filter((child) => child.visible && child.label && child.href)
                .map((child) => (
                  <Link
                    key={`${item.label}-${child.label}-${child.href}`}
                    href={child.href}
                    onClick={closeMenu}
                    className="bow-nav-mobile-link"
                    style={{ paddingLeft: 22, fontSize: "0.94em" }}
                  >
                    {child.label}
                  </Link>
                )),
            ])}
            <Link href={nav.signInHref || "/sign-in"} onClick={closeMenu} className="bow-nav-mobile-link">
              {nav.signInLabel || "Sign In"}
            </Link>
          </nav>
          {/* Stacked: two full-width buttons side by side overflow narrow screens. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            {nav.primaryCtaLabel && nav.primaryCtaHref ? (
              <Button href={nav.primaryCtaHref} variant="primary" size="md" full onClick={closeMenu}>
                {nav.primaryCtaLabel}
              </Button>
            ) : null}
            {nav.secondaryCtaLabel && nav.secondaryCtaHref ? (
              <Button href={nav.secondaryCtaHref} variant="secondary" size="md" full onClick={closeMenu}>
                {nav.secondaryCtaLabel}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
