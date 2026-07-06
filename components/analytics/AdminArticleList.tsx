"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, DataStrip } from "@/components/ds";
import { formatArticleDate } from "@/components/analytics/ArticleCard";
import { deleteArticle, setArticleFeatured, setArticleStatus } from "@/app/actions/articles";
import type { Article } from "@/lib/articles-shared";
import type { StatsFreshness } from "@/lib/nba";

/**
 * The publishing desk: every article (draft + published), one-click
 * publish/feature/delete, and a data-freshness strip so the owner can
 * see when the stat cache was last refreshed by the ingest script.
 */
export default function AdminArticleList({ articles, freshness }: { articles: Article[]; freshness: StatsFreshness }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const drafts = articles.filter((a) => a.status === "draft").length;
  const submitted = articles.filter((a) => a.status === "submitted").length;
  const published = articles.length - drafts - submitted;
  const totalViews = articles.reduce((s, a) => s + a.viewCount, 0);
  // The review queue outranks everything else on the desk: reader papers
  // waiting for a decision float to the top of the table.
  const ordered = [...articles.filter((a) => a.status === "submitted"), ...articles.filter((a) => a.status !== "submitted")];

  const smallBtn: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 11.5,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    padding: "6px 10px",
    border: "1px solid var(--border-rule)",
    background: "var(--bow-white)",
    color: "var(--bow-ink)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(18px,2.4vw,26px)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            Publishing desk
          </span>
          <h1 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.4vw,38px)", textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 0.95 }}>
            Articles
          </h1>
        </div>
        <Button href="/analytics/admin/editor/new" variant="primary" size="md">
          + New Article
        </Button>
      </div>

      <DataStrip
        dense
        items={[
          { label: "Published", value: String(published) },
          { label: "Drafts", value: String(drafts) },
          { label: "Review queue", value: String(submitted), tone: submitted > 0 ? "warning" : undefined },
          { label: "Total reads", value: totalViews.toLocaleString("en-US") },
          { label: "Players tracked", value: String(freshness.players) },
          {
            label: "Stat cache",
            value: freshness.liveRows > 0 ? `${freshness.liveRows} live via nba_api` : "snapshot only",
            tone: freshness.liveRows > 0 ? "positive" : "warning",
          },
          {
            label: "Stats updated",
            value: freshness.lastUpdated ? formatArticleDate(freshness.lastUpdated) : "—",
          },
        ]}
      />
      <p style={{ margin: "-10px 0 0", fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--bow-slate)" }}>
        Refresh live stats with <code style={{ fontFamily: "var(--font-data)", background: "var(--bow-white)", border: "1px solid var(--border-rule)", padding: "1px 6px" }}>python3 scripts/nba_ingest.py</code>
        {" "}· contracts &amp; apron tiers are hand-edited in <code style={{ fontFamily: "var(--font-data)", background: "var(--bow-white)", border: "1px solid var(--border-rule)", padding: "1px 6px" }}>data-seeds/contracts.csv</code>
      </p>

      <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr>
              {["Status", "Title", "Category", "Updated", "Published", "Reads", "Actions"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{ padding: "10px 14px", textAlign: h === "Reads" ? "right" : "left", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", background: "var(--bow-paper)", borderBottom: "1px solid var(--border-rule)", whiteSpace: "nowrap" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((a) => (
              <tr key={a.id} style={{ borderTop: "1px solid var(--border-rule)", opacity: pending ? 0.6 : 1 }}>
                <td style={{ padding: "10px 14px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10.5,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "3px 8px",
                      color:
                        a.status === "published"
                          ? "var(--bow-positive)"
                          : a.status === "submitted"
                            ? "var(--bow-blue)"
                            : "var(--bow-warning-text)",
                      background: a.status === "published" ? "var(--bow-positive-tint)" : "var(--bow-warning-tint)",
                      border: "1px solid var(--border-rule)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.status === "submitted" ? "in review" : a.status}
                    {a.featured ? " · ★" : ""}
                  </span>
                </td>
                <td style={{ padding: "10px 14px", minWidth: 260 }}>
                  <Link href={`/analytics/admin/editor/${a.id}`} className="bow-link" style={{ fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 16.5, lineHeight: 1.25, color: "var(--bow-ink)", textDecoration: "none" }}>
                    {a.title}
                  </Link>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", marginTop: 3 }}>
                    /{a.slug}
                    {a.kind === "paper" && ` · paper by ${a.author || "unknown"}`}
                  </div>
                </td>
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{a.category}</td>
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", whiteSpace: "nowrap" }}>{formatArticleDate(a.updatedAt)}</td>
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", whiteSpace: "nowrap" }}>
                  {a.publishedAt ? formatArticleDate(a.publishedAt) : "—"}
                </td>
                <td style={{ padding: "10px 14px", fontFamily: "var(--font-data)", fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {a.viewCount.toLocaleString("en-US")}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link href={`/analytics/admin/editor/${a.id}`} style={{ ...smallBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                      Edit
                    </Link>
                    <button type="button" disabled={pending} style={smallBtn} onClick={() => act(() => setArticleStatus(a.id, a.status !== "published"))}>
                      {a.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      title={a.featured ? "Unpin from top of index" : "Pin to top of index"}
                      style={{ ...smallBtn, color: a.featured ? "var(--bow-orange)" : "var(--bow-ink)" }}
                      onClick={() => act(() => setArticleFeatured(a.id, !a.featured))}
                    >
                      {a.featured ? "★ Featured" : "☆ Feature"}
                    </button>
                    {a.status === "published" && (
                      <Link href={`/analytics/articles/${a.slug}`} style={{ ...smallBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                        View
                      </Link>
                    )}
                    {confirmDelete === a.id ? (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          style={{ ...smallBtn, background: "var(--bow-negative)", borderColor: "var(--bow-negative)", color: "#fff" }}
                          onClick={() => {
                            setConfirmDelete(null);
                            act(() => deleteArticle(a.id));
                          }}
                        >
                          Confirm delete
                        </button>
                        <button type="button" style={smallBtn} onClick={() => setConfirmDelete(null)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <button type="button" disabled={pending} style={{ ...smallBtn, color: "var(--bow-negative)" }} onClick={() => setConfirmDelete(a.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "26px 16px", textAlign: "center", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
                  Nothing here yet — write the first piece.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
