import Link from "next/link";
import { Button, SectionHeader, DataStrip } from "@/components/ds";
import { lessonSteps } from "@/lib/home";
import type { LessonStep } from "@/lib/home";
import {
  track201Stats,
  track201Concepts,
  track201Outcomes,
  track201Modules,
  track201Capstone,
  trackDelivery,
} from "@/lib/programs";
import type { Concept, TrackModule, ModuleLesson, DeliveryFormat } from "@/lib/programs";
import { getLessonById } from "@/lib/lessons";

export const metadata = {
  title: "Track 201 — BOW Sports Capital",
  description:
    "The decisions get harder when every good option has a cost. The advanced track: run the front office, manage the cap, and answer to ownership.",
};

export default function Track201Page() {
  return (
    <div data-screen-label="Track 201">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px) clamp(32px,4vw,56px)", borderBottom: "1px solid var(--border-rule)", overflow: "hidden", position: "relative" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", right: -20, top: -60, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(220px,32vw,520px)", lineHeight: 0.7, color: "rgba(10,10,11,0.04)", pointerEvents: "none" }}>201</div>
        <div className="bow-drift-l" aria-hidden style={{ position: "absolute", left: 0, top: "64%", width: "46%", height: 6, background: "rgba(255,90,54,0.14)", pointerEvents: "none", zIndex: 0 }} />
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", left: "4%", bottom: "8%", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(10,10,11,0.16)", pointerEvents: "none", zIndex: 0 }}>FRONT OFFICE · TRACK 201</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>
            <Link href="/programs" style={{ color: "var(--bow-blue)" }}>Programs</Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "var(--bow-ink)" }}>Track 201</span>
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Track 201 · Advanced</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "var(--bow-orange)", padding: "3px 9px" }}>Available</span>
          </div>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(34px,5vw,68px)", lineHeight: 0.98, letterSpacing: "-0.015em", maxWidth: "20ch", textWrap: "balance" }}>The decisions get harder when every good option has a cost.</h1>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,21px)", lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 620 }}>You&apos;re not learning how the organization works anymore. You&apos;re running it — managing the cap, reading the analytics, valuing the draft, and answering to ownership.</p>
        </div>
      </section>

      {/* ===== STATS STRIP ===== */}
      <div className="bow-container" style={{ padding: "0 clamp(18px,4vw,40px)" }}>
        <div style={{ marginTop: -1 }}>
          <DataStrip items={track201Stats} />
        </div>
      </div>

      {/* ===== WHAT YOU'LL LEARN ===== */}
      <section style={{ background: "#fff", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)", marginTop: "clamp(48px,7vw,96px)", borderTop: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 36 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>What You&apos;ll Learn</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.6vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>The economics a front office runs on.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", borderTop: "1px solid var(--border-rule)", borderLeft: "1px solid var(--border-rule)" }}>
            {track201Concepts.map((c: Concept) => (
              <div key={c.name} style={{ borderRight: "1px solid var(--border-rule)", borderBottom: "1px solid var(--border-rule)", padding: "22px 22px 26px", background: "#fff" }}>
                <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.01em" }}>{c.name}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)" }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== OUTCOMES ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 36 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>What You&apos;ll Be Able to Do</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.6vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>By the end, you can run the room — and answer for it.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", borderTop: "1px solid var(--border-rule)" }}>
            {track201Outcomes.map((o: string, i: number) => (
              <div key={o} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "18px 20px 18px 0", borderBottom: "1px solid var(--border-rule)" }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-orange)" }}>{i}</span>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.45 }}>{o}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MODULE MAP ===== */}
      <section style={{ background: "#fff", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="4 Modules · 12 Lessons" title="The module map" style={{ marginBottom: 40 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(20px,2.5vw,32px)" }}>
            {track201Modules.map((m: TrackModule, mi: number) => (
              <div key={m.n} className="bow-reveal-sm" style={{ background: "#fff", border: "1px solid var(--border-rule)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "22px clamp(18px,2.4vw,28px)", borderBottom: "1px solid var(--border-rule)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>{m.n}</span>
                    <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,3vw,38px)", textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 0.95 }}>{m.title}</h3>
                  </div>
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)", fontStyle: "italic" }}>{m.theme}</span>
                </div>
                {m.lessons.map((l: ModuleLesson, li: number) => {
                  const lesson = getLessonById(`t201-m${mi + 1}-l${li + 1}`);
                  const href = lesson ? `/lessons/${lesson.slug}` : "/lessons";
                  return (
                    <Link key={l.n} href={href} className="bow-link" style={{ display: "grid", gridTemplateColumns: "48px 1fr auto", gap: 16, alignItems: "center", padding: "16px clamp(18px,2.4vw,28px)", borderBottom: "1px solid var(--border-rule)", color: "var(--bow-ink)" }}>
                      <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-slate)" }}>{l.n}</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <span style={{ fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 18, lineHeight: 1.2 }}>{l.title}</span>
                        <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)", lineHeight: 1.4 }}>{l.overview}</span>
                        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>{l.concept} · {l.runtime} · {l.podcast} · SIM {l.sim}</span>
                      </div>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-orange)", whiteSpace: "nowrap" }}>View →</span>
                    </Link>
                  );
                })}
              </div>
            ))}
            {/* capstone */}
            <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", border: "1px solid var(--bow-dark-border)", borderTop: "4px solid var(--bow-orange)", padding: "clamp(24px,3vw,36px)", display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ maxWidth: 620 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>{track201Capstone.tag}</span>
                <h3 style={{ margin: "8px 0 10px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.4vw,42px)", textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 0.95 }}>{track201Capstone.title}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, color: "#b9bcc4" }}>{track201Capstone.body}</p>
              </div>
              <Button href="/sign-up" variant="emphasis" size="lg">Join Track 201</Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRACK EXPERIENCE ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
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
      <section style={{ background: "#fff", padding: "clamp(48px,7vw,96px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="Where it runs" title="Delivery formats" style={{ marginBottom: 36 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "clamp(16px,2vw,22px)" }}>
            {trackDelivery.map((d: DeliveryFormat) => (
              <div key={d.n} style={{ background: "#fff", border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-orange)", padding: "24px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, color: "var(--bow-orange)" }}>{d.n}</span>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, textTransform: "uppercase" }}>{d.title}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)" }}>{d.body}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Button href="/get-involved/schools" variant="primary" size="lg">Bring Track 201 to Your Group</Button>
            <Button href="/sign-up" variant="secondary" size="lg">Join as a Student or Family</Button>
          </div>
        </div>
      </section>

      {/* ===== CONVERSION ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(48px,7vw,100px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 540 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4.5vw,56px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Think you can run the front office?</h2>
            <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.55, color: "#b9bcc4" }}>Start at 101, jump straight to 201, or bring the track to your school or camp.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Button href="/sign-up" variant="primary" size="lg">Sign Up for Track 201</Button>
            <Button href="/programs/track-101" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>Start at Track 101</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
