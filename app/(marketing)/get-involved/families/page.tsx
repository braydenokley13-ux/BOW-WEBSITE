import Link from "next/link";
import { Button } from "@/components/ds";
import { AudienceFaq } from "@/components/site/InquiryForm";
import {
  familiesStudentJourney,
  familiesRewards,
  familiesFaqs,
} from "@/lib/get-involved";

export const metadata = {
  title: "For Families & Students",
  description:
    "You don't need to know economics before you start. BOW is built for students curious about sports, business, leadership, strategy, or money.",
};

const SECTION_PAD = "clamp(56px,8vw,120px) clamp(18px,4vw,40px)";

export default function FamiliesPage() {
  return (
    <div data-screen-label="Families & Students">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)", borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", right: "-2%", top: "-6%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,24vw,400px)", lineHeight: 0.78, color: "rgba(10,10,11,0.04)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none" }}>Play</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)", marginBottom: 28 }}>
            <Link href="/" style={{ color: "var(--bow-blue)" }}>Home</Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "var(--bow-ink)" }}>Families &amp; Students</span>
          </nav>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>For Families &amp; Students</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(38px,5.5vw,72px)", lineHeight: 0.98, letterSpacing: "-0.015em", maxWidth: "18ch", textWrap: "balance" }}>You don&apos;t need to know economics before you start.</h1>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.5vw,21px)", lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 580 }}>You enter a sports decision and learn through making choices. BOW is built for students who are curious about sports, business, leadership, strategy, or money — not for students who already know the vocabulary.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Button href="/get-involved" variant="primary" size="lg">Join a Future BOW Program</Button>
            <Button href="/programs/track-101" variant="secondary" size="lg">Explore the Lessons</Button>
          </div>
        </div>
      </section>

      {/* ===== STUDENT JOURNEY (dark) ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 44 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>The Student Experience</span>
            <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,52px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Eight moves. One complete lesson.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)" }}>
            {familiesStudentJourney.map((s) => (
              <div key={s.n} className="bow-reveal-sm" style={{ background: "var(--bow-dark-surface)", padding: "clamp(20px,2.4vw,28px)", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 22, color: "var(--bow-blue)", lineHeight: 0.9 }}>{s.n}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 16, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1.05, color: "#fff" }}>{s.label}</span>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "#9a9da6" }}>{s.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== STUDENT EXAMPLE + WHAT BOW REWARDS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "start" }}>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>What a Student Experiences</span>
              <h2 style={{ margin: "10px 0 20px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,40px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>You&apos;re the General Manager.</h2>
              <div style={{ background: "#fff", border: "1px solid var(--border-rule)", borderLeft: "5px solid var(--bow-blue)", padding: "clamp(22px,2.8vw,32px)" }}>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", marginBottom: 12 }}>Track 101 · You&apos;re the GM</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)", flexShrink: 0, paddingTop: 2 }}>Role</span>
                    <span style={{ fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.4 }}>General Manager, $38M cap space, four roster problems.</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)", flexShrink: 0, paddingTop: 2 }}>Decision</span>
                    <span style={{ fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.4 }}>One expensive star, two role players, depth and flexibility, or save it for next year?</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-orange)", flexShrink: 0, paddingTop: 2 }}>Concepts</span>
                    <span style={{ fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.4 }}>Scarcity and opportunity cost — encountered through the decision, then named.</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-ink)", flexShrink: 0, paddingTop: 2 }}>Transfer</span>
                    <span style={{ fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.4 }}>The same allocation logic in a school activity budget, a nonprofit, or a household.</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>What BOW Rewards</span>
              <h2 style={{ margin: "10px 0 20px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,40px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>Deep sports knowledge is not required.</h2>
              <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>The program is designed to reward reasoning, not fandom. A student who follows the NBA closely and a student who doesn&apos;t both engage with the same decision — the difference is the quality of thinking brought to it.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {familiesRewards.map((r) => (
                  <div key={r} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--bow-paper)", border: "1px solid var(--border-rule)" }}>
                    <span style={{ width: 6, height: 6, background: "var(--bow-blue)", flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{r}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, padding: "16px 18px", background: "#fff", border: "1px solid var(--border-rule)", borderLeft: "4px solid var(--bow-orange)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)", display: "block", marginBottom: 8 }}>On Evaluation</span>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>A strategically poor sports choice is not treated as academic failure. BOW evaluates the quality of the reasoning, the evidence used, and the ability to explain the economic tradeoff — separately from the sports outcome. We are building the formal evaluation framework and will share it as it develops.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAMILY FAQ ===== */}
      <section style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Families FAQ</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,52px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Questions from parents and students.</h2>
          </div>
          <AudienceFaq items={familiesFaqs} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 44 }}>
            <Button href="/get-involved" variant="primary" size="lg">Join a Future BOW Program</Button>
            <Button href="/programs" variant="secondary" size="lg">Explore Programs</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
