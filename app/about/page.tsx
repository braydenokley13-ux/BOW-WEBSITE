import { Button, CapLine } from "@/components/ds";
import { aboutOutcomes } from "@/lib/about";
import { impact, quotes } from "@/lib/home";

export const metadata = {
  title: "About — BOW Sports Capital",
  description:
    "The economics debate was already happening. BOW Sports Capital gave it a front office — a curriculum built around the sports-business decisions students already care about.",
};

export default function AboutPage() {
  return (
    <div data-screen-label="About">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)", overflow: "hidden", position: "relative" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", right: "-3%", top: "-10%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,24vw,400px)", lineHeight: 0.8, color: "rgba(255,255,255,0.04)", pointerEvents: "none", textTransform: "uppercase", letterSpacing: "-0.04em" }}>BOW</div>
        <div className="bow-container-wide" style={{ position: "relative" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>About BOW Sports Capital</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(36px,5.5vw,70px)", lineHeight: 0.98, letterSpacing: "-0.015em", maxWidth: "18ch", textWrap: "balance" }}>The economics debate was already happening. We gave it a front office.</h1>
          <CapLine weight={6} step={14} stepAt={0.42} style={{ maxWidth: 260, marginTop: 28 }} />
        </div>
      </section>

      {/* ===== THE BELIEF ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <div className="bow-wipe" style={{ borderLeft: "6px solid var(--bow-blue)", paddingLeft: "clamp(20px,2.5vw,32px)", marginBottom: 40 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 500, fontSize: "clamp(22px,3vw,38px)", lineHeight: 1.22, letterSpacing: "-0.01em", textWrap: "balance" }}>Students debate contracts, trades, ticket prices, team spending, and player salaries all the time. They are already doing economics. BOW gives it structure.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,19px)", lineHeight: 1.65, color: "var(--bow-ink)" }}>
            <p style={{ margin: 0 }}>Every time a student argues that their team overpaid for a player, they are making a claim about opportunity cost. Every time they debate stadium funding, they are doing public economics. The sports-business conversation most students are already having is one of the best economics classrooms in existence — it just needs a front door.</p>
            <p style={{ margin: 0 }}>BOW Sports Capital was built from that belief. The curriculum is built around the decisions that already matter to students — cap sheets, trades, stadium deals, media rights, sponsor negotiations, and the business of winning. Not as a shortcut. As the actual curriculum.</p>
          </div>
          <div style={{ marginTop: 36, background: "var(--bow-ink)", color: "#fff", padding: "24px 28px", display: "flex", alignItems: "flex-start", gap: 18 }}>
            <div style={{ width: 5, background: "var(--bow-blue)", flexShrink: 0, alignSelf: "stretch", minHeight: 48 }} />
            <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(20px,2.4vw,30px)", lineHeight: 1.2 }}>Sports are the story. Economics is the engine.</p>
          </div>
        </div>
      </section>

      {/* ===== STUDENT OUTCOMES ===== */}
      <section style={{ background: "#fff", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Student Outcomes</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.6vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>What students leave with.</h2>
            <p style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>BOW teaches economics through decision-making. The skills students build are transferable well beyond sports.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 0, border: "1px solid var(--border-rule)" }}>
            {aboutOutcomes.map((o) => (
              <div key={o} className="bow-reveal-sm" style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", borderBottom: "1px solid var(--border-rule)", borderRight: "1px solid var(--border-rule)" }}>
                <span style={{ width: 6, height: 6, background: "var(--bow-blue)", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 16 }}>{o}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PROOF (dark) ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-far" aria-hidden style={{ position: "absolute", right: "-4%", top: "-6%", fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 600, fontSize: "clamp(120px,20vw,360px)", lineHeight: 0.78, color: "rgba(255,255,255,0.035)", letterSpacing: "-0.02em", pointerEvents: "none", zIndex: 0 }}>Proof</div>
        <div className="bow-container-wide" style={{ position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)", marginBottom: 44 }}>
            {impact.map((i) => (
              <div key={i.label} style={{ background: "var(--bow-ink)", padding: "28px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: "clamp(28px,3.8vw,44px)", letterSpacing: "-0.01em", color: "#fff" }}>{i.value}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>{i.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(20px,3vw,40px)" }}>
            {quotes.map((q) => (
              <figure key={q.who} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 14, paddingBottom: 20, borderBottom: "1px solid var(--bow-dark-border)" }}>
                <blockquote style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 500, fontSize: 22, lineHeight: 1.3, color: "#fff" }}>&ldquo;{q.text}&rdquo;</blockquote>
                <figcaption style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#9a9da6" }}>{q.who}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ===== READY TO STEP IN? ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4.5vw,56px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Ready to step in?</h2>
            <p style={{ margin: "12px 0 0", fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.6, color: "var(--bow-slate)" }}>Explore the tracks, or reach out about bringing BOW to your school or camp.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Button href="/programs" variant="primary" size="lg">Explore Programs</Button>
            <Button href="/get-involved/schools" variant="secondary" size="lg">Schools &amp; Camps</Button>
            <Button href="/sign-up" variant="ink" size="lg">Get in Touch</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
