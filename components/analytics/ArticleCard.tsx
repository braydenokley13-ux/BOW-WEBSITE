import Link from "next/link";
import type { Article } from "@/lib/articles-shared";

export function formatArticleDate(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Publication card — index grid + related-article rails. `featured`
 * renders the bigger pinned treatment at the top of the index.
 */
export default function ArticleCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  return (
    <Link
      href={`/analytics/articles/${article.slug}`}
      className="bow-card"
      aria-label={`Read: ${article.title}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "var(--bow-white)",
        border: "1px solid var(--border-rule)",
        borderTop: `4px solid ${featured ? "var(--bow-orange)" : "var(--bow-blue)"}`,
        padding: featured ? "clamp(24px,3vw,36px)" : "22px 20px",
        color: "var(--bow-ink)",
        textDecoration: "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {article.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.coverImage}
          alt=""
          style={{ width: "100%", height: featured ? 260 : 150, objectFit: "cover", border: "1px solid var(--border-rule)" }}
        />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: featured ? "var(--bow-orange)" : "var(--bow-blue)" }}>
          {featured ? "Featured · " : ""}
          {article.category}
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--bow-slate)" }}>
          {formatArticleDate(article.publishedAt)}
        </span>
      </div>
      <h3
        style={{
          margin: 0,
          fontFamily: "var(--font-editorial)",
          fontWeight: 600,
          fontSize: featured ? "clamp(24px,3.2vw,38px)" : "clamp(18px,1.8vw,22px)",
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          textWrap: "pretty",
        }}
      >
        {article.title}
      </h3>
      {article.dek && (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: featured ? 16 : 14, lineHeight: 1.55, color: "var(--bow-slate)" }}>
          {article.dek}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: "auto", paddingTop: 6 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          {article.author}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
          Read →
        </span>
      </div>
    </Link>
  );
}
