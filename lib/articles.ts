/* ============================================================
 * Analytics publication — article reads.
 *
 * The writing side of /analytics: long-form pieces that embed live
 * model output. Reads only; mutations live in app/actions/articles.ts
 * behind requireRole("admin").
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import {
  blobDelete,
  blobGetJson,
  blobListDetailed,
  blobMirrorEnabled,
  type BlobStoreOptions,
} from "@/lib/blob-mirror";
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

/* ---------------- privacy-separated durable mirrors ---------------- */

/**
 * Public Blob is an anonymous publication cache only. It must never contain
 * a draft, a submitted paper, an account id, or an author/byline identity.
 * Full-fidelity article durability belongs in a separately provisioned
 * PRIVATE Blob store.
 */
export const PUBLIC_ARTICLE_MIRROR_PREFIX = "articles/public-v1/";
export const PRIVATE_ARTICLE_MIRROR_PREFIX = "articles/private-v1/";

export interface PublicArticleMirrorV1 {
  version: 1;
  visibility: "public";
  status: "published";
  article: {
    id: string;
    slug: string;
    title: string;
    dek: string;
    body: string;
    kind: "article" | "paper";
    category: string;
    tags: string[];
    coverImage: string;
    featured: boolean;
    viewCount: number;
    metaTitle: string;
    metaDescription: string;
    publishedAt: number;
    updatedAt: number;
  };
}

export interface PrivateArticleMirrorV1 {
  version: 1;
  visibility: "private";
  article: Article;
}

/** The second store must be provisioned as Private in Vercel. */
export function privateArticleBlobOptions(): BlobStoreOptions {
  return {
    access: "private",
    token: process.env.ARTICLE_PRIVATE_BLOB_READ_WRITE_TOKEN ?? null,
  };
}

/**
 * A stable one-way folder keeps the public URL from advertising the local
 * database id. This is defense in depth; the payload itself is public-safe.
 */
export function publicArticleMirrorFolder(articleId: string): string {
  const opaqueId = createHash("sha256").update(`bow-public-article-v1\0${articleId}`).digest("hex");
  return `${PUBLIC_ARTICLE_MIRROR_PREFIX}${opaqueId}/`;
}

export function privateArticleMirrorPath(articleId: string): string {
  return `${PRIVATE_ARTICLE_MIRROR_PREFIX}${encodeURIComponent(articleId)}.json`;
}

export function articleToPrivateMirror(article: Article): PrivateArticleMirrorV1 {
  return { version: 1, visibility: "private", article };
}

export function articleToPublicMirror(article: Article): PublicArticleMirrorV1 | null {
  if (article.status !== "published" || article.publishedAt == null) return null;
  return {
    version: 1,
    visibility: "public",
    status: "published",
    article: {
      id: article.id,
      slug: article.slug,
      title: article.title,
      dek: article.dek,
      body: article.body,
      kind: article.kind,
      category: article.category,
      tags: article.tags,
      coverImage: article.coverImage,
      featured: article.featured,
      viewCount: article.viewCount,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
    },
  };
}

/** Immutable, opaque public artifacts avoid stale CDN overwrites. */
export function publicArticleMirrorPath(article: Article, payload: PublicArticleMirrorV1): string {
  const contentHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 20);
  return `${publicArticleMirrorFolder(article.id)}${article.updatedAt}-${contentHash}.json`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isArticle(value: unknown): value is Article {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" && value.id.length > 0 &&
    typeof value.slug === "string" && value.slug.length > 0 &&
    typeof value.title === "string" && value.title.length > 0 &&
    typeof value.dek === "string" &&
    typeof value.body === "string" &&
    (value.status === "draft" || value.status === "submitted" || value.status === "published") &&
    (value.kind === "article" || value.kind === "paper") &&
    typeof value.author === "string" &&
    (value.authorUserId === null || typeof value.authorUserId === "string") &&
    typeof value.category === "string" &&
    Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string") &&
    typeof value.coverImage === "string" &&
    typeof value.featured === "boolean" &&
    isFiniteNumber(value.viewCount) &&
    typeof value.metaTitle === "string" &&
    typeof value.metaDescription === "string" &&
    (value.publishedAt === null || isFiniteNumber(value.publishedAt)) &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt)
  );
}

function containsIdentityField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsIdentityField);
  if (!isRecord(value)) return false;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replaceAll("_", "").toLowerCase();
    if (normalized === "author" || normalized === "authoruserid" || normalized === "userid") return true;
    if (containsIdentityField(child)) return true;
  }
  return false;
}

function isPrivateArticleMirror(value: unknown): value is PrivateArticleMirrorV1 {
  return isRecord(value) && value.version === 1 && value.visibility === "private" && isArticle(value.article);
}

function isPublicArticleMirror(value: unknown): value is PublicArticleMirrorV1 {
  if (!isRecord(value) || value.version !== 1 || value.visibility !== "public" || value.status !== "published") return false;
  if (!isRecord(value.article) || containsIdentityField(value)) return false;
  const a = value.article;
  return (
    typeof a.id === "string" && a.id.length > 0 &&
    typeof a.slug === "string" && a.slug.length > 0 &&
    typeof a.title === "string" && a.title.length > 0 &&
    typeof a.dek === "string" &&
    typeof a.body === "string" &&
    (a.kind === "article" || a.kind === "paper") &&
    typeof a.category === "string" &&
    Array.isArray(a.tags) && a.tags.every((tag) => typeof tag === "string") &&
    typeof a.coverImage === "string" &&
    typeof a.featured === "boolean" &&
    isFiniteNumber(a.viewCount) &&
    typeof a.metaTitle === "string" &&
    typeof a.metaDescription === "string" &&
    isFiniteNumber(a.publishedAt) &&
    isFiniteNumber(a.updatedAt)
  );
}

