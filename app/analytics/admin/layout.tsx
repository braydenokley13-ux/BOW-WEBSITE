import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Analytics Admin — BOW Sports Capital",
  description: "Publishing desk for the BOW analytics section — articles, embeds, and data status.",
  robots: { index: false, follow: false },
};

export default async function AnalyticsAdminLayout({ children }: { children: React.ReactNode }) {
  // Admin only — same guard as /admin (proxy checks the cookie, this
  // layout is the authoritative role check).
  const me = await requireUser();
  if (me.role !== "admin") redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bow-paper)" }}>
      <header className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px clamp(18px,4vw,40px)" }}>
          <Link href="/analytics/admin" style={{ display: "flex", alignItems: "baseline", gap: 10, textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, letterSpacing: "-0.02em", textTransform: "uppercase", color: "#fff" }}>
              BOW
            </span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
              Analytics Desk
            </span>
          </Link>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {[
              { label: "Articles", href: "/analytics/admin" },
              { label: "View dashboard", href: "/analytics" },
              { label: "View publication", href: "/analytics/articles" },
              { label: "Platform admin", href: "/admin" },
            ].map((n) => (
              <Link key={n.href} href={n.href} style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9a9da6", textDecoration: "none" }}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
