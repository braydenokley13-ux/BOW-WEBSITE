import Link from "next/link";
import type { Metadata } from "next";
import AcceptInvitationForm from "@/components/site/AcceptInvitationForm";

export const metadata: Metadata = {
  title: "Accept your invitation — BOW Sports Capital",
  description: "Securely accept an invitation to BOW Sports Capital.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * The server deliberately does not read searchParams or invitation data here.
 * The browser extracts the bearer token from the URL fragment, scrubs it, and
 * proves possession through the rate-limited preview Server Action.
 */
export default function AcceptInvitationPage() {
  return (
    <div
      className="bow-front-office"
      style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px clamp(18px,4vw,40px)",
          borderBottom: "1px solid var(--bow-dark-border)",
        }}
      >
        <Link href="/" style={{ display: "flex", flexDirection: "column", lineHeight: 0.8, textDecoration: "none", color: "#fff" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
            BOW
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 9, letterSpacing: "0.32em", color: "#9a9da6", textTransform: "uppercase", marginTop: 2 }}>
            Sports Capital
          </span>
        </Link>
        <Link href="/sign-in" style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "#b9bcc4", textDecoration: "none" }}>
          Already have an account? Sign in
        </Link>
      </div>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "clamp(28px,4vw,56px) clamp(18px,4vw,32px)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 540 }}>
          <AcceptInvitationForm />
          <noscript>
            <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", color: "#fff", lineHeight: 1.6 }}>
              JavaScript is required to read the private part of this invitation link. Enable it and reload, or contact BOW for help.
            </p>
          </noscript>
        </div>
      </main>
    </div>
  );
}
