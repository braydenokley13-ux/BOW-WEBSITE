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

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header
      style={{
        background: "var(--bow-ink)",
        color: "#fff",
        borderBottom: "1px solid var(--bow-dark-border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        className="bow-container-wide"
        style={{
          padding: "0 clamp(18px,4vw,40px)",
          height: 66,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link href="/" aria-label={`${SITE.name} home`} style={{ display: "flex", flexDirection: "column", lineHeight: 0.8, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 28, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
            BOW
          </span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 9.5,
              letterSpacing: "0.34em",
              color: "#9a9da6",
              textTransform: "uppercase",
              marginTop: 3,
            }}
          >
            {SITE.tagline}
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="bow-nav-desktop" style={{ gap: "clamp(8px,0.9vw,18px)", flex: 1, justifyContent: "center" }}>
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "clamp(11px,0.8vw,13px)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: active ? "#fff" : "#9a9da6",
                  paddingBottom: 3,
                  borderBottom: `2px solid ${active ? "var(--bow-blue)" : "transparent"}`,
                  whiteSpace: "nowrap",
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="bow-nav-desktop" style={{ alignItems: "center", gap: 14, flexShrink: 0 }}>
          <Link href="/sign-in" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9a9da6" }}>
            Sign In
          </Link>
          <Link href="/sign-up" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", color: "#fff" }}>
            Sign Up
          </Link>
          <Button href="/programs" variant="primary" size="sm" style={{ height: 36 }}>
            Explore Programs
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="bow-nav-mobile-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          style={{
            background: "transparent",
            border: "1px solid var(--bow-dark-border)",
            color: "#fff",
            width: 42,
            height: 38,
            borderRadius: 4,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          <span style={{ display: "block", width: 18, height: 2, background: "#fff" }} />
          <span style={{ display: "block", width: 18, height: 2, background: "#fff" }} />
          <span style={{ display: "block", width: 18, height: 2, background: "#fff" }} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="bow-nav-mobile" style={{ borderTop: "1px solid var(--bow-dark-border)", padding: "12px clamp(18px,4vw,40px) 22px", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 22,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                padding: "10px 0",
                borderBottom: "1px solid var(--bow-dark-border)",
                color: isActive(pathname, n.href) ? "#fff" : "#c8cad0",
              }}
            >
              {n.label}
            </Link>
          ))}
          <Link
            href="/sign-in"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, letterSpacing: "0.02em", textTransform: "uppercase", padding: "10px 0", borderBottom: "1px solid var(--bow-dark-border)", color: "#c8cad0" }}
          >
            Sign In
          </Link>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Button href="/programs" variant="primary" size="md" full style={{ height: 44 }}>
              Explore Programs
            </Button>
            <Button href="/sign-up" variant="secondary" size="md" full style={{ height: 44, color: "#fff", borderColor: "var(--bow-dark-border)" }}>
              Sign Up
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
