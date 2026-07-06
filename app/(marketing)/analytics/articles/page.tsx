import type { Metadata } from "next";
import Link from "next/link";
import ArticleCard from "@/components/analytics/ArticleCard";
import { ARTICLE_CATEGORIES, getPublishedArticles, getPublishedTags, rehydrateArticlesFromMirror } from "@/lib/articles";
import { getDataProvenance } from "@/lib/nba";

const TITLE = "Analytics Articles — BOW Sports Capital";
const DESCRIPTION =
  "Front-office analysis and reader-submitted research papers where every embedded number is recomputed from the AASV model at read time — with the data's limits stated on the methods page.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics/articles" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const dynamic = "force-dynamic";

export default async function ArticlesIndex({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string }>;
}) {
  // Published work must survive a cold start — pull the durable mirror
  // back before reading (no-op without a Blob token).
  await rehydrateArticlesFromMirror();
  const { category, tag } = await searchParams;
  const activeCategory = category && (ARTICLE_CATEGORIES as readonly string[]).includes(category) ? category : undefined;
  const activeTag = tag?.toLowerCase() || undefined;

  const articles = getPublishedArticles({ category: activeCategory, tag: activeTag });
  const provenance = getDataProvenance();
  const tags = getPublishedTags();
  const filtered = Boolean(activeCategory || activeTag);
  const featured = !filtered ? articles.filter((a) => a.featured) : [];
  const rest = filtered ? articles : articles.filter((a) => !a.featured);

  const chip = (label: string, href: string, active: boolean, accent = "var(--bow-blue)"): React.ReactNode => (
    <Link
      key={href}
      href={href}
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 11.5,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "6px 12px",
        border: `1px solid ${active ? accent : "var(--border-rule)"}`,
        background: active ? accent : "var(--bow-white)",
        color: active ? "#fff" : "var(--bow-ink)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );

  return (
    <div data-screen-label="Analytics Articles">
      {/* header */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(40px,5.5vw,76px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Analytics · The Publication
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.6vw,52px)", lineHeight: 1.05, letterSpacing: "-0.015em", color: "#fff", maxWidth: "20ch" }}>
            Analysis where every number is alive.
          </h1>
          <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(14.5px,1.4vw,17px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 620 }}>
            These pieces don&rsquo;t quote stale screenshots — they embed the{" "}
            <Link href="/analytics" style={{ color: "#6f8bff" }}>
              AASV model
            </Link>{" "}
            directly, so a player card or chart inside a story always shows the model&rsquo;s current values. Reader
            research that survives the desk&rsquo;s review publishes here too, under the author&rsquo;s own name.
          </p>
          <p style={{ margin: "14px 0 0", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#6d7078" }}>
            {provenance.playerCount} tracked contracts{provenance.asOf ? ` · curated as of ${provenance.asOf}` : ""} ·{" "}
            <Link href="/analytics/methods" style={{ color: "#6f8bff" }}>
              methods &amp; data →
            </Link>
          </p>
        </div>
      </section>

      {/* filters */}
      <section style={{ background: "var(--bow-paper)", padding: "18px clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", marginRight: 4 }}>
              Category
            </span>
            {chip("All", "/analytics/articles", !filtered)}
            {ARTICLE_CATEGORIES.map((c) => chip(c, `/analytics/articles?category=${encodeURIComponent(c)}`, activeCategory === c))}
          </div>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", marginRight: 4 }}>
                Tags
              </span>
              {tags.map((t) => chip(`#${t}`, `/analytics/articles?tag=${encodeURIComponent(t)}`, activeTag === t, "var(--bow-orange)"))}
            </div>
          )}
        </div>
      </section>

      {/* list */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)", minHeight: 320 }}>
        <div className="bow-container-wide" style={{ display: "flex", flexDirection: "column", gap: "clamp(16px,2.2vw,24px)" }}>
          {featured.map((a) => (
            <ArticleCard key={a.id} article={a} featured />
          ))}
          {rest.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
              {rest.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          ) : (
            featured.length === 0 && (
              <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
                Nothing published {filtered ? "under that filter yet" : "yet"}.{" "}
                <Link href="/analytics/articles" style={{ color: "var(--bow-blue)" }}>
                  Clear filters
                </Link>
              </p>
            )
          )}
        </div>
      </section>
    </div>
  );
}
