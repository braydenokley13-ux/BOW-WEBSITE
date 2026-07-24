import { Button, CapLine } from "@/components/ds";
import { getPublicOpening } from "@/lib/people-work";

export const metadata = {
  title: "Teach with BOW",
  description: "Help young people learn economics, finance, leadership, and strategy through sports-business decisions.",
};

const PAD = "clamp(56px,8vw,108px) clamp(18px,4vw,40px)";

export default async function TeachPage() {
  const opening = await getPublicOpening("sports-economics-instructor");
  return (
    <div>
      <section className="bow-front-office" style={{ padding: PAD, minHeight: "72vh", display: "grid", placeItems: "center", position: "relative", overflow: "clip" }}>
        <div className="bow-ghost" aria-hidden style={{ position: "absolute", right: "-2%", bottom: "-12%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,28vw,440px)", color: "rgba(255,255,255,.04)", lineHeight: .75 }}>TEACH</div>
        <div className="bow-container" style={{ width: "100%", position: "relative" }}>
          <span className="bow-eyebrow" style={{ color: "var(--bow-orange)" }}>We&apos;re building the instructor team</span>
          <h1 style={{ marginTop: 14, maxWidth: 900, fontFamily: "var(--font-editorial)", fontSize: "clamp(44px,7vw,90px)", lineHeight: .95, letterSpacing: "-.02em" }}>Help students learn to make the decisions behind sports.</h1>
          <CapLine weight={7} step={20} stepAt={.46} style={{ marginTop: 26, maxWidth: 360 }} />
          <p style={{ marginTop: 26, maxWidth: 700, fontSize: "clamp(18px,2vw,22px)", lineHeight: 1.55, color: "#b9bcc4" }}>BOW instructors turn sports into a live classroom for economics, finance, leadership, and strategy. You do not lecture from a textbook—you guide decisions, tradeoffs, and consequences. Teaching with BOW is a volunteer role.</p>
          <div style={{ marginTop: 30, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Button href={opening ? `/join/${opening.slug}` : "/contact"} variant="primary" size="lg">Apply to Teach</Button>
            <Button href="/#howitworks" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>See What BOW Teaches</Button>
          </div>
        </div>
      </section>

      <section style={{ padding: PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>The role</span>
          <h2 style={{ marginTop: 10, maxWidth: 760, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(38px,5vw,68px)", lineHeight: .94, textTransform: "uppercase" }}>Teach the business of sports. Build judgment that travels beyond it.</h2>
          <div style={{ marginTop: 42, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)" }}>
            {[
              ["01", "Prepare", "Learn BOW's curriculum and enter each session ready to guide decisions."],
              ["02", "Facilitate", "Help students explain tradeoffs, challenge assumptions, and adapt their strategy."],
              ["03", "Close the loop", "Record what happened, respond to coaching, and improve the next session."],
            ].map(([number, title, body]) => <article key={number} style={{ background: "#fff", padding: 28 }}><span className="bow-data" style={{ color: "var(--bow-blue)" }}>{number}</span><h3 style={{ marginTop: 18, fontFamily: "var(--font-display)", fontSize: 28, textTransform: "uppercase" }}>{title}</h3><p style={{ marginTop: 10, lineHeight: 1.6, color: "var(--bow-slate)" }}>{body}</p></article>)}
          </div>
        </div>
      </section>

      <section style={{ padding: PAD, background: "#fff", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <span className="bow-eyebrow" style={{ color: "var(--bow-orange)" }}>Who fits</span>
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 28 }}>
            <div><h2 style={{ fontFamily: "var(--font-editorial)", fontSize: "clamp(34px,4vw,54px)", lineHeight: 1 }}>You can make a complex idea feel playable.</h2></div>
            <ul style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 13, fontSize: 17, lineHeight: 1.55 }}>
              <li>You communicate clearly and bring steady energy.</li><li>You prepare, show up, and follow through.</li><li>You are coachable and comfortable receiving specific feedback.</li><li>You care about young people and responsible learning environments.</li><li>Teaching, coaching, sports-business, finance, or leadership experience helps—but evidence matters more than titles.</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={{ padding: PAD, background: "var(--bow-paper)" }}>
        <div className="bow-container">
          <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>What happens next</span>
          <h2 style={{ marginTop: 10, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(36px,5vw,64px)", textTransform: "uppercase" }}>A clear process. No black box.</h2>
          <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            {(opening?.stages ?? []).map((stage, index) => <div key={stage.id} style={{ background: "#fff", borderTop: "5px solid var(--bow-blue)", padding: 18 }}><span className="bow-data" style={{ color: "var(--bow-slate)" }}>{String(index + 1).padStart(2, "0")}</span><h3 style={{ marginTop: 12, fontFamily: "var(--font-display)", fontSize: 22, textTransform: "uppercase" }}>{stage.title}</h3></div>)}
          </div>
          <div style={{ marginTop: 38 }}><Button href={opening ? `/join/${opening.slug}` : "/contact"} variant="emphasis" size="lg">View the Opening</Button></div>
        </div>
      </section>
    </div>
  );
}
