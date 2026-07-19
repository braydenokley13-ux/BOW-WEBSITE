"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireRole, requireUser } from "@/lib/dal";
import { slugify } from "@/lib/slug";
import {
  ARTICLE_CATEGORIES,
  articleToPrivateMirror,
  articleToPublicMirror,
  articlesDb,
  countOpenSubmissions,
  parseTags,
  privateArticleBlobOptions,
  privateArticleMirrorPath,
  publicArticleMirrorFolder,
  publicArticleMirrorPath,
  rowToArticle,
} from "@/lib/articles";
import {
  blobDelete,
  blobListDetailed,
  blobMirrorEnabled,
  blobPutJson,
  type BlobOperationResult,
  type BlobStoreOptions,
} from "@/lib/blob-mirror";
import { consumeRateLimit } from "@/lib/rate-limit";
import { publicNameFor } from "@/lib/scoring";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** How many saves of history each article keeps. */
const MAX_REVISIONS = 25;

export interface ArticleInput {
  title: string;
  dek: string;
  body: string;
  author: string;
  category: string;
  /** Comma-separated. */
  tags: string;
  coverImage: string;
  metaTitle: string;
  metaDescription: string;
}

export interface SaveArticleResult {
  ok: boolean;
  id?: string;
  slug?: string;
  error?: string;
  /** The SQLite write succeeded, but remote redundancy needs attention. */
  warning?: string;
}

/**
 * Full rows (including drafts and account identity) go only to a separately
 * provisioned PRIVATE store. The public store receives an anonymous,
 * published-only payload at an opaque, versioned path.
 */
interface MirrorOutcome {
  ok: boolean;
  warning?: string;
}

interface ArticleActionResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

let warnedMissingPrivateStore = false;

function operationWarning(label: string, result: BlobOperationResult): string | null {
  if (result.ok) return null;
  return `${label}${result.status ? ` (${result.status})` : ""}`;
}

function reportMirrorIssues(articleId: string, operation: string, issues: string[]): MirrorOutcome {
  if (issues.length === 0) return { ok: true };
  const warning = `Article mirror needs attention: ${issues.join("; ")}.`;
  console.error("[articles] mirror operation needs attention", { articleId, operation, issues });
  return { ok: false, warning };
}

function mirrorIssueText(outcome: MirrorOutcome): string | null {
  return outcome.warning?.replace(/^Article mirror needs attention: /, "").replace(/\.$/, "") ?? null;
}

async function listedUrls(
  prefix: string,
  options?: BlobStoreOptions,
  exactPath?: string,
): Promise<{ urls: string[]; issue?: string; skipped: boolean }> {
  const listing = await blobListDetailed(prefix, options);
  if (!listing.ok) {
    return {
      urls: [],
      issue: `could not list ${options?.access === "private" ? "private" : "public"} article artifacts`,
      skipped: false,
    };
  }
  return {
    urls: listing.entries
      .filter((entry) => !exactPath || entry.pathname === exactPath)
      .map((entry) => entry.url),
    skipped: listing.skipped,
  };
}

async function unmirrorPublicArticle(id: string, keepPath?: string): Promise<MirrorOutcome> {
  const folder = publicArticleMirrorFolder(id);
  const legacyPath = `articles/${id}.json`;
  const issues: string[] = [];
  const current = await listedUrls(folder);
  const legacy = await listedUrls(legacyPath, undefined, legacyPath);
  if (current.issue) issues.push(current.issue);
  if (legacy.issue) issues.push(legacy.issue);
  if (process.env.NODE_ENV === "production" && current.skipped && legacy.skipped) {
    issues.push("the public article store is not configured, so artifact removal cannot be verified");
  }

  const urls = [...current.urls.filter((url) => !keepPath || !url.endsWith(`/${keepPath}`)), ...legacy.urls];
  const removed = await blobDelete(urls);
  const deleteIssue = operationWarning("could not remove public article artifacts", removed);
  if (deleteIssue) issues.push(deleteIssue);
  return reportMirrorIssues(id, keepPath ? "prune-public" : "remove-public", issues);
}

async function unmirrorPrivateArticle(id: string): Promise<MirrorOutcome> {
  const options = privateArticleBlobOptions();
  const path = privateArticleMirrorPath(id);
  const listed = await listedUrls(path, options, path);
  const issues = listed.issue ? [listed.issue] : [];
  if (process.env.NODE_ENV === "production" && listed.skipped) {
    issues.push("the private article store is not configured, so backup removal cannot be verified");
  }
  const removed = await blobDelete(listed.urls, options);
  const deleteIssue = operationWarning("could not remove private article backup", removed);
  if (deleteIssue) issues.push(deleteIssue);
  return reportMirrorIssues(id, "remove-private", issues);
}

