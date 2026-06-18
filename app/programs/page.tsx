import Link from "next/link";
import { Button, SectionHeader } from "@/components/ds";
import { tracks } from "@/lib/home";
import type { Track } from "@/lib/home";
import { progression, start101, start201 } from "@/lib/programs";
import type { ProgressionStage } from "@/lib/programs";

export const metadata = {
  title: "Programs — BOW Sports Capital",
  description:
    "Four stages, one path. From your first guided decision to running calls across a living sports-business universe.",
};

export default function ProgramsPage() {
  return (
    <div data-screen-label="Programs">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(48px,6vw,96px) clamp(18px,4vw,40px) clamp(40px,5vw,72px)", overflow: "hidden", position: "relative" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", right: -30, top: -40, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,24vw,360px)", lineHeight: 0.8, color: "rgba(255,255,255,0.05)", pointerEvents: "none" }}>→</div>
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", left: "-3%", bottom: "-18%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(150px,24vw,420px)", lineHeight: 0.74, color: "rgba(255,255,255,0.035)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>Path</div>
        <div className="bow-drift-l" aria-hidden style={{ position: "absolute", left: 0, top: "60%", width: "50%", height: 6, background: "rgba(255,90,54,0.22)", pointerEvents: "none", zIndex: 0 }} />
        <div className="bow-container" style={{ position: "relative" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>The Programs</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(38px,6.5vw,92px)", lineHeight: 0.88, letterSpacing: "-0.02em", textTransform: "uppercase", maxWidth: "16ch" }}>From first decision to front-office thinking.</h1>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,20px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 620 }}>Four stages, one path. Each builds on the last — from your first guided decision to running calls across a living sports-business universe.</p>
        </div>
      </section>

      {/* ===== PROGRESSION ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(48px,7vw,100px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)" }}>
            {progression.map((s: ProgressionStage) => (
              <Link key={s.num} href={s.href} className="bow-reveal-sm bow-card" style={{ background: "#fff", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 12, minHeight: 248, color: "var(--bow-ink)" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(44px,5vw,68px)", lineHeight: 0.8, letterSpacing: "-0.03em", color: s.tone }}>{s.num}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: s.tone, whiteSpace: "nowrap" }}>{s.status}</span>
                </div>
                <div style={{ height: 5, width: 48, background: s.tone }} />
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.01em", lineHeight: 1.05 }}>{s.label}</span>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)", flex: 1 }}>{s.dev}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", color: s.tone }}>{s.cta} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PLACEMENT ===== */}
      <section style={{ background: "#fff", padding: "clamp(48px,7vw,100px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ marginBottom: 40, maxWidth: 700 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Where to Start</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(28px,3.8vw,46px)", lineHeight: 1.04, letterSpacing: "-0.01em" }}>Most students start at 101. You don&apos;t have to.</h2>
            <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>This is a guide, not a gate. Explore whichever track fits.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "clamp(20px,3vw,40px)" }}>
            <div style={{ border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-blue)", padding: "28px 24px" }}>
              <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, textTransform: "uppercase" }}>Start with Track 101 if…</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {start101.map((r: string) => (
                  <div key={r} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.5 }}>
                    <span style={{ color: "var(--bow-blue)", fontFamily: "var(--font-data)", fontWeight: 600 }}>→</span>
                    {r}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 22 }}>
                <Button href="/programs/track-101" variant="primary" size="md">Explore Track 101</Button>
              </div>
            </div>
            <div style={{ border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-orange)", padding: "28px 24px" }}>
              <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, textTransform: "uppercase" }}>Start with Track 201 if…</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {start201.map((r: string) => (
                  <div key={r} style={{ display: "flex", gap: 12, alignItems: "flex-start", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.5 }}>
                    <span style={{ color: "var(--bow-orange)", fontFamily: "var(--font-data)", fontWeight: 600 }}>→</span>
                    {r}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 22 }}>
                <Button href="/programs/track-201" variant="secondary" size="md">Explore Track 201</Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ALL TRACKS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(48px,7vw,100px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <SectionHeader kicker="All Tracks" title="Choose your path" style={{ marginBottom: 36 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", border: "1px solid var(--border-rule)" }}>
            {tracks.map((t: Track) => (
              <div key={t.num} style={{ display: "flex", flexDirection: "column", gap: 16, padding: "clamp(24px,3vw,34px)", borderRight: "1px solid var(--border-rule)", background: t.bg, color: t.fg, position: "relative" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(48px,6vw,80px)", lineHeight: 0.8, letterSpacing: "-0.03em" }}>{t.num}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: t.kindColor }}>{t.kind}</span>
                </div>
                <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 22, lineHeight: 1.1 }}>{t.title}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: t.muted, flex: 1 }}>{t.desc}</p>
                <Button href={t.href} variant={t.btnVariant} size="md" full>{t.cta}</Button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
