"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAppState } from "./AppState";
import { roleLabel as roleLabelFor, roleAccent as roleAccentFor, initials, type Role } from "@/lib/account";

const NAV_BY_ROLE: Record<Role, { label: string; href: string }[]> = {
  student: [
    { label: "Home", href: "/app/student" },
    { label: "My Track", href: "/app/student/track" },
    { label: "Account", href: "/app/settings" },
  ],
  instructor: [
    { label: "Today", href: "/app/instructor" },
    { label: "Cohorts", href: "/app/instructor/cohort" },
    { label: "Account", href: "/app/settings" },
  ],
  admin: [
    { label: "Overview", href: "/app/admin" },
    { label: "Inquiries", href: "/app/admin/inquiries" },
    { label: "Organizations", href: "/app/admin/organizations" },
    { label: "Cohorts", href: "/app/admin/cohorts" },
    { label: "People", href: "/app/admin/people" },
    { label: "Invitations", href: "/app/admin/invitations" },
  ],
};

function isActive(pathname: string, href: string) {
  if (href === "/app/instructor/cohort") return pathname.startsWith("/app/instructor/cohort") || pathname.startsWith("/app/instructor/session");
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AuthHeader() {
  const { role, me, signOut } = useAppState();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!role) return null;

  const nav = NAV_BY_ROLE[role];
  const accent = roleAccentFor(role);

  const goPublic = () => {
    signOut();
    router.push("/");
  };

  return (
    <header style={{ background: "var(--bow-white)", color: "var(--bow-ink)", borderBottom: "1px solid var(--border-rule)", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(16px,4vw,32px)", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <Link href="/app" aria-label="BOW home" style={{ display: "flex", flexDirection: "column", lineHeight: 0.78, flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, letterSpacing: "-0.02em", textTransform: "uppercase" }}>BOW</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 8, letterSpacing: "0.3em", color: "var(--bow-slate)", textTransform: "uppercase", marginTop: 2 }}>Sports Capital</span>
          </Link>
          <span style={{ width: 1, height: 26, background: "var(--border-rule)", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, whiteSpace: "nowrap" }}>
            {roleLabelFor(role)}
          </span>
        </div>

        <nav className="bow-nav-desktop" style={{ gap: "clamp(10px,1.4vw,26px)", flex: 1, justifyContent: "center" }}>
          {nav.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link key={n.href} href={n.href} style={{ fontFamily: "var(--font-display)", fontWeight: active ? 700 : 600, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: active ? "var(--bow-ink)" : "var(--bow-slate)", paddingBottom: 4, borderBottom: `2px solid ${active ? "var(--bow-ink)" : "transparent"}`, whiteSpace: "nowrap" }}>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="bow-nav-desktop" style={{ alignItems: "center", gap: 14, flexShrink: 0 }}>
          <button onClick={goPublic} style={{ fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--bow-slate)", whiteSpace: "nowrap", background: "transparent", border: "none", cursor: "pointer" }}>
            Public site
          </button>
          <Link href="/app/settings" aria-label="Account" style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 10px 5px 6px", border: "1px solid var(--border-rule)", borderRadius: 999, color: "var(--bow-ink)" }}>
            <span style={{ width: 28, height: 28, borderRadius: 999, background: accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12 }}>
              {me ? initials(me.name) : "G"}
            </span>
            <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{me ? me.first : "Guest"}</span>
          </Link>
        </div>

        <button
          className="bow-nav-mobile-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          style={{ background: "transparent", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", width: 40, height: 36, borderRadius: 4, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}
        >
          <span style={{ display: "block", width: 16, height: 2, background: "var(--bow-ink)" }} />
          <span style={{ display: "block", width: 16, height: 2, background: "var(--bow-ink)" }} />
          <span style={{ display: "block", width: 16, height: 2, background: "var(--bow-ink)" }} />
        </button>
      </div>

      {menuOpen && (
        <div className="bow-nav-mobile" style={{ borderTop: "1px solid var(--border-rule)", padding: "10px clamp(16px,4vw,32px) 18px", flexDirection: "column", gap: 2 }}>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "0.02em", textTransform: "uppercase", padding: "11px 0", borderBottom: "1px solid var(--border-rule)", color: isActive(pathname, n.href) ? "var(--bow-ink)" : "var(--bow-slate)" }}>
              {n.label}
            </Link>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>{me ? me.name : "Guest"}</span>
            <button onClick={goPublic} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)", background: "transparent", border: "none", cursor: "pointer" }}>
              Public site
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
