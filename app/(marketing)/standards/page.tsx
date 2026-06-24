import type { Metadata } from "next";
import Link from "next/link";
import { CapLine } from "@/components/ds";
import { getStandardsAlignment, buildStandardsHtml, type StandardsEntry } from "@/lib/standards";
import StandardsDownloadButton from "@/components/site/StandardsDownloadButton";

const TITLE = "AP Economics Standards Alignment — BOW Sports Capital";
const DESCRIPTION =
  "How every BOW Sports Capital module maps to specific AP Microeconomics and AP Macroeconomics standards — the document a curriculum committee needs.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: "/standards",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

function StandardsList({ items }: { items: string[] }) {
  if (items.length === 0) return <span style={{ color: "var(--bow-slate)" }}>—</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((s, i) => (
        <li key={i} style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.45, color: "var(--bow-ink)" }}>{s}</li>
      ))}
    </ul>
  );
}

function ModuleCard({ e }: { e: StandardsEntry }) {
  return (
    <article style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "22px 24px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: "var(--bow-ink)", padding: "3px 9px", borderRadius: 3 }}>
          Track {e.track}
        </span>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
          {e.moduleName}
        </h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginTop: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", marginBottom: 6 }}>Key Concepts</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {e.keyConcepts.map((c, i) => (
              <span key={i} style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-ink)", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 999, padding: "3px 10px" }}>{c}</span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)", marginBottom: 6 }}>AP Micro</div>
          <StandardsList items={e.apMicroStandards} />
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-positive)", marginBottom: 6 }}>AP Macro</div>
          <StandardsList items={e.apMacroStandards} />
        </div>
      </div>
    </article>
  );
}

export default function StandardsPage() {
  const entries = getStandardsAlignment();
  const downloadHtml = buildStandardsHtml(entries);

  return (
    <div data-screen-label="Standards Alignment">
      {/* HEADER */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Sports Capital Curriculum
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.0, letterSpacing: "-0.015em", maxWidth: "18ch", textWrap: "balance" }}>
            AP Economics Standards Alignment
          </h1>
          <p style={{ margin: "20px 0 0", maxWidth: 760, fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.6, color: "#c8cad0" }}>
            Every BOW module maps to specific AP Microeconomics and AP Macroeconomics standards. This is the document a curriculum committee or partnership team needs to evaluate BOW.
          </p>
          <CapLine weight={6} step={14} stepAt={0.42} style={{ maxWidth: 260, marginTop: 28 }} />
        </div>
      </section>

      {/* MODULES */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <StandardsDownloadButton html={downloadHtml} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {entries.map((e) => (
              <ModuleCard key={e.id} e={e} />
            ))}
          </div>

          {/* STATEMENT */}
          <div style={{ marginTop: 36, background: "var(--bow-ink)", color: "#fff", borderRadius: 8, padding: "clamp(24px,4vw,40px)" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontSize: "clamp(17px,2vw,22px)", lineHeight: 1.5, color: "#e9eaee" }}>
              BOW Sports Capital is not a sports trivia program. It is an economics education platform that uses sports as the delivery mechanism for concepts that appear on the AP Economics exam. Students who complete both tracks will have been exposed to the majority of AP Micro and AP Macro content — through real decisions, not memorization.
            </p>
            <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <StandardsDownloadButton html={downloadHtml} />
              <Link href="/contact" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 26px", border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "#fff", borderRadius: 4, textDecoration: "none" }}>
                Request a Partnership →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
