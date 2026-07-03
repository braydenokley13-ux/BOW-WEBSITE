import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/ds";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import ArticleCard from "@/components/analytics/ArticleCard";
import { getAnalyticsPlayers } from "@/lib/nba";
import { getPublishedArticles } from "@/lib/articles";

const TITLE = "NBA Value vs. Contract — BOW Sports Capital Analytics";
const DESCRIPTION =
  "Apron-Adjusted Surplus Value (AASV): what a player produces minus what his contract truly costs under the CBA's apron rules. Every model assumption is a slider — run the numbers yourself.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Values come from the live SQLite cache (refreshed by the Python ingest);
// render per-request so a data refresh shows without a rebuild.
export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const players = getAnalyticsPlayers();
  const latest = getPublishedArticles().slice(0, 3);

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
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", color: "#6d7078" }}>
              AASV = wins × $/win − cap hit × apron multiplier
            </span>
          </div>
        </div>
      </section>

      {/* DASHBOARD */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <AnalyticsDashboard players={players} />
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
