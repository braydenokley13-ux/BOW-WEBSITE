import type { Metadata } from "next";
import { CapLine } from "@/components/ds";
import { getGlossaryTerms } from "@/lib/glossary";
import GlossaryView from "@/components/site/GlossaryView";

const TITLE = "Front Office Glossary";
const DESCRIPTION =
  "A searchable, plain-English glossary of every term in the BOW curriculum — from salary cap and Bird Rights to opportunity cost and Wins Above Replacement.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: "/glossary",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function GlossaryPage() {
  const terms = (await getGlossaryTerms());

  return (
    <div data-screen-label="Glossary">
      {/* HEADER */}
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Sports Capital Curriculum
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.0, letterSpacing: "-0.015em", maxWidth: "16ch", textWrap: "balance" }}>
            The Front Office Glossary
          </h1>
          <p style={{ margin: "20px 0 0", maxWidth: 720, fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.6, color: "#c8cad0" }}>
            Every term BOW students learn, defined in plain English with a real-world example — the language of the front office, made readable for a twelve-year-old.
          </p>
          <CapLine weight={6} step={14} stepAt={0.42} style={{ maxWidth: 260, marginTop: 28 }} />
        </div>
      </section>

      {/* GLOSSARY */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <GlossaryView terms={terms} />
        </div>
      </section>
    </div>
  );
}
