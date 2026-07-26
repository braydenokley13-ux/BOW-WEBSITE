import Link from "next/link";
import { Button } from "@/components/ds";
import {
  partnerCategories,
  partnerVerifiedFacts,
  partnerFitItems,
} from "@/lib/get-involved";

export const metadata = {
  title: "For Partners",
  description:
    "Build the program. Expand the access. BOW is building relationships with organizations that can strengthen the curriculum, grow distribution, and deepen credibility.",
};

const SECTION_PAD = "clamp(56px,8vw,120px) clamp(18px,4vw,40px)";

export default function PartnersPage() {
  return (
    <div data-screen-label="Partners">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)", borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "hidden" }}>
        <div className="bow-ghost" aria-hidden style={{ position: "absolute", right: "-2%", top: "-6%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,24vw,400px)", lineHeight: 0.78, color: "rgba(10,10,11,0.04)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none" }}>Build</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)", marginBottom: 28 }}>
            <Link href="/" style={{ color: "var(--bow-blue)" }}>Home</Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "var(--bow-ink)" }}>Partners</span>
          </nav>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>For Partners</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(38px,5.5vw,72px)", lineHeight: 0.98, letterSpacing: "-0.015em", maxWidth: "18ch", textWrap: "balance" }}>Build the program. Expand the access.</h1>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.5vw,21px)", lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 580 }}>BOW is actively building relationships with organizations that can strengthen the curriculum, grow distribution, support access, or deepen the program&apos;s credibility. This is not a generic sponsorship page.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Button href="/get-involved/partner-inquiry" variant="primary" size="lg">Start a Partnership</Button>
            <Button href="/programs/track-101" variant="secondary" size="lg">Understand the Curriculum</Button>
          </div>
        </div>
      </section>

      {/* ===== PARTNERSHIP CATEGORIES ===== */}
      <section style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Partnership Categories</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.4vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>Six paths into the program.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
            {partnerCategories.map((p) => (
              <div key={p.title} className="bow-reveal-sm" style={{ border: "1px solid var(--border-rule)", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.01em" }}>{p.title}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HONEST NUMBERS + PARTNERSHIP FIT (dark) ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(28px,4vw,56px)" }}>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Where BOW Is Today</span>
              <h2 style={{ margin: "12px 0 24px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,3.2vw,40px)", lineHeight: 0.95, letterSpacing: "-0.015em", textTransform: "uppercase" }}>Honest numbers.</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid var(--bow-dark-border)" }}>
                {partnerVerifiedFacts.map((f) => (
                  <div key={f.label} style={{ background: "var(--bow-dark-surface)", padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 16, borderBottom: "1px solid var(--bow-dark-border)" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: "clamp(24px,3vw,34px)", color: "#fff", lineHeight: 0.9, flexShrink: 0 }}>{f.value}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.01em", color: "#fff" }}>{f.label}</span>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", color: "#6d7078" }}>{f.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Partnership Fit</span>
              <h2 style={{ margin: "12px 0 24px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,3.2vw,40px)", lineHeight: 0.95, letterSpacing: "-0.015em", textTransform: "uppercase" }}>What we can build together.</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {partnerFitItems.map((p) => (
                  <div key={p.who} style={{ border: "1px solid var(--bow-dark-border)", padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 16, textTransform: "uppercase", letterSpacing: "0.01em", color: "var(--bow-blue)" }}>{p.who}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>You contribute</span>
                      <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.4, color: "#c8cad0" }}>{p.contribute}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>We build</span>
                      <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.4, color: "#c8cad0" }}>{p.build}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
                <Button href="/get-involved" variant="primary" size="lg">Explore a Partnership</Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
