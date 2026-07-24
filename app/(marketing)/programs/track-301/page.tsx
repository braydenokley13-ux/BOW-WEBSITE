import Link from "next/link";
import { Button } from "@/components/ds";
import { track301Areas, track301Build } from "@/lib/programs";
import type { BuildAreaItem, BuildStep } from "@/lib/programs";

export const metadata = {
  title: "Track 301",
  description:
    "The room where the industry gets shaped. The executive track in development — negotiation, valuation, media rights, and the economics of an entire league.",
};

export default function Track301Page() {
  return (
    <div data-screen-label="Track 301" className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff" }}>
      {/* ===== HERO ===== */}
      <section style={{ padding: "clamp(48px,6vw,96px) clamp(18px,4vw,40px) clamp(40px,5vw,64px)", borderBottom: "1px solid var(--bow-dark-border)", overflow: "hidden", position: "relative" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", right: -20, top: -70, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(220px,32vw,520px)", lineHeight: 0.7, color: "rgba(255,255,255,0.045)", pointerEvents: "none" }}>301</div>
        <div className="bow-drift-l" aria-hidden style={{ position: "absolute", left: 0, top: "60%", width: "50%", height: 6, background: "rgba(255,179,0,0.18)", pointerEvents: "none", zIndex: 0 }} />
        <div className="bow-container" style={{ position: "relative" }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#9a9da6" }}>
            <Link href="/programs" style={{ color: "#6f8bff" }}>Programs</Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "#fff" }}>Track 301</span>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-warning)" }}>Track 301 · Executive</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-ink)", background: "var(--bow-warning)", padding: "3px 9px" }}>In Development</span>
          </div>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(40px,6.5vw,92px)", lineHeight: 0.86, letterSpacing: "-0.02em", textTransform: "uppercase", maxWidth: "16ch" }}>The room where the industry gets shaped.</h1>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,21px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 640 }}>Track 301 moves past running one organization to the systems above it — negotiation, valuation, media rights, and the economics of an entire league. It&apos;s being built now with advanced and high-school students in mind.</p>
          <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Button href="/sign-up" variant="emphasis" size="lg">Join the Interest List</Button>
            <Button href="/programs/track-201" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>Explore Track 201</Button>
          </div>
        </div>
      </section>

      {/* ===== WHAT'S COMING ===== */}
      <section style={{ padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 36 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-warning)" }}>What&apos;s Coming</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,3.8vw,52px)", lineHeight: 0.95, letterSpacing: "-0.015em", textTransform: "uppercase" }}>The systems above the front office.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", borderTop: "1px solid var(--bow-dark-border)", borderLeft: "1px solid var(--bow-dark-border)" }}>
            {track301Areas.map((a: BuildAreaItem) => (
              <div key={a.n} style={{ borderRight: "1px solid var(--bow-dark-border)", borderBottom: "1px solid var(--bow-dark-border)", padding: "24px 22px 28px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, color: "var(--bow-warning)" }}>{a.n}</span>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 19, textTransform: "uppercase", letterSpacing: "0.01em" }}>{a.title}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "#9a9da6" }}>{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BUILD ROADMAP ===== */}
      <section style={{ padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "start" }}>
          <div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-warning)" }}>Build Status</span>
            <h2 style={{ margin: "10px 0 16px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.4vw,44px)", lineHeight: 0.95, letterSpacing: "-0.015em", textTransform: "uppercase" }}>In development — honestly.</h2>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 460 }}>We&apos;re designing the curriculum and the simulation engine now, with pilot cohorts to follow. Join the interest list and we&apos;ll bring you in as each piece opens.</p>
          </div>
          <div style={{ border: "1px solid var(--bow-dark-border)" }}>
            {track301Build.map((b: BuildStep) => (
              <div key={b.n} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px clamp(18px,2.4vw,26px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 600, color: "#6d7078", flex: "0 0 28px" }}>{b.n}</span>
                <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 999, background: b.dot, flex: "0 0 auto" }} />
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(16px,1.8vw,20px)", textTransform: "uppercase", letterSpacing: "0.01em", flex: 1 }}>{b.label}</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a9da6" }}>{b.state}</span>
              </div>
            ))}
            <div style={{ padding: "22px clamp(18px,2.4vw,26px)" }}>
              <Button href="/sign-up" variant="emphasis" size="md" full>Get Launch Updates</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
