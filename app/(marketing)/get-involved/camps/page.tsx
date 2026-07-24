import Link from "next/link";
import { Button } from "@/components/ds";
import { AudienceFaq } from "@/components/site/InquiryForm";
import {
  camperActions,
  campsSessionStructure,
  campFormatsList,
  campDeliveryModels,
  campsLogistics,
  campsFaqs,
} from "@/lib/get-involved";

export const metadata = {
  title: "For Camps",
  description:
    "High-energy front-office decisions, built for camp schedules. One complete sports-business challenge in 45 to 75 minutes.",
};

const SECTION_PAD = "clamp(56px,8vw,120px) clamp(18px,4vw,40px)";

export default function CampsPage() {
  return (
    <div data-screen-label="Camps">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)", borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", right: "-2%", top: "-8%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,26vw,420px)", lineHeight: 0.78, color: "rgba(10,10,11,0.04)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none" }}>Draft</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)", marginBottom: 28 }}>
            <Link href="/" style={{ color: "var(--bow-blue)" }}>Home</Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "var(--bow-ink)" }}>Camps</span>
          </nav>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>For Camps</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(38px,5.5vw,72px)", lineHeight: 0.98, letterSpacing: "-0.015em", maxWidth: "18ch", textWrap: "balance" }}>High-energy front-office decisions. Built for camp schedules.</h1>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.5vw,21px)", lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 580 }}>One complete sports-business challenge in 45 to 75 minutes. Team-based decisions, minimal setup, no economics background required. Standalone sessions or a multi-day Front Office Challenge.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Button href="/get-involved" variant="primary" size="lg">Bring BOW to a Camp</Button>
            <Button href="/programs/track-101" variant="secondary" size="lg">View Sample Sessions</Button>
          </div>
        </div>
      </section>

      {/* ===== CAMPER EXPERIENCE + SAMPLE SESSION ===== */}
      <section style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "start" }}>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>The Camper Experience</span>
              <h2 style={{ margin: "10px 0 20px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,40px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>What a camper actually does.</h2>
              <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--border-rule)" }}>
                {camperActions.map((a) => (
                  <div key={a.n} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 0", borderBottom: "1px solid var(--border-rule)" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)", flexShrink: 0 }}>{a.n}</span>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15, lineHeight: 1.4 }}>{a.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 16 }}>Sample 60-Minute Session</span>
              <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--border-rule)" }}>
                {campsSessionStructure.map((s) => (
                  <div key={s.time} style={{ display: "grid", gridTemplateColumns: "90px 1fr", borderBottom: "1px solid var(--border-rule)" }}>
                    <div style={{ padding: "14px 16px", borderRight: "1px solid var(--border-rule)", background: "var(--bow-paper)" }}>
                      <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-blue)" }}>{s.time}</span>
                    </div>
                    <div style={{ padding: "14px 16px" }}>
                      <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{s.activity}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ margin: "12px 0 0", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>Delivery model — facilitated by BOW or trained staff.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CAMP FORMATS + DELIVERY MODELS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(28px,4vw,56px)" }}>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Camp Formats</span>
              <h2 style={{ margin: "10px 0 20px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,2.8vw,34px)", lineHeight: 0.95, letterSpacing: "-0.015em", textTransform: "uppercase" }}>Cases that work in any camp setting.</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {campFormatsList.map((f) => (
                  <div key={f.n} style={{ background: "#fff", border: "1px solid var(--border-rule)", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)", flexShrink: 0 }}>{f.n}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: "0.01em" }}>{f.title}</div>
                      <div style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)", marginTop: 2 }}>{f.desc}</div>
                    </div>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", flexShrink: 0 }}>{f.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Delivery Models</span>
              <h2 style={{ margin: "10px 0 20px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,2.8vw,34px)", lineHeight: 0.95, letterSpacing: "-0.015em", textTransform: "uppercase" }}>Three ways BOW fits a camp.</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {campDeliveryModels.map((d) => (
                  <div key={d.title} style={{ border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-orange)", padding: 20 }}>
                    <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.01em" }}>{d.title}</h3>
                    <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>{d.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOGISTICS + FAQ (dark) ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)", marginBottom: 52 }}>
            {campsLogistics.map((l) => (
              <div key={l.label} style={{ background: "var(--bow-ink)", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>{l.label}</span>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 18, color: "#fff", lineHeight: 1.2 }}>{l.value}</span>
              </div>
            ))}
          </div>
          <div style={{ maxWidth: 640, marginBottom: 32 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Camps FAQ</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.8vw,48px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Quick answers.</h2>
          </div>
          <AudienceFaq items={campsFaqs} tone="dark" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 40 }}>
            <Button href="/get-involved" variant="primary" size="lg">Bring BOW to a Camp</Button>
            <Button href="/get-involved/schools" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>Schools Program</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
