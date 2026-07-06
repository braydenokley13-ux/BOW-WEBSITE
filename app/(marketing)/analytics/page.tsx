import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/ds";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import ArticleCard from "@/components/analytics/ArticleCard";
import LensSwitcher from "@/components/research/LensSwitcher";
import { getAnalyticsPlayers, getDataProvenance } from "@/lib/nba";
import { getPublishedArticles } from "@/lib/articles";
import { getOpenDocket } from "@/lib/questions";
import { getLedgerEventsSync } from "@/lib/ledger-store";
import { summarizeLastWeek } from "@/lib/ledger";
import { QUESTION_KIND_LABELS } from "@/lib/research-types";

const TITLE = "NBA Value vs. Contract — BOW Sports Capital Analytics";
const DESCRIPTION =
  "Apron-Adjusted Surplus Value (AASV): what a player produces minus what his contract truly costs under the CBA's apron rules. Every model assumption is a slider — run the numbers yourself.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Values come from the live SQLite cache (refreshed by the TypeScript nba
// ingest); render per-request so a data refresh shows without a rebuild.
export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const players = getAnalyticsPlayers();
  const latest = getPublishedArticles().slice(0, 3);
  const docket = getOpenDocket();
  const teaser = docket.slice(0, 4);
  const provenance = getDataProvenance();
  // Sync read of whatever ledger history exists — /analytics/ledger is
  // the surface that actually turns the daily page.
  const week = summarizeLastWeek(getLedgerEventsSync());
  const weekMoves = week.flips + week.opened + week.reopened + week.settled;

  return (
    <div data-screen-label="Analytics">
      {/* HERO — front-office mode */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Analytics · Value vs. Contract
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(32px,5vw,58px)", lineHeight: 1.04, letterSpacing: "-0.018em", maxWidth: "18ch", color: "#fff", textWrap: "pretty" }}>
            What a star is worth when every dollar doesn&rsquo;t cost a dollar.
          </h1>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 640 }}>
            <strong style={{ color: "#fff" }}>Apron-Adjusted Surplus Value (AASV)</strong> prices a player two ways —
            the wins he produces, and what his contract truly costs once the CBA&rsquo;s apron penalties are charged
            against it. The gap between the two is his real trade value. Every assumption below is yours to set.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 22 }}>
            <Link href="/analytics/articles" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              Read the publication →
            </Link>
            <Link href="/analytics/teams" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              See the team rollup →
            </Link>
            <Link href="/analytics/trade" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              Open the trade machine →
            </Link>
            <Link href="/analytics/questions" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              Open the docket →
            </Link>
            <Link href="/analytics/ledger" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              The ledger →
            </Link>
            <Link href="/analytics/notebook" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              Your notebook →
            </Link>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", color: "#6d7078" }}>
              AASV = wins × $/win − cap hit × apron multiplier
            </span>
          </div>
          <p style={{ margin: "16px 0 0", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#6d7078" }}>
            {provenance.playerCount} tracked contracts · {provenance.teamCount} teams · hand-curated from public
            reporting{provenance.asOf ? ` as of ${provenance.asOf}` : ""} ·{" "}
            <Link href="/analytics/methods" style={{ color: "#6f8bff" }}>
              how the model works →
            </Link>
          </p>
        </div>
      </section>

      {/* NEW HERE? — the plain-English onramp from the classroom side of the house */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(18px,2.6vw,28px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 16px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            New here?
          </span>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)", flex: "1 1 380px", textWrap: "pretty" }}>
            The whole idea in one sentence: a player is worth what he produces minus what he truly costs — and every
            number that goes into that sentence is a dial you can turn, not a fact we hand you. If terms like
            &ldquo;apron&rdquo; or &ldquo;surplus value&rdquo; are new,{" "}
            <Link href="/glossary" className="bow-link" style={{ color: "var(--bow-blue)" }}>the glossary</Link> defines
            every one, and{" "}
            <Link href="/programs/track-101" className="bow-link" style={{ color: "var(--bow-blue)" }}>Track 101</Link>{" "}
            teaches the economics behind the dials.
          </p>
        </div>
      </section>

      {/* STEP 1 — ADOPT A WORLDVIEW */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", padding: "clamp(36px,5vw,64px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <SectionHeader kicker="Step 1 · Worldview" title="Adopt a worldview" style={{ marginBottom: 22 }} />
          <p style={{ margin: "0 0 24px", fontFamily: "var(--font-interface)", fontSize: "clamp(14px,1.4vw,16px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 640, textWrap: "pretty" }}>
            The model&rsquo;s every number depends on what you believe a win costs. Pick a desk to sit at — everything
            on this site recomputes under it.
          </p>
          <LensSwitcher dark />
        </div>
      </section>

      {/* STEP 2 — THE OPEN DOCKET */}
      <section style={{ background: "#fff", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <SectionHeader
            kicker="Step 2 · Pick a fight"
            title="The Open Docket"
            action={{ label: `All ${docket.length} open questions →`, href: "/analytics/questions" }}
            style={{ marginBottom: 22 }}
          />
          {weekMoves > 0 && (
            <p style={{ margin: "-10px 0 18px", fontFamily: "var(--font-data)", fontSize: 12.5, letterSpacing: "0.03em", color: "var(--bow-slate)" }}>
              This week the model went on the record: {week.flips} verdict flip{week.flips === 1 ? "" : "s"} ·{" "}
              {week.opened + week.reopened} question{week.opened + week.reopened === 1 ? "" : "s"} opened · {week.settled} settled ·{" "}
              <Link href="/analytics/ledger" className="bow-link" style={{ color: "var(--bow-blue)" }}>
                read the ledger →
              </Link>
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {teaser.map((q, i) => (
              <div
                key={q.id}
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "baseline",
                  padding: "16px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-rule)",
                }}
              >
                <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)", flex: "0 0 22px" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
                    {QUESTION_KIND_LABELS[q.kind]}
                  </span>
                  <Link
                    href={`/analytics/questions/${encodeURIComponent(q.id)}`}
                    className="bow-link"
                    style={{ fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(16px,1.8vw,19px)", lineHeight: 1.35, color: "var(--bow-ink)", textDecoration: "none", textWrap: "pretty" }}
                  >
                    {q.question}
                  </Link>
                  {q.setup[0] && (
                    <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>
                      {q.setup[0]}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {teaser.length === 0 && (
              <p style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
                No open questions on the current slate.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* STEP 3 — DASHBOARD */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <span style={{ display: "block", marginBottom: 16, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            Step 3 · Run the numbers yourself
          </span>
          <AnalyticsDashboard players={players} />
        </div>
      </section>

      {/* STEP 4 — PUBLISH */}
      <section style={{ background: "#fff", padding: "clamp(16px,2.2vw,24px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide" style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px 16px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            Step 4 · Publish
          </span>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)", flex: "1 1 320px" }}>
            Clip evidence anywhere you see &ldquo;+ Clip&rdquo;, arrange it in the notebook, and compile a draft the
            publication&rsquo;s editor understands.
          </p>
          <Link
            href="/analytics/notebook"
            className="bow-link"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", textDecoration: "none" }}
          >
            Open your notebook →
          </Link>
        </div>
      </section>

      {/* LATEST FROM THE PUBLICATION */}
      {latest.length > 0 && (
        <section style={{ background: "#fff", padding: "clamp(36px,5vw,64px) clamp(18px,4vw,40px)" }}>
          <div className="bow-container-wide">
            <SectionHeader kicker="The publication" title="Latest analysis" action={{ label: "All articles →", href: "/analytics/articles" }} style={{ marginBottom: 28 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
              {latest.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
