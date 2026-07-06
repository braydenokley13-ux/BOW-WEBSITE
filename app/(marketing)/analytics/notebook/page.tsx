import type { Metadata } from "next";
import NotebookWorkbench from "@/components/research/NotebookWorkbench";
import { getCurrentUser } from "@/lib/dal";

const TITLE = "The Notebook — BOW Sports Capital Analytics";
const DESCRIPTION =
  "Arrange clipped evidence — verdicts, scenario bands, trade breakdowns — into a supports/challenges/open argument, then compile it into a publication-ready draft with live data embeds.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics/notebook" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default async function NotebookPage() {
  // Anyone can compile a draft; submitting it as a paper needs a name
  // on the byline, so the workbench learns who (if anyone) is signed in.
  const user = await getCurrentUser();
  const viewer = user ? { name: user.name } : null;
  return (
    <div data-screen-label="Analytics Notebook">
      {/* header */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(40px,5.5vw,76px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Analytics · The Notebook
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.6vw,52px)", lineHeight: 1.05, letterSpacing: "-0.015em", color: "#fff", maxWidth: "20ch" }}>
            Turn clipped evidence into an argument.
          </h1>
          <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(14.5px,1.4vw,17px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 640 }}>
            Every clip freezes the numbers AND the assumptions that produced them, so an argument built here stays
            honest after the sliders move or the nightly stat ingest runs. Arrange what you&rsquo;ve clipped into
            supports, challenges, and open questions, then compile it into a draft with live data embeds.
          </p>
        </div>
      </section>

      {/* workbench */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(24px,3.4vw,44px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <NotebookWorkbench viewer={viewer} />
        </div>
      </section>
    </div>
  );
}
