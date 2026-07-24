import Link from "next/link";
import { Button } from "@/components/ds";
import { AudienceFaq } from "@/components/site/InquiryForm";
import {
  youthImplModels,
  youthTransferTopics,
  youthPracticalDetails,
  youthFaqs,
} from "@/lib/get-involved";

export const metadata = {
  title: "For Youth Organizations",
  description:
    "Adaptable economic decision-making for any group. Community organizations, nonprofits, libraries, and enrichment providers can bring BOW to their students.",
};

const SECTION_PAD = "clamp(56px,8vw,120px) clamp(18px,4vw,40px)";

export default function YouthOrganizationsPage() {
  return (
    <div data-screen-label="Youth Organizations">
      {/* ===== HERO ===== */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)", borderBottom: "1px solid var(--bow-dark-border)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", right: "-2%", top: "-10%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,26vw,440px)", lineHeight: 0.78, color: "rgba(255,255,255,0.04)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none" }}>Club</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#6d7078", marginBottom: 28 }}>
            <Link href="/" style={{ color: "#6f8bff" }}>Home</Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "#fff" }}>Youth Organizations</span>
          </nav>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>For Youth Organizations</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(38px,5.5vw,72px)", lineHeight: 0.98, letterSpacing: "-0.015em", maxWidth: "18ch", textWrap: "balance", color: "#fff" }}>Adaptable economic decision-making for any group.</h1>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.5vw,21px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 580 }}>Community organizations, nonprofits, libraries, recreation programs, and enrichment providers can bring the BOW learning model to their students in formats that fit outside a traditional classroom.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Button href="/get-involved" variant="primary" size="lg">Inquire About BOW</Button>
            <Button href="/programs/track-101" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>Explore the Curriculum</Button>
          </div>
        </div>
      </section>

      {/* ===== IMPLEMENTATION MODELS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ maxWidth: 640, marginBottom: 40 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Implementation Models</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(26px,3.4vw,44px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>Three possible delivery models. None require an economics background.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "clamp(16px,2vw,24px)" }}>
            {youthImplModels.map((m) => (
              <div key={m.title} className="bow-reveal-sm" style={{ background: "#fff", border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-blue)", padding: "clamp(22px,2.6vw,30px)", display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 19, textTransform: "uppercase", letterSpacing: "0.01em" }}>{m.title}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, color: "var(--bow-slate)", flex: 1 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COMMUNITY RELEVANCE + PRACTICAL DETAILS + FAQ ===== */}
      <section style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "start" }}>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Community Relevance</span>
              <h2 style={{ margin: "10px 0 16px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,40px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>Sports was the entry point. The reasoning transfers everywhere.</h2>
              <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>Every BOW lesson ends with a transfer challenge — the same economic model applied outside sports. These transfer topics are directly relevant to youth leadership and community decisions.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(10px,1.5vw,14px)" }}>
                {youthTransferTopics.map((t) => (
                  <div key={t.label} style={{ border: "1px solid var(--border-rule)", padding: 16, background: "var(--bow-paper)" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.01em", color: "var(--bow-ink)", marginBottom: 6 }}>{t.label}</div>
                    <div style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)", lineHeight: 1.4 }}>{t.body}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Practical Details</span>
              <h2 style={{ margin: "10px 0 20px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,40px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>What to expect.</h2>
              <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--border-rule)" }}>
                {youthPracticalDetails.map((d, i) => (
                  <div key={d.label} style={{ display: "grid", gridTemplateColumns: "120px 1fr", borderBottom: i === youthPracticalDetails.length - 1 ? "none" : "1px solid var(--border-rule)" }}>
                    <div style={{ padding: "14px 16px", borderRight: "1px solid var(--border-rule)", background: "var(--bow-paper)" }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{d.label}</span>
                    </div>
                    <div style={{ padding: "14px 16px" }}>
                      <span style={{ fontFamily: "var(--font-interface)", fontSize: 14.5 }}>{d.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ border: "1px solid var(--border-rule)", marginTop: 14 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)", padding: "14px 16px", borderBottom: "1px solid var(--border-rule)", display: "block" }}>Youth Organizations FAQ</span>
                <AudienceFaq items={youthFaqs} dense />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22 }}>
                <Button href="/get-involved" variant="primary" size="md">Inquire About BOW</Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
