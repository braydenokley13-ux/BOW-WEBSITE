"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "./AppState";
import { roleLabel as roleLabelFor, roleAccent as roleAccentFor, initials, SELF_PACED_COHORT_ID } from "@/lib/account";
import {
  activeNavId,
  groupContainsActive,
  navForRole,
  routeIsActive,
  type NavLink,
} from "@/lib/navigation/catalog";

export default function AuthHeader({
  instructorCanDeliver = true,
  cutoverEnabled = true,
}: {
  instructorCanDeliver?: boolean;
  cutoverEnabled?: boolean;
}) {
  const pathname = usePathname();
  return (
    <AuthHeaderForPath
      key={pathname}
      pathname={pathname}
      instructorCanDeliver={instructorCanDeliver}
      cutoverEnabled={cutoverEnabled}
    />
  );
}

function AuthHeaderForPath({
  pathname,
  instructorCanDeliver,
  cutoverEnabled,
}: {
  pathname: string;
  instructorCanDeliver: boolean;
  cutoverEnabled: boolean;
}) {
  const { role, me, data, signOut } = useAppState();
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // BOW runs the cohort-taught workspace and a separate self-paced product.
  // The bridge is a utility link because it changes product context rather
  // than representing another section of the current workspace.
  const alsoSelfPaced =
    role === "student"
      ? data.enrollments.some((enrollment) => enrollment.cohortId === SELF_PACED_COHORT_ID && enrollment.enroll === "active")
      : role === "instructor"
        ? data.cohorts.some((cohort) => cohort.id === SELF_PACED_COHORT_ID)
        : false;
  const selfPacedHref = role === "student" ? "/dashboard" : "/instructor";
  const navigation = navForRole(role, { instructorCanDeliver, cutoverEnabled });
  const activeId = activeNavId(pathname, navigation);
  const accent = roleAccentFor(role);

  useEffect(() => {
    const closeOnPointerOutside = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setOpenGroup(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnPointerOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const desktopLink = (item: NavLink) => {
    const active = item.id === activeId;
    return (
      <Link
        key={item.id}
        href={item.href}
        className="bow-app-nav__link"
        data-active={active ? "true" : undefined}
        aria-current={active ? "page" : undefined}
        onClick={() => setOpenGroup(null)}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <header ref={headerRef} className="bow-app-header">
      <div className="bow-app-header__bar">
        <div className="bow-app-header__brand">
          <Link href="/app" aria-label="BOW home" className="bow-app-header__logo">
            <span className="bow-app-header__logo-mark">BOW</span>
            <span className="bow-app-header__logo-name">Sports Capital</span>
          </Link>
          <span className="bow-app-header__rule" aria-hidden="true" />
          <span className="bow-app-header__role" style={{ color: accent }}>
            {roleLabelFor(role)}
          </span>
        </div>

        <nav className="bow-nav-desktop bow-app-nav" aria-label="Primary navigation">
          {navigation.map((entry) => {
            if (entry.kind === "link") return desktopLink(entry);
            const expanded = openGroup === entry.id;
            const active = groupContainsActive(entry, activeId);
            const panelId = `bow-nav-${entry.id}`;
            return (
              <div className="bow-app-nav__group" key={entry.id}>
                <button
                  type="button"
                  className="bow-app-nav__trigger"
                  data-active={active ? "true" : undefined}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpenGroup((current) => current === entry.id ? null : entry.id)}
                >
                  {entry.label}<span aria-hidden="true">⌄</span>
                </button>
                <div id={panelId} className="bow-app-nav__panel" hidden={!expanded}>
                  <span className="bow-app-nav__panel-label">{entry.label}</span>
                  {entry.items.map(desktopLink)}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="bow-nav-desktop bow-app-header__utilities">
          {alsoSelfPaced && <Link href={selfPacedHref} className="bow-app-header__utility-link">Self-paced</Link>}
          <Link href="/" target="_blank" rel="noopener noreferrer" className="bow-app-header__utility-link">
            Public site
          </Link>
          <button type="button" onClick={signOut} className="bow-app-header__utility-button">Sign out</button>
          <Link
            href="/app/settings"
            aria-label="Account"
            aria-current={routeIsActive(pathname, "/app/settings") ? "page" : undefined}
            className="bow-app-header__account"
            data-active={routeIsActive(pathname, "/app/settings") ? "true" : undefined}
          >
            <span className="bow-app-header__avatar" style={{ background: accent }}>{initials(me.name)}</span>
            <span>{me.first}</span>
          </Link>
        </div>

        <button
          type="button"
          className="bow-nav-mobile-toggle bow-app-header__menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? "bow-mobile-navigation" : undefined}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen && (
        <nav id="bow-mobile-navigation" className="bow-nav-mobile bow-app-mobile-nav" aria-label="Mobile navigation">
          {navigation.map((entry) => {
            if (entry.kind === "link") {
              const active = entry.id === activeId;
              return (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className="bow-app-mobile-nav__primary"
                  data-active={active ? "true" : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {entry.label}
                </Link>
              );
            }
            return (
              <section className="bow-app-mobile-nav__group" key={entry.id} aria-labelledby={`bow-mobile-${entry.id}`}>
                <span id={`bow-mobile-${entry.id}`} className="bow-app-mobile-nav__label">{entry.label}</span>
                <div className="bow-app-mobile-nav__links">
                  {entry.items.map((item) => {
                    const active = item.id === activeId;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        data-active={active ? "true" : undefined}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <div className="bow-app-mobile-nav__utilities">
            <span>{me.name}</span>
            <Link href="/app/settings" aria-current={routeIsActive(pathname, "/app/settings") ? "page" : undefined} onClick={() => setMenuOpen(false)}>Account</Link>
            {alsoSelfPaced && <Link href={selfPacedHref} onClick={() => setMenuOpen(false)}>Self-paced</Link>}
            <Link href="/" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Public site</Link>
            <button type="button" onClick={signOut}>Sign out</button>
          </div>
        </nav>
      )}
    </header>
  );
}