async function mirrorArticle(id: string): Promise<MirrorOutcome> {
  const row = articlesDb().prepare("SELECT * FROM articles WHERE id = ?").get(id);
  if (!row) return { ok: false, warning: "The article no longer exists locally." };
  const article = rowToArticle(row);
  const issues: string[] = [];

  const privateOptions = privateArticleBlobOptions();
  if (blobMirrorEnabled(privateOptions)) {
    const privateWrite = await blobPutJson(
      privateArticleMirrorPath(id),
      articleToPrivateMirror(article),
      privateOptions,
    );
    const issue = operationWarning("the private article backup failed", privateWrite);
    if (issue) issues.push(issue);
  } else if (process.env.NODE_ENV === "production") {
    issues.push("the private article backup is not configured");
    if (!warnedMissingPrivateStore) {
      warnedMissingPrivateStore = true;
      console.warn("[articles] ARTICLE_PRIVATE_BLOB_READ_WRITE_TOKEN is not configured; unpublished work is SQLite-only");
    }
  }

  const publicPayload = articleToPublicMirror(article);
  if (publicPayload) {
    const publicPath = publicArticleMirrorPath(article, publicPayload);
    const publicWrite = await blobPutJson(publicPath, publicPayload);
    const issue = operationWarning("the public publication mirror failed", publicWrite);
    if (issue) issues.push(issue);
    if (publicWrite.ok) {
      const cleanup = await unmirrorPublicArticle(id, publicPath);
      const cleanupIssue = mirrorIssueText(cleanup);
      if (!cleanup.ok && cleanupIssue) issues.push(cleanupIssue);
    }
  } else {
    const cleanup = await unmirrorPublicArticle(id);
    const cleanupIssue = mirrorIssueText(cleanup);
    if (!cleanup.ok && cleanupIssue) issues.push(cleanupIssue);
  }

  return reportMirrorIssues(id, "mirror", issues);
}

async function unmirrorArticle(id: string): Promise<MirrorOutcome> {
  const [publicResult, privateResult] = await Promise.all([
    unmirrorPublicArticle(id),
    unmirrorPrivateArticle(id),
  ]);
  const issues = [publicResult.warning, privateResult.warning]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/^Article mirror needs attention: /, "").replace(/\.$/, ""));
  return reportMirrorIssues(id, "remove-all", issues);
}

function refresh(slug?: string) {
  revalidatePath("/analytics");
  revalidatePath("/analytics/articles");
  revalidatePath("/analytics/admin");
  if (slug) revalidatePath(`/analytics/articles/${slug}`);
  revalidatePath("/sitemap.xml");
}

function normCategory(c: string): string {
  return (ARTICLE_CATEGORIES as readonly string[]).includes(c) ? c : ARTICLE_CATEGORIES[0];
}

function cleanInput(input: ArticleInput) {
  return {
    title: (input.title ?? "").trim(),
    dek: (input.dek ?? "").trim(),
    body: input.body ?? "",
    author: (input.author ?? "").trim() || "BOW Front Office",
    category: normCategory((input.category ?? "").trim()),
    tags: parseTags(input.tags ?? "").join(","),
    coverImage: (input.coverImage ?? "").trim(),
    metaTitle: (input.metaTitle ?? "").trim(),
    metaDescription: (input.metaDescription ?? "").trim(),
  };
}

