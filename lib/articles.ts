/* ============================================================
 * Analytics publication — article reads.
 *
 * The writing side of /analytics: long-form pieces that embed live
 * model output. Reads only; mutations live in app/actions/articles.ts
 * behind requireRole("admin").
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { blobGetJson, blobList, blobMirrorEnabled } from "@/lib/blob-mirror";
import { parseTags, type Article, type ArticleRevision } from "@/lib/articles-shared";

// Re-exported so server-side callers keep a single import surface.
export { ARTICLE_CATEGORIES, parseTags } from "@/lib/articles-shared";
export type { Article, ArticleKind, ArticleRevision, ArticleStatus } from "@/lib/articles-shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The `kind` / `author_user_id` columns (reader-submitted papers) are
 * added to older bow.db files by migrate() in lib/db.ts, like every
 * other post-launch column — getDb() has already run it.
 */
export function articlesDb() {
  return getDb();
}

export function rowToArticle(r: any): Article {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    dek: r.dek ?? "",
    body: r.body ?? "",
    status: r.status === "published" ? "published" : r.status === "submitted" ? "submitted" : "draft",
    kind: r.kind === "paper" ? "paper" : "article",
    author: r.author ?? "",
    authorUserId: r.author_user_id ?? null,
    category: r.category ?? "",
    tags: parseTags(r.tags ?? ""),
    coverImage: r.cover_image ?? "",
    featured: !!r.featured,
    viewCount: Number(r.view_count) || 0,
    metaTitle: r.meta_title ?? "",
    metaDescription: r.meta_description ?? "",
    publishedAt: r.published_at == null ? null : Number(r.published_at),
    createdAt: Number(r.created_at) || 0,
    updatedAt: Number(r.updated_at) || 0,
  };
}

function rowToRevision(r: any): ArticleRevision {
  return {
    id: Number(r.id),
    articleId: r.article_id,
    title: r.title,
    dek: r.dek ?? "",
    body: r.body ?? "",
    category: r.category ?? "",
    tags: r.tags ?? "",
    savedAt: Number(r.saved_at) || 0,
  };
}

/** Published pieces, pinned first then newest, optionally filtered. */
export function getPublishedArticles(filter?: { category?: string; tag?: string }): Article[] {
  const rows = articlesDb()
    .prepare("SELECT * FROM articles WHERE status = 'published' ORDER BY featured DESC, published_at DESC")
    .all() as any[];
  let list = rows.map(rowToArticle);
  if (filter?.category) list = list.filter((a) => a.category === filter.category);
  if (filter?.tag) {
    const tag = filter.tag.toLowerCase();
    list = list.filter((a) => a.tags.includes(tag));
  }
  return list;
}

export function getPublishedArticleBySlug(slug: string): Article | null {
  const row = articlesDb().prepare("SELECT * FROM articles WHERE slug = ? AND status = 'published'").get(slug) as any;
  return row ? rowToArticle(row) : null;
}

/** Related pieces: shared category or tag overlap, newest first. */
export function getRelatedArticles(article: Article, limit = 3): Article[] {
  const all = getPublishedArticles().filter((a) => a.id !== article.id);
  const scored = all
    .map((a) => {
      let score = 0;
      if (a.category === article.category) score += 2;
      score += a.tags.filter((t) => article.tags.includes(t)).length;
      return { a, score };
    })
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score || (y.a.publishedAt ?? 0) - (x.a.publishedAt ?? 0));
  const related = scored.slice(0, limit).map((s) => s.a);
  // Backfill with the newest pieces if tag/category overlap runs dry.
  for (const a of all) {
    if (related.length >= limit) break;
    if (!related.some((r) => r.id === a.id)) related.push(a);
  }
  return related.slice(0, limit);
}

/** Published pieces whose body mentions a player slug (for player-page coverage). */
export function getArticlesMentioningPlayer(slug: string, limit = 4): Article[] {
  const rows = articlesDb()
    .prepare("SELECT * FROM articles WHERE status = 'published' AND body LIKE ? ORDER BY published_at DESC LIMIT ?")
    .all(`%${slug}%`, limit) as any[];
  return rows.map(rowToArticle);
}

/** Every distinct tag across published pieces, most-used first. */
export function getPublishedTags(limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const a of getPublishedArticles()) {
    for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, limit).map(([t]) => t);
}

/** Fire-and-forget read counter (article page render). */
export function bumpViewCount(id: string): void {
  try {
    articlesDb().prepare("UPDATE articles SET view_count = view_count + 1 WHERE id = ?").run(id);
  } catch {
    /* a lost count is not worth failing a page render */
  }
}

