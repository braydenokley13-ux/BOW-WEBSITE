import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = {
  title: { default: "Family Dashboard", template: "%s · BOW Family" },
  description: "Your children's BOW Sports Capital programs, requirements, and schedule.",
  robots: { index: false, follow: false },
};

/**
 * Own layout, own route group — the parent surface never shares chrome with
 * the staff/instructor app shell (they have different navigation, different
 * data scope, and must never accidentally expose an admin control to a
 * guardian).
 */
export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole("parent");
  return (
    <div style={{ minHeight: "100vh", background: "var(--bow-paper, #f7f6f3)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px clamp(16px,4vw,32px)",
          borderBottom: "1px solid #e4e2dc",
          background: "#fff",
        }}
      >
        <Link href="/family" style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, textTransform: "uppercase", textDecoration: "none", color: "var(--bow-ink, #16181d)" }}>
          BOW Family
        </Link>
        <nav style={{ display: "flex", gap: 20, fontFamily: "var(--font-interface)", fontSize: 14 }}>
          <Link href="/family" style={{ color: "var(--bow-ink, #16181d)", textDecoration: "none" }}>Dashboard</Link>
          <Link href="/family/settings" style={{ color: "var(--bow-ink, #16181d)", textDecoration: "none" }}>Account</Link>
        </nav>
        <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate, #6b6e75)" }}>{me.email}</span>
      </header>
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "clamp(20px,4vw,40px) clamp(16px,4vw,24px)" }}>{children}</main>
    </div>
  );
}