/** Slug from the title, de-duplicated against every other article. */
function uniqueSlug(db: any, title: string, excludeId: string | null): string {
  const base = slugify(title) || "untitled";
  let candidate = base;
  let n = 2;
  const clash = db.prepare("SELECT id FROM articles WHERE slug = ? AND id != ?");
  while (clash.get(candidate, excludeId ?? "")) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

/** Snapshot the article's current state into the revision log. */
function snapshotRevision(db: any, articleId: string) {
  const row = db.prepare("SELECT title, dek, body, category, tags FROM articles WHERE id = ?").get(articleId) as any;
  if (!row) return;
  db.prepare(
    "INSERT INTO article_revisions (article_id, title, dek, body, category, tags, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(articleId, row.title, row.dek, row.body, row.category, row.tags, Date.now());
  // Trim history beyond the cap.
  db.prepare(
    `DELETE FROM article_revisions WHERE article_id = ? AND id NOT IN (
       SELECT id FROM article_revisions WHERE article_id = ? ORDER BY saved_at DESC, id DESC LIMIT ?
     )`,
  ).run(articleId, articleId, MAX_REVISIONS);
}

/**
 * Create (id null) or update an article. Every save of an existing
 * article snapshots the PREVIOUS state first, so no edit can lose work.
 * The slug is minted on create and then kept stable across edits
 * (published URLs never break); drafts follow their title until first
 * publish.
 */
export async function saveArticle(id: string | null, input: ArticleInput): Promise<SaveArticleResult> {
  await requireRole("admin");
  const v = cleanInput(input);
  if (!v.title) return { ok: false, error: "A title is required." };

  const db = articlesDb();
  const now = Date.now();

  if (id) {
    const existing = db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as any;
    if (!existing) return { ok: false, error: "Article not found." };
    snapshotRevision(db, id);
    // Drafts track their title; published slugs are frozen.
    const slug = existing.status === "published" ? existing.slug : uniqueSlug(db, v.title, id);
    db.prepare(
      `UPDATE articles SET slug=?, title=?, dek=?, body=?, author=?, category=?, tags=?, cover_image=?, meta_title=?, meta_description=?, updated_at=? WHERE id=?`,
    ).run(slug, v.title, v.dek, v.body, v.author, v.category, v.tags, v.coverImage, v.metaTitle, v.metaDescription, now, id);
    const mirror = await mirrorArticle(id);
    refresh(slug);
    return { ok: true, id, slug, warning: mirror.warning };
  }

  const newId = `art-${randomUUID().slice(0, 8)}`;
  const slug = uniqueSlug(db, v.title, null);
  db.prepare(
    `INSERT INTO articles (id, slug, title, dek, body, status, author, category, tags, cover_image, featured, view_count, meta_title, meta_description, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, 0, 0, ?, ?, NULL, ?, ?)`,
  ).run(newId, slug, v.title, v.dek, v.body, v.author, v.category, v.tags, v.coverImage, v.metaTitle, v.metaDescription, now, now);
  const mirror = await mirrorArticle(newId);
  refresh(slug);
  return { ok: true, id: newId, slug, warning: mirror.warning };
}

/** What the notebook workbench sends when a reader submits their compiled draft. */
export interface PaperInput {
  title: string;
  /** The abstract — becomes the paper's dek. */
  abstract: string;
  /** Compiled notebook markdown (case / counter-case / open / assumptions disclosure). */
  body: string;
}

/** A reader can only have this many papers sitting in review at once. */
const MAX_OPEN_SUBMISSIONS = 3;

/**
 * Submit a research paper from the notebook workbench. Any signed-in
 * account can submit; nothing goes public without an admin publishing
 * it from the review queue — students submit, the desk decides.
 */
export async function submitPaper(input: PaperInput): Promise<SaveArticleResult> {
  const me = await requireUser();
  const title = (input.title ?? "").trim();
  const abstract = (input.abstract ?? "").trim();
  const body = (input.body ?? "").trim();
  if (!title) return { ok: false, error: "A title is required." };
  if (!abstract) return { ok: false, error: "Write a short abstract — what does the paper claim?" };
  if (body.length < 200) return { ok: false, error: "The paper needs a compiled draft — clip evidence and compile it first." };
  if (title.length > 200 || abstract.length > 2000 || body.length > 100_000) {
    return { ok: false, error: "The paper exceeds the editorial submission limits." };
  }
  const submissionLimit = consumeRateLimit("article-submission-user", me.id, {
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
    blockMs: 24 * 60 * 60 * 1000,
  });
  if (!submissionLimit.allowed) return { ok: false, error: "You have submitted too many papers today. Wait for the desk to review them." };
  if (countOpenSubmissions(me.id) >= MAX_OPEN_SUBMISSIONS) {
    return { ok: false, error: "You already have papers in review — wait for the desk before submitting more." };
  }

  const db = articlesDb();
  const now = Date.now();
  const newId = `art-${randomUUID().slice(0, 8)}`;
  const slug = uniqueSlug(db, title, null);
  db.prepare(
    `INSERT INTO articles (id, slug, title, dek, body, status, kind, author, author_user_id, category, tags, cover_image, featured, view_count, meta_title, meta_description, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'submitted', 'paper', ?, ?, 'Research Papers', 'paper', '', 0, 0, '', '', NULL, ?, ?)`,
  // Keep the account id private for editorial ownership while defaulting the
  // potentially public byline to the same privacy-safe form used elsewhere.
  ).run(newId, slug, title, abstract, body, publicNameFor(me.name, me.first), me.id, now, now);
  const mirror = await mirrorArticle(newId);
  refresh(slug);
  return { ok: true, id: newId, slug, warning: mirror.warning };
}

export async function setArticleStatus(id: string, publish: boolean): Promise<ArticleActionResult> {
  await requireRole("admin");
  const db = articlesDb();
  const existing = db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as any;
  if (!existing) return { ok: false };
  if (publish) {
    // First publish stamps the byline date; re-publishing keeps it.
    db.prepare("UPDATE articles SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?").run(
      Date.now(),
      Date.now(),
      id,
    );
  } else {
    // Delete the public artifact first. If Blob is down, leave the local row
    // published so no supposedly private draft remains available publicly.
    const cleanup = await unmirrorPublicArticle(id);
    if (!cleanup.ok) {
      return {
        ok: false,
        error: "Could not safely unpublish because the public artifact could not be removed. The article remains published.",
        warning: cleanup.warning,
      };
    }
    const updatedAt = Date.now();
    const privateOptions = privateArticleBlobOptions();
    if (blobMirrorEnabled(privateOptions)) {
      // Write the intended private state before changing SQLite. A failed
      // private write leaves the local article published (but no longer in
      // the public mirror) instead of letting stale backup state republish it
      // after a cold start.
      const intended = { ...rowToArticle(existing), status: "draft" as const, updatedAt };
      const privateWrite = await blobPutJson(
        privateArticleMirrorPath(id),
        articleToPrivateMirror(intended),
        privateOptions,
      );
      if (!privateWrite.ok) {
        return {
          ok: false,
          error: "The public artifact was removed, but the private backup could not be updated. The local article remains published so the operation can be retried safely.",
          warning: operationWarning("the private article backup failed", privateWrite) ?? undefined,
        };
      }
    }
    db.prepare("UPDATE articles SET status = 'draft', updated_at = ? WHERE id = ?").run(updatedAt, id);
  }
  const mirror = await mirrorArticle(id);
  refresh(existing.slug);
  return { ok: true, warning: mirror.warning };
}

export async function setArticleFeatured(id: string, featured: boolean): Promise<ArticleActionResult> {
  await requireRole("admin");
  const db = articlesDb();
  const existing = db.prepare("SELECT slug FROM articles WHERE id = ?").get(id) as any;
  if (!existing) return { ok: false };
  db.prepare("UPDATE articles SET featured = ?, updated_at = ? WHERE id = ?").run(featured ? 1 : 0, Date.now(), id);
  const mirror = await mirrorArticle(id);
  refresh(existing.slug);
  return { ok: true, warning: mirror.warning };
}

export async function deleteArticle(id: string): Promise<ArticleActionResult> {
  await requireRole("admin");
  const db = articlesDb();
  const existing = db.prepare("SELECT slug FROM articles WHERE id = ?").get(id) as any;
  if (!existing) return { ok: false };
  // Remote deletion comes first so a removed local row cannot be resurrected
  // from a stale private backup or remain available as a public artifact.
  const mirror = await unmirrorArticle(id);
  if (!mirror.ok) {
    return {
      ok: false,
      error: "Could not remove every durable article artifact. The local article was kept so the deletion can be retried safely.",
      warning: mirror.warning,
    };
  }
  db.prepare("DELETE FROM article_revisions WHERE article_id = ?").run(id);
  db.prepare("DELETE FROM articles WHERE id = ?").run(id);
  refresh(existing.slug);
  return { ok: true };
}

/**
 * Roll an article back to a saved revision. The current state is
 * snapshotted first, so a restore is itself undoable.
 */
export async function restoreRevision(articleId: string, revisionId: number): Promise<ArticleActionResult> {
  await requireRole("admin");
  const db = articlesDb();
  const rev = db.prepare("SELECT * FROM article_revisions WHERE id = ? AND article_id = ?").get(revisionId, articleId) as any;
  const existing = db.prepare("SELECT slug, status FROM articles WHERE id = ?").get(articleId) as any;
  if (!rev || !existing) return { ok: false };
  snapshotRevision(db, articleId);
  const slug = existing.status === "published" ? existing.slug : uniqueSlug(db, rev.title, articleId);
  db.prepare("UPDATE articles SET slug=?, title=?, dek=?, body=?, category=?, tags=?, updated_at=? WHERE id=?").run(
    slug,
    rev.title,
    rev.dek,
    rev.body,
    rev.category,
    rev.tags,
    Date.now(),
    articleId,
  );
  const mirror = await mirrorArticle(articleId);
  refresh(slug);
  return { ok: true, warning: mirror.warning };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