/* ---------------- reader-authored papers ---------------- */

/** Published research papers, newest first (the publication's papers rail). */
export function getPublishedPapers(limit = 24): Article[] {
  const rows = articlesDb()
    .prepare("SELECT * FROM articles WHERE status = 'published' AND kind = 'paper' ORDER BY published_at DESC LIMIT ?")
    .all(limit) as any[];
  return rows.map(rowToArticle);
}

/** Published papers by one author account (for the public profile). */
export function getPublishedPapersByAuthor(userId: string): Article[] {
  const rows = articlesDb()
    .prepare("SELECT * FROM articles WHERE status = 'published' AND kind = 'paper' AND author_user_id = ? ORDER BY published_at DESC")
    .all(userId) as any[];
  return rows.map(rowToArticle);
}

/** Papers waiting for editorial review, oldest submission first. */
export function getSubmittedPapers(): Article[] {
  const rows = articlesDb()
    .prepare("SELECT * FROM articles WHERE status = 'submitted' ORDER BY created_at ASC")
    .all() as any[];
  return rows.map(rowToArticle);
}

/** How many papers a reader currently has sitting in the review queue. */
export function countOpenSubmissions(userId: string): number {
  const row = articlesDb()
    .prepare("SELECT COUNT(*) AS n FROM articles WHERE status = 'submitted' AND author_user_id = ?")
    .get(userId) as any;
  return Number(row?.n) || 0;
}

/* ---------------- the durable mirror ---------------- */

/**
 * Reader-authored work cannot live on Vercel's ephemeral SQLite alone
 * (research/07's finding): every mutation in app/actions/articles.ts
 * mirrors the row to Blob, and this rehydrate — run once per process,
 * awaited by the article-facing pages — pulls anything the filesystem
 * reset ate back into the table before the first read.
 */
let rehydrated = false;
export async function rehydrateArticlesFromMirror(): Promise<void> {
  if (rehydrated || !blobMirrorEnabled()) {
    rehydrated = true;
    return;
  }
  rehydrated = true; // set first: a failed rehydrate shouldn't retry per-request and hammer the mirror
  try {
    const entries = await blobList("articles/");
    if (entries.length === 0) return;
    const db = articlesDb();
    const localStamp = db.prepare("SELECT id, updated_at FROM articles");
    const upsert = db.prepare(
      `INSERT OR REPLACE INTO articles (id, slug, title, dek, body, status, kind, author, author_user_id, category, tags, cover_image, featured, view_count, meta_title, meta_description, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const local = new Map<string, number>();
    for (const r of localStamp.all() as any[]) local.set(r.id, Number(r.updated_at) || 0);
    for (const entry of entries) {
      const a = await blobGetJson<Article>(entry.url);
      if (!a?.id || !a.slug || !a.title) continue;
      const localUpdated = local.get(a.id);
      if (localUpdated !== undefined && localUpdated >= a.updatedAt) continue;
      upsert.run(
        a.id, a.slug, a.title, a.dek ?? "", a.body ?? "",
        a.status === "published" ? "published" : a.status === "submitted" ? "submitted" : "draft",
        a.kind === "paper" ? "paper" : "article",
        a.author ?? "", a.authorUserId ?? null, a.category ?? "", (a.tags ?? []).join(","),
        a.coverImage ?? "", a.featured ? 1 : 0, Number(a.viewCount) || 0,
        a.metaTitle ?? "", a.metaDescription ?? "", a.publishedAt ?? null,
        Number(a.createdAt) || Date.now(), Number(a.updatedAt) || Date.now(),
      );
    }
  } catch (err) {
    console.warn("[articles] mirror rehydrate failed:", err);
  }
}

/* ---------------- admin reads ---------------- */

export function getAllArticlesAdmin(): Article[] {
  const rows = articlesDb().prepare("SELECT * FROM articles ORDER BY updated_at DESC").all() as any[];
  return rows.map(rowToArticle);
}

export function getArticleByIdAdmin(id: string): Article | null {
  const row = articlesDb().prepare("SELECT * FROM articles WHERE id = ?").get(id) as any;
  return row ? rowToArticle(row) : null;
}

export function getArticleRevisions(articleId: string, limit = 20): ArticleRevision[] {
  const rows = articlesDb()
    .prepare("SELECT * FROM article_revisions WHERE article_id = ? ORDER BY saved_at DESC LIMIT ?")
    .all(articleId, limit) as any[];
  return rows.map(rowToRevision);
}

/* eslint-enable @typescript-eslint/no-explicit-any */
