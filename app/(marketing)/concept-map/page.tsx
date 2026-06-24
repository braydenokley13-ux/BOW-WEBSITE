import type { Metadata } from "next";
import { CapLine } from "@/components/ds";
import { getConceptMap } from "@/lib/concept-map";
import ConceptMapView from "@/components/site/ConceptMapView";

const TITLE = "Front Office Concept Map — BOW Sports Capital";
const DESCRIPTION =
  "Every economics concept BOW teaches, mapped to the track and module that covers it, how real NBA/NFL/MLB front offices use it, and a specific real-world example.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: "/concept-map",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ConceptMapPage() {
  const entries = getConceptMap();

  return (
    <div data-screen-label="Concept Map">
      {/* HEADER */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Sports Capital Curriculum
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.0, letterSpacing: "-0.015em", maxWidth: "16ch", textWrap: "balance" }}>
            The Front Office Concept Map
          </h1>
          <p style={{ margin: "20px 0 0", maxWidth: 760, fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.6, color: "#c8cad0" }}>
            Every concept taught in BOW is drawn from AP Microeconomics, AP Macroeconomics, or real NBA/NFL/MLB front-office practice. This is what your students will learn.
          </p>
          <CapLine weight={6} step={14} stepAt={0.42} style={{ maxWidth: 260, marginTop: 28 }} />
        </div>
      </section>

      {/* CONCEPT MAP */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <ConceptMapView entries={entries} />
        </div>
      </section>
    </div>
  );
}