function localUpdatedAt(db: any, articleId: string): number | null {
  const row = db.prepare("SELECT updated_at FROM articles WHERE id = ?").get(articleId) as { updated_at?: number } | undefined;
  return row ? Number(row.updated_at) || 0 : null;
}

function upsertPrivateArticle(db: any, article: Article): void {
  const local = localUpdatedAt(db, article.id);
  if (local !== null && local >= article.updatedAt) return;
  db.prepare(
    `INSERT INTO articles (id, slug, title, dek, body, status, kind, author, author_user_id, category, tags, cover_image, featured, view_count, meta_title, meta_description, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug=excluded.slug, title=excluded.title, dek=excluded.dek, body=excluded.body,
       status=excluded.status, kind=excluded.kind, author=excluded.author,
       author_user_id=excluded.author_user_id, category=excluded.category, tags=excluded.tags,
       cover_image=excluded.cover_image, featured=excluded.featured, view_count=excluded.view_count,
       meta_title=excluded.meta_title, meta_description=excluded.meta_description,
       published_at=excluded.published_at, created_at=excluded.created_at, updated_at=excluded.updated_at`,
  ).run(
    article.id, article.slug, article.title, article.dek, article.body, article.status,
    article.kind, article.author, article.authorUserId, article.category, article.tags.join(","),
    article.coverImage, article.featured ? 1 : 0, article.viewCount, article.metaTitle,
    article.metaDescription, article.publishedAt, article.createdAt, article.updatedAt,
  );
}

function upsertPublicArticle(db: any, mirror: PublicArticleMirrorV1): void {
  const a = mirror.article;
  const local = localUpdatedAt(db, a.id);
  if (local !== null && local >= a.updatedAt) return;
  db.prepare(
    `INSERT INTO articles (id, slug, title, dek, body, status, kind, author, author_user_id, category, tags, cover_image, featured, view_count, meta_title, meta_description, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'published', ?, 'BOW Front Office', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug=excluded.slug, title=excluded.title, dek=excluded.dek, body=excluded.body,
       status='published', kind=excluded.kind, category=excluded.category, tags=excluded.tags,
       cover_image=excluded.cover_image, featured=excluded.featured, view_count=excluded.view_count,
       meta_title=excluded.meta_title, meta_description=excluded.meta_description,
       published_at=excluded.published_at, updated_at=excluded.updated_at`,
  ).run(
    a.id, a.slug, a.title, a.dek, a.body, a.kind, a.category, a.tags.join(","),
    a.coverImage, a.featured ? 1 : 0, a.viewCount, a.metaTitle, a.metaDescription,
    a.publishedAt, a.publishedAt, a.updatedAt,
  );
}

async function purgeLegacyPublicArticleMirrors(): Promise<void> {
  const listing = await blobListDetailed("articles/");
  if (!listing.ok) {
    console.error("[articles] legacy public mirror cleanup could not list artifacts", {
      status: listing.status,
      error: listing.error,
    });
    return;
  }
  // The old implementation wrote full article rows at articles/<id>.json.
  const legacy = listing.entries.filter((entry) => /^articles\/[^/]+\.json$/.test(entry.pathname));
  if (legacy.length === 0) return;
  const deleted = await blobDelete(legacy.map((entry) => entry.url));
  if (!deleted.ok) {
    console.error("[articles] legacy public mirror cleanup failed", {
      count: legacy.length,
      status: deleted.status,
      error: deleted.error,
    });
  } else {
    console.info(`[articles] removed ${legacy.length} legacy public article mirror(s)`);
  }
}

/**
 * Rehydrate full-fidelity state from the private store first, then fill any
 * newer/missing published content from the anonymous public cache. Legacy
 * public full-row artifacts are deleted and never trusted for recovery.
 */
let rehydrated = false;
export async function rehydrateArticlesFromMirror(): Promise<void> {
  const privateOptions = privateArticleBlobOptions();
  const publicEnabled = blobMirrorEnabled();
  const privateEnabled = blobMirrorEnabled(privateOptions);
  if (rehydrated || (!publicEnabled && !privateEnabled)) {
    rehydrated = true;
    return;
  }
  rehydrated = true; // avoid retrying remote stores once per request after an outage

  const db = articlesDb();
  try {
    if (publicEnabled) await purgeLegacyPublicArticleMirrors();

    if (privateEnabled) {
      const privateListing = await blobListDetailed(PRIVATE_ARTICLE_MIRROR_PREFIX, privateOptions);
      if (!privateListing.ok) {
        console.error("[articles] private mirror rehydrate listing failed", {
          status: privateListing.status,
          error: privateListing.error,
        });
      } else {
        for (const entry of privateListing.entries) {
          const payload = await blobGetJson<unknown>(entry.url, privateOptions);
          if (!isPrivateArticleMirror(payload)) {
            console.warn(`[articles] ignored invalid private mirror payload at ${entry.pathname}`);
            continue;
          }
          upsertPrivateArticle(db, payload.article);
        }
      }
    }

    if (publicEnabled) {
      const publicListing = await blobListDetailed(PUBLIC_ARTICLE_MIRROR_PREFIX);
      if (!publicListing.ok) {
        console.error("[articles] public mirror rehydrate listing failed", {
          status: publicListing.status,
          error: publicListing.error,
        });
      } else {
        for (const entry of publicListing.entries) {
          const payload = await blobGetJson<unknown>(entry.url);
          if (!isPublicArticleMirror(payload)) {
            console.warn(`[articles] ignored invalid public mirror payload at ${entry.pathname}`);
            continue;
          }
          upsertPublicArticle(db, payload);
        }
      }
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
