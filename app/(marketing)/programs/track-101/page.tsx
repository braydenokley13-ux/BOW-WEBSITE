import Link from "next/link";
import { Button, SectionHeader, DataStrip } from "@/components/ds";
import { lessonSteps } from "@/lib/home";
import type { LessonStep } from "@/lib/home";
import {
  track101Stats,
  track101Outcomes,
  track101Concepts,
  track101Modules,
  trackDelivery,
} from "@/lib/programs";
import type { Concept, TrackModule, DeliveryFormat } from "@/lib/programs";

export const metadata = {
  title: "Track 101",
  description:
    "Learn how the business of sports actually works — one decision at a time. The introductory, recommended starting track.",
};

export default function Track101Page() {
  return (
    <div data-screen-label="Track 101">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px) clamp(32px,4vw,56px)", borderBottom: "1px solid var(--border-rule)", overflow: "hidden", position: "relative" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", right: -20, top: -60, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(220px,32vw,520px)", lineHeight: 0.7, color: "rgba(10,10,11,0.04)", pointerEvents: "none" }}>101</div>
        <div className="bow-drift-l" aria-hidden style={{ position: "absolute", left: 0, top: "64%", width: "46%", height: 6, background: "rgba(49,87,255,0.12)", pointerEvents: "none", zIndex: 0 }} />
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", left: "4%", bottom: "8%", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(10,10,11,0.16)", pointerEvents: "none", zIndex: 0 }}>FOUNDATION · TRACK 101</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <Link href="/programs" style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", color: "var(--bow-slate)" }}>← Programs</Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Track 101 · Introductory</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "var(--bow-blue)", padding: "3px 9px" }}>Recommended Start</span>
          </div>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(34px,5vw,68px)", lineHeight: 0.98, letterSpacing: "-0.015em", maxWidth: "18ch", textWrap: "balance" }}>Learn how the business of sports actually works — one decision at a time.</h1>
        </div>
      </section>

      {/* ===== STATS STRIP ===== */}
      <div className="bow-container" style={{ padding: "0 clamp(18px,4vw,40px)" }}>
        <div style={{ marginTop: -1 }}>
          <DataStrip items={track101Stats} />
        </div>
      </div>

      {/* ===== OUTCOMES ===== */}
      <section style={{ background: "#fff", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)", marginTop: "clamp(48px,7vw,96px)", borderTop: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 36 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>What You&apos;ll Be Able to Do</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.6vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>By the end, you can read the room — and the cap sheet.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", borderTop: "1px solid var(--border-rule)" }}>
            {track101Outcomes.map((o: string, i: number) => (
              <div key={o} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "18px 20px 18px 0", borderBottom: "1px solid var(--border-rule)" }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)" }}>{i}</span>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.45 }}>{o}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== WHAT YOU'LL LEARN ===== */}
      <section style={{ background: "#fff", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 36 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>What You&apos;ll Learn</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.6vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>Real economic concepts — used, not memorized.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", borderTop: "1px solid var(--border-rule)", borderLeft: "1px solid var(--border-rule)" }}>
            {track101Concepts.map((c: Concept) => (
              <div key={c.name} style={{ borderRight: "1px solid var(--border-rule)", borderBottom: "1px solid var(--border-rule)", padding: "22px 22px 26px", background: "#fff" }}>
                <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.01em" }}>{c.name}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)" }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MODULE OVERVIEW ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker={`${track101Modules.length} Modules`} title="How the track is organized" style={{ marginBottom: 40 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "clamp(16px,2vw,22px)" }}>
            {track101Modules.map((m: TrackModule) => (
              <div key={m.n} style={{ background: "#fff", border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-blue)", padding: "22px 22px 26px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-blue)" }}>{m.n}</span>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, textTransform: "uppercase", letterSpacing: "-0.005em" }}>{m.title}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)" }}>{m.theme}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRACK EXPERIENCE ===== */}
      <section style={{ background: "#fff", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="How a lesson moves" title="The track experience" style={{ marginBottom: 36 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", borderTop: "1px solid var(--border-rule)", borderLeft: "1px solid var(--border-rule)" }}>
            {lessonSteps.map((s: LessonStep) => (
              <div key={s.n} style={{ borderRight: "1px solid var(--border-rule)", borderBottom: "1px solid var(--border-rule)", padding: "22px 22px 26px", background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 34, lineHeight: 0.8, color: s.numColor }}>{s.n}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: s.tagColor }}>{s.tag}</span>
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, textTransform: "uppercase", letterSpacing: "0.01em", lineHeight: 1.05 }}>{s.label}</span>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>{s.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DELIVERY FORMATS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="Where it runs" title="Delivery formats" style={{ marginBottom: 36 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "clamp(16px,2vw,22px)" }}>
            {trackDelivery.map((d: DeliveryFormat) => (
              <div key={d.n} style={{ background: "#fff", border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-blue)", padding: "24px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, color: "var(--bow-blue)" }}>{d.n}</span>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, textTransform: "uppercase" }}>{d.title}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)" }}>{d.body}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Button href="/get-involved/schools" variant="primary" size="lg">Bring Track 101 to Your Group</Button>
            <Button href="/sign-up" variant="secondary" size="lg">Join as a Student or Family</Button>
          </div>
        </div>
      </section>

      {/* ===== CONVERSION ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(48px,7vw,100px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 540 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4.5vw,56px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Ready to take the first decision?</h2>
            <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.55, color: "#b9bcc4" }}>Sign up for Track 101, ask a question, or bring it to your school or camp.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Button href="/sign-up" variant="primary" size="lg">Sign Up for Track 101</Button>
            <Button href="/get-involved/schools" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>Bring It to a School</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
