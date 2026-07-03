import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownView from "@/components/analytics/MarkdownView";
import ArticleCard, { formatArticleDate } from "@/components/analytics/ArticleCard";
import ShareButtons from "@/components/analytics/ShareButtons";
import { bumpViewCount, getPublishedArticleBySlug, getRelatedArticles } from "@/lib/articles";
import { getAnalyticsPlayers, getAnalyticsPlayersBySlugs, getPlayerSeasonHistory, type SeasonStat } from "@/lib/nba";
import { collectEmbedSlugs, collectEmbedTeams, parseMarkdown } from "@/lib/markdown";
import type { AnalyticsPlayer } from "@/lib/aasv";

// Embeds must show the model's CURRENT values, and reads count views.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublishedArticleBySlug(slug);
  if (!article) return { title: "Article Not Found — BOW Analytics" };
  const title = article.metaTitle || `${article.title} — BOW Sports Capital Analytics`;
  const description = article.metaDescription || article.dek || article.title;
  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      url: `/analytics/articles/${article.slug}`,
      publishedTime: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
      authors: article.author ? [article.author] : undefined,
      tags: article.tags,
      ...(article.coverImage ? { images: [{ url: article.coverImage }] } : {}),
    },
    twitter: {
      card: article.coverImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(article.coverImage ? { images: [article.coverImage] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getPublishedArticleBySlug(slug);
  if (!article) notFound();

  bumpViewCount(article.id);

  // One query prefetches every player any embed in the body references.
  const blocks = parseMarkdown(article.body);
  const embedPlayers = getAnalyticsPlayersBySlugs(collectEmbedSlugs(blocks));
  const playerMap: Record<string, AnalyticsPlayer> = {};
  for (const p of embedPlayers) playerMap[p.slug] = p;

  // <TeamCapSheet/> needs every tracked player for its team, not just the
  // slugs an author explicitly embedded — pull the full curated list and
  // merge its team members in when the body actually references a team.
  const embedTeams = collectEmbedTeams(blocks);
  if (embedTeams.length > 0) {
    for (const p of getAnalyticsPlayers()) {
      if (embedTeams.includes(p.team)) playerMap[p.slug] = p;
    }
  }

  // <TrendChart/> needs each embedded player's season history.
  const playerHistories: Record<string, SeasonStat[]> = Object.fromEntries(
    collectEmbedSlugs(blocks).map((s) => [s, getPlayerSeasonHistory(s)]),
  );

  const related = getRelatedArticles(article, 3);

  return (
    <div data-screen-label="Article">
      <article>
        {/* header */}
        <header style={{ background: "var(--bow-paper)", padding: "clamp(28px,4vw,52px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <nav aria-label="Breadcrumb" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)", marginBottom: 22 }}>
              <Link href="/analytics" style={{ color: "var(--bow-blue)" }}>
                Analytics
              </Link>
              <span aria-hidden>/</span>
              <Link href="/analytics/articles" style={{ color: "var(--bow-blue)" }}>
                Articles
              </Link>
              <span aria-hidden>/</span>
              <Link href={`/analytics/articles?category=${encodeURIComponent(article.category)}`} style={{ color: "var(--bow-blue)" }}>
                {article.category}
              </Link>
            </nav>
            <h1 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.8vw,52px)", lineHeight: 1.07, letterSpacing: "-0.018em", color: "var(--bow-ink)", textWrap: "pretty" }}>
              {article.title}
            </h1>
            {article.dek && (
              <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15.5px,1.6vw,19px)", lineHeight: 1.55, color: "var(--bow-slate)", maxWidth: "60ch" }}>
                {article.dek}
              </p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 22px", marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border-rule)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
                {article.author || "BOW Front Office"}
              </span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", color: "var(--bow-slate)" }}>
                {formatArticleDate(article.publishedAt)}
              </span>
              <span style={{ marginLeft: "auto" }}>
                <ShareButtons title={article.title} path={`/analytics/articles/${article.slug}`} />
              </span>
            </div>
          </div>
        </header>

        {/* cover */}
        {article.coverImage && (
          <div style={{ background: "var(--bow-paper)", padding: "0 clamp(18px,4vw,40px)" }}>
            <div style={{ maxWidth: 960, margin: "0 auto", transform: "translateY(clamp(14px,2vw,26px))" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.coverImage} alt="" style={{ width: "100%", maxHeight: 480, objectFit: "cover", border: "1px solid var(--border-rule)", display: "block" }} />
            </div>
          </div>
        )}

        {/* body */}
        <div style={{ background: "#fff", padding: "clamp(36px,5vw,64px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <MarkdownView blocks={blocks} players={playerMap} playerHistories={playerHistories} />

            {/* tags */}
            {article.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 36, paddingTop: 20, borderTop: "1px solid var(--border-rule)" }}>
                {article.tags.map((t) => (
                  <Link
                    key={t}
                    href={`/analytics/articles?tag=${encodeURIComponent(t)}`}
                    style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", padding: "5px 10px", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", textDecoration: "none", background: "var(--bow-paper)" }}
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </article>

      {/* related */}
      {related.length > 0 && (
        <section style={{ background: "var(--bow-paper)", padding: "clamp(32px,4.5vw,56px) clamp(18px,4vw,40px)" }}>
          <div className="bow-container-wide">
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
              Keep reading
            </span>
            <h2 style={{ margin: "10px 0 24px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(22px,2.8vw,32px)", lineHeight: 1.1 }}>
              Related analysis
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
              {related.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
