import { Button } from "@/components/ds";
import { hwDistricts, hwMissions, hwMetrics } from "@/lib/highway";

export const metadata = {
  title: "Highway World",
  description:
    "Highway World is BOW's interactive sports-business world — a driving overworld, mission interiors, and a live franchise headquarters. Currently in development.",
};

export default function HighwayWorldPage() {
  return (
    <div data-screen-label="Highway World">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(60px,8vw,120px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)", position: "relative", overflow: "hidden", minHeight: "clamp(440px,62vh,760px)", display: "flex", alignItems: "center" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 3, background: "repeating-linear-gradient(to bottom, var(--bow-orange) 0 28px, transparent 28px 56px)", opacity: 0.7, transform: "translateX(-50%)" }} />
        <div className="bow-para-far" aria-hidden style={{ position: "absolute", left: "28%", top: 0, bottom: 0, width: 2, background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.2) 0 18px, transparent 18px 40px)" }} />
        <div className="bow-para-up" aria-hidden style={{ position: "absolute", right: "28%", top: 0, bottom: 0, width: 2, background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.2) 0 18px, transparent 18px 40px)" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 90% 50% at 50% 100%, rgba(49,87,255,0.18), transparent)" }} />
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", left: "50%", top: "10%", transform: "translateX(-50%)", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(100px,20vw,380px)", lineHeight: 0.7, color: "rgba(255,255,255,0.03)", letterSpacing: "-0.05em", textTransform: "uppercase", pointerEvents: "none", whiteSpace: "nowrap" }}>HIGHWAY</div>
        <div className="bow-container" style={{ position: "relative", width: "100%", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 24, border: "1px solid var(--bow-dark-border)", padding: "6px 16px", borderRadius: 999 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--bow-warning)", display: "inline-block" }} />
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b9bcc4" }}>In Development</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(46px,9vw,128px)", lineHeight: 0.84, letterSpacing: "-0.02em", textTransform: "uppercase", textWrap: "balance" }}>Highway World</h1>
          <p style={{ margin: "24px auto 0", fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.5vw,22px)", lineHeight: 1.55, color: "#b9bcc4", maxWidth: 560 }}>BOW&apos;s interactive sports-business world. Drive through the city, enter the buildings, run the franchise.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 32 }}>
            <Button href="/sign-up" variant="primary" size="lg">Follow Development</Button>
            <Button href="/programs" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>Explore the Tracks</Button>
          </div>
        </div>
      </section>

      {/* ===== THREE LAYERS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ marginBottom: 48, maxWidth: 700 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Three Layers, One World</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,5vw,62px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", maxWidth: "16ch" }}>The front office isn&apos;t a room. It&apos;s a city.</h2>
            <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.6, color: "var(--bow-slate)" }}>Highway World is being built in three interconnected layers. Students move through all three — learning by doing, not by reading.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 0, border: "1px solid var(--border-rule)" }}>
            {/* Layer 01 */}
            <div style={{ padding: "clamp(24px,3vw,36px)", borderRight: "1px solid var(--border-rule)" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Layer 01</span>
              <h3 style={{ margin: "10px 0 14px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, textTransform: "uppercase", lineHeight: 0.95, letterSpacing: "-0.01em" }}>Driving Overworld</h3>
              <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>A connected sports-business city. The road introduces decisions, economic shocks, negotiations, and rival moves in real time.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {hwDistricts.map((d) => (
                  <div key={d.code} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)", minWidth: 76 }}>{d.code}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.01em", color: "var(--bow-ink)" }}>{d.title}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Layer 02 */}
            <div style={{ padding: "clamp(24px,3vw,36px)", borderRight: "1px solid var(--border-rule)", background: "var(--bow-ink)", color: "#fff" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Layer 02</span>
              <h3 style={{ margin: "10px 0 14px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, textTransform: "uppercase", lineHeight: 0.95, letterSpacing: "-0.01em" }}>Mission Interiors</h3>
              <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#b9bcc4" }}>Enter the buildings. War rooms, boardrooms, stadium offices, negotiation rooms, media studios. Complete front-office missions with real consequences.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {hwMissions.map((m) => (
                  <div key={m.title} style={{ border: "1px solid var(--bow-dark-border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>{m.type}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, textTransform: "uppercase", color: "#fff" }}>{m.title}</span>
                    <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "#9a9da6", lineHeight: 1.45 }}>{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Layer 03 */}
            <div style={{ padding: "clamp(24px,3vw,36px)" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-positive)" }}>Layer 03</span>
              <h3 style={{ margin: "10px 0 14px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, textTransform: "uppercase", lineHeight: 0.95, letterSpacing: "-0.01em" }}>Headquarters</h3>
              <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>Build your home organization. Manage Finance, Scouting, Media, Community, Ownership, and Operations. Every decision moves your four core metrics.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)" }}>
                {hwMetrics.map((hm) => (
                  <div key={hm.name} style={{ background: "var(--bow-paper)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6, borderRight: "1px solid var(--border-rule)", borderBottom: "1px solid var(--border-rule)" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1, color: "var(--bow-ink)" }}>{hm.name}</span>
                    <span style={{ fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--bow-slate)", lineHeight: 1.4 }}>{hm.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== THE ROAD IS BEING BUILT (dark) ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(49,87,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(49,87,255,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px", opacity: 0.5 }} />
        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 18px", border: "1px solid var(--bow-dark-border)", borderRadius: 999, marginBottom: 28 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--bow-warning)", display: "inline-block" }} />
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b9bcc4" }}>Currently in Development</span>
          </div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(36px,6vw,80px)", lineHeight: 0.88, letterSpacing: "-0.02em", textTransform: "uppercase" }}>The road is being built.</h2>
          <p style={{ margin: "22px auto 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,20px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 540 }}>Highway World is BOW&apos;s most ambitious project — a connected sports-business city where every decision has consequences that ripple through the league. Sign up to follow development and be first through the gate.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 30 }}>
            <Button href="/sign-up" variant="primary" size="lg">Follow Development</Button>
            <Button href="/programs" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>Explore the Tracks</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
