import Link from "next/link";
import { Button, SectionHeader } from "@/components/ds";
import { AudienceFaq } from "@/components/site/InquiryForm";
import {
  schoolAudiences,
  learningMethod,
  schoolsExampleFlow,
  reasoningFramework,
  trackScaffolding,
  schoolsSessions,
  schoolsFeaturedLessons,
  schoolsOutcomes,
  schoolsLogistics,
  formats,
  schoolsFaqs,
} from "@/lib/get-involved";

export const metadata = {
  title: "For Schools — BOW Sports Capital",
  description:
    "Economics becomes real when the student has to make the decision. BOW puts students in the room where sports-business decisions get made.",
};

const SECTION_PAD = "clamp(56px,8vw,120px) clamp(18px,4vw,40px)";

export default function SchoolsPage() {
  return (
    <div data-screen-label="Schools">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)", borderBottom: "1px solid var(--bow-dark-border)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", right: "-2%", top: "-10%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,26vw,440px)", lineHeight: 0.78, color: "rgba(255,255,255,0.04)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none" }}>GM</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#6d7078", marginBottom: 28 }}>
            <Link href="/" style={{ color: "#6f8bff" }}>Home</Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "#fff" }}>Schools</span>
          </nav>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>For Schools</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(38px,5.5vw,72px)", lineHeight: 0.98, letterSpacing: "-0.015em", maxWidth: "18ch", textWrap: "balance", color: "#fff" }}>Economics becomes real when the student has to make the decision.</h1>
          <p style={{ margin: "22px 0", fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.5vw,21px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 580 }}>BOW puts students in the room where sports-business decisions get made. They analyze evidence, explain economic tradeoffs, make choices under real constraints, and defend their reasoning — all through decisions they already care about.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}>
            {schoolAudiences.map((a) => (
              <span key={a} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, padding: "7px 14px", border: "1px solid var(--bow-dark-border)", borderRadius: 999, color: "#c8cad0" }}>{a}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Button href="/get-involved" variant="primary" size="lg">Bring BOW to a School</Button>
            <Button href="/programs/track-101" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>Explore the Curriculum</Button>
          </div>
        </div>
      </section>

      {/* ===== METHODOLOGY: 7 STEPS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 760, marginBottom: 44 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Program Methodology</span>
            <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(28px,3.8vw,48px)", lineHeight: 1.04, letterSpacing: "-0.01em", textWrap: "balance" }}>The student encounters the economic problem before receiving the definition.</h2>
            <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,18px)", lineHeight: 1.65, color: "var(--bow-slate)" }}>BOW doesn&apos;t begin with vocabulary lists. Students enter a real sports decision, make a choice with real consequences, and discover the economics behind what happened. The concept arrives when it matters most — not in advance of the experience that makes it meaningful.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)" }}>
            {learningMethod.map((s) => (
              <div key={s.n} className="bow-reveal-sm" style={{ background: s.bg, color: s.fg, padding: "clamp(22px,2.6vw,30px)", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 26, color: s.numColor, lineHeight: 0.9 }}>{s.n}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 17, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1.05 }}>{s.label}</span>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: s.muted }}>{s.body}</span>
              </div>
            ))}
          </div>

          {/* Methodology in action */}
          <div style={{ marginTop: 44, border: "1px solid var(--border-rule)", borderLeft: "5px solid var(--bow-blue)", background: "#fff", padding: "clamp(24px,3vw,36px)" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Program Illustration · You&apos;re the GM · Track 101 · Module 2</span>
            <h3 style={{ margin: "10px 0 20px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(20px,2.6vw,30px)", textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 0.95 }}>From roster budgeting to economic reasoning.</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "clamp(16px,2vw,24px)" }}>
              {schoolsExampleFlow.map((e) => (
                <div key={e.stage} style={{ borderLeft: `3px solid ${e.accent}`, paddingLeft: 14 }}>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", marginBottom: 6 }}>{e.stage}</div>
                  <div style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15, lineHeight: 1.4, color: "var(--bow-ink)" }}>{e.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== REASONING FRAMEWORK ===== */}
      <section style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Economic Reasoning Framework</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.4vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>Five reasoning moves. Every lesson builds toward all five.</h2>
            <p style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>These habits are informed by the analytical thinking used in introductory economics, adapted for students in grades 5 through 8. Rigorous economic reasoning at an age-appropriate level — not test prep.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "clamp(12px,1.8vw,18px)" }}>
            {reasoningFramework.map((r) => (
              <div key={r.move} className="bow-reveal-sm" style={{ border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-blue)", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1 }}>{r.move}</span>
                <span style={{ fontFamily: "var(--font-editorial)", fontWeight: 500, fontSize: 15, lineHeight: 1.35, color: "var(--bow-ink)" }}>{r.question}</span>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>{r.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRACK SCAFFOLDING (dark) ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Track-Level Scaffolding</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,52px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Same economics. Different levels of support.</h2>
            <p style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "#b9bcc4" }}>The underlying economic concept stays rigorous across both tracks. The amount of structure changes — not the seriousness of the idea.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 0, border: "1px solid var(--bow-dark-border)" }}>
            {trackScaffolding.map((t) => (
              <div key={t.track} style={{ padding: "clamp(28px,3.5vw,44px)", borderRight: "1px solid var(--bow-dark-border)", display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(52px,7vw,80px)", lineHeight: 0.8, letterSpacing: "-0.03em", color: t.color }}>{t.track}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>{t.grade}</span>
                  </div>
                  <p style={{ margin: "12px 0 0", fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 17, lineHeight: 1.35, color: "#fff" }}>{t.headline}</p>
                </div>
                <div style={{ height: 4, background: t.color, width: 48 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {t.support.map((item) => (
                    <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ width: 5, height: 5, background: t.color, marginTop: 8, flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.5, color: "#c8cad0" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SIX-SESSION SEQUENCE ===== */}
      <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Sample Implementation</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.4vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>Six-session BOW program: a realistic sequence.</h2>
            <p style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>Each session is built around one central decision. The concept arrives through the problem — not before it. Sessions can be compressed, expanded, or rearranged.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--border-rule)" }}>
            {schoolsSessions.map((s) => (
              <div key={s.n} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto auto", gap: "clamp(12px,2vw,20px)", alignItems: "start", padding: "20px clamp(18px,2.4vw,28px)", borderBottom: "1px solid var(--border-rule)", background: s.bg }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 26, lineHeight: 0.9, color: "var(--bow-blue)", paddingTop: 2 }}>{s.n}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(17px,1.8vw,21px)", textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1.05, color: "var(--bow-ink)" }}>{s.title}</span>
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)", lineHeight: 1.4 }}>{s.output}</span>
                </div>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)", whiteSpace: "nowrap", paddingTop: 4 }}>{s.concept}</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", whiteSpace: "nowrap", paddingTop: 4 }}>{s.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED LESSONS ===== */}
      <section style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="Flagship Cases" title="Three decisions to start with." style={{ marginBottom: 40 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "clamp(16px,2vw,24px)" }}>
            {schoolsFeaturedLessons.map((l) => (
              <Link key={l.id} href={l.href} className="bow-card" aria-label={l.title} style={{ background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderTop: `4px solid ${l.accent}`, display: "flex", flexDirection: "column", gap: 14, padding: "24px 22px", color: "var(--bow-ink)" }}>
                <div>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{l.trackmod}</span>
                  <h3 style={{ margin: "6px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(20px,2.2vw,26px)", lineHeight: 1.1 }}>{l.title}</h3>
                </div>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, color: "var(--bow-slate)", flex: 1 }}>{l.summary}</p>
                <div style={{ borderTop: "1px solid var(--border-rule)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    <span style={{ color: "var(--bow-slate)" }}>Concept</span>
                    <span style={{ color: "var(--bow-ink)" }}>{l.concept}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    <span style={{ color: "var(--bow-slate)" }}>Runtime</span>
                    <span style={{ color: "var(--bow-ink)" }}>{l.duration}</span>
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)" }}>View the Lesson →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== OUTCOMES + LOGISTICS (dark) ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(28px,4vw,56px)" }}>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Observable Outcomes</span>
              <h2 style={{ margin: "12px 0 24px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,3.2vw,40px)", lineHeight: 0.95, letterSpacing: "-0.015em", textTransform: "uppercase" }}>What students actually do.</h2>
              <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--bow-dark-border)" }}>
                {schoolsOutcomes.map((o) => (
                  <div key={o} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 0", borderBottom: "1px solid var(--bow-dark-border)" }}>
                    <span style={{ color: "var(--bow-blue)", fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 12, flexShrink: 0, paddingTop: 3 }}>→</span>
                    <span style={{ fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.45, color: "#d6d8dd" }}>{o}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Delivery Details</span>
              <h2 style={{ margin: "12px 0 24px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,3.2vw,40px)", lineHeight: 0.95, letterSpacing: "-0.015em", textTransform: "uppercase" }}>How it runs.</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)", marginBottom: 22 }}>
                {schoolsLogistics.map((l) => (
                  <div key={l.label} style={{ background: "var(--bow-dark-surface)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>{l.label}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 18, color: "#fff", lineHeight: 1.15 }}>{l.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderLeft: "4px solid rgba(49,87,255,0.5)", padding: "16px 18px", background: "rgba(49,87,255,0.08)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)", display: "block", marginBottom: 8 }}>Academic Alignment</span>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "#b9bcc4" }}>BOW focuses on observable economic reasoning skills. A formal standards crosswalk is in development following educator review. Contact us to discuss alignment with your program goals directly.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SCHOOL FORMATS ===== */}
      <section style={{ background: "#fff", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="Formats" title="Pick the shape that fits" style={{ marginBottom: 32 }} />
          <div style={{ border: "1px solid var(--border-rule)" }}>
            {formats.map((f) => (
              <div key={f.n} style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px clamp(18px,2.4vw,28px)", borderBottom: "1px solid var(--border-rule)" }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 600, color: "var(--bow-blue)", flex: "0 0 30px" }}>{f.n}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(18px,2vw,24px)", textTransform: "uppercase", letterSpacing: "0.01em", flex: 1 }}>{f.title}</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", color: "var(--bow-slate)" }}>{f.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SCHOOL FAQ ===== */}
      <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Schools FAQ</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,52px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Answers for educators.</h2>
          </div>
          <AudienceFaq items={schoolsFaqs} />
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section style={{ background: "var(--bow-blue)", color: "#fff", padding: SECTION_PAD, position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", right: -20, bottom: -60, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(140px,22vw,360px)", lineHeight: 0.7, color: "rgba(255,255,255,0.08)", pointerEvents: "none" }}>GM</div>
        <div className="bow-container" style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 540 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,5vw,64px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Let&apos;s build the right program together.</h2>
            <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.6, color: "rgba(255,255,255,0.9)" }}>Tell us about your school or group. We&apos;ll follow up with program options, timing, and next steps.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Button href="/get-involved" variant="ink" size="lg">Bring BOW to a School</Button>
            <Button href="/get-involved/camps" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.5)" }}>Camps</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
