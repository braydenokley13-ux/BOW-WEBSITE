import type { Metadata } from "next";
import Link from "next/link";
import { getOpenDocket } from "@/lib/questions";
import { getAnalyticsPlayers } from "@/lib/nba";
import QuestionKindChip, { QUESTION_KIND_EXPLANATIONS } from "@/components/research/QuestionKindChip";
import type { QuestionKind } from "@/lib/research-types";

const TITLE = "The Open Docket — BOW Sports Capital Analytics";
const DESCRIPTION =
  "Research questions the model can't settle on its own — knife-edge verdicts, worldview splits, and free lunches the apron created. Pick one up and go settle it in print.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics/questions" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// The docket is mined fresh from the live SQLite cache on every request,
// same reasoning as /analytics itself — a data refresh shows without a rebuild.
export const dynamic = "force-dynamic";

const LEGEND_KINDS: QuestionKind[] = [
  "knife-edge",
  "lens-split",
  "price-production-gap",
  "aging-cliff",
  "metric-disagreement",
  "mutual-gain-trade",
  "window-contradiction",
];

export default async function QuestionsPage() {
  const docket = (await getOpenDocket());
  const trackedCount = (await getAnalyticsPlayers()).length;

  return (
    <div data-screen-label="Open Docket">
      {/* HERO — front-office mode */}
      <section
        className="bow-front-office"
        style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}
      >
        <div className="bow-container-wide">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--bow-orange)",
            }}
          >
            BOW Analytics &middot; The Open Docket
          </span>
          <h1
            style={{
              margin: "14px 0 0",
              fontFamily: "var(--font-editorial)",
              fontWeight: 600,
              fontSize: "clamp(32px,5vw,58px)",
              lineHeight: 1.04,
              letterSpacing: "-0.018em",
              maxWidth: "20ch",
              color: "#fff",
              textWrap: "pretty",
            }}
          >
            The questions the model can&rsquo;t answer are the ones worth writing about.
          </h1>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 680 }}>
            Every case below is computed straight out of the model&rsquo;s own disagreement — knife-edge verdicts, worldviews
            that split, metrics that won&rsquo;t agree, trades nobody has made — and it refreshes as data and assumptions
            move. Pick one up: it opens straight into the notebook, evidence attached, ready for you to build the argument.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 22, alignItems: "center" }}>
            <Link href="/analytics/notebook" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              Open your notebook &rarr;
            </Link>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", color: "#6d7078" }}>
              {docket.length} open question{docket.length === 1 ? "" : "s"} &middot; generated from {trackedCount} tracked contract{trackedCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </section>

      {/* LEGEND — the seven kinds, one line each */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(20px,3vw,32px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            Seven kinds of unresolved tension
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 28px", marginTop: 14 }}>
            {LEGEND_KINDS.map((kind) => (
              <div key={kind} style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 260px", minWidth: 0, maxWidth: 380 }}>
                <QuestionKindChip kind={kind} />
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
                  {QUESTION_KIND_EXPLANATIONS[kind]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THE BOARD — a single ranked case list, heat-sorted; the ranking IS the editorial judgment */}
      <section style={{ background: "#fff", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <div style={{ borderTop: "1px solid var(--border-rule)" }}>
            {docket.map((q, i) => (
              <Link
                key={q.id}
                href={`/analytics/questions/${encodeURIComponent(q.id)}`}
                className="bow-docket-row bow-card"
                style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: "4px 18px", padding: "22px 6px", borderBottom: "1px solid var(--border-rule)", textDecoration: "none", color: "inherit" }}
              >
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 14, color: "var(--bow-slate)", fontVariantNumeric: "tabular-nums" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <QuestionKindChip kind={q.kind} />
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                      heat {q.heat}
                    </span>
                  </div>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-editorial)",
                      fontWeight: 600,
                      fontSize: "clamp(18px,2.2vw,23px)",
                      lineHeight: 1.3,
                      color: "var(--bow-ink)",
                      textWrap: "pretty",
                    }}
                  >
                    {q.question}
                  </h3>
                  <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "var(--bow-slate)", maxWidth: 760 }}>
                    {q.setup[0]}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .bow-docket-row:hover h3 { color: var(--bow-blue); }
        @media (max-width: 560px) {
          .bow-docket-row { grid-template-columns: 26px 1fr !important; }
        }
      `}</style>
    </div>
  );
}
