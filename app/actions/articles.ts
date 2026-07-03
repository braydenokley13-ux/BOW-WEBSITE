"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { slugify } from "@/lib/slug";
import { ARTICLE_CATEGORIES, parseTags } from "@/lib/articles";

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

  const db = getDb();
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
    refresh(slug);
    return { ok: true, id, slug };
  }

  const newId = `art-${randomUUID().slice(0, 8)}`;
  const slug = uniqueSlug(db, v.title, null);
  db.prepare(
    `INSERT INTO articles (id, slug, title, dek, body, status, author, category, tags, cover_image, featured, view_count, meta_title, meta_description, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, 0, 0, ?, ?, NULL, ?, ?)`,
  ).run(newId, slug, v.title, v.dek, v.body, v.author, v.category, v.tags, v.coverImage, v.metaTitle, v.metaDescription, now, now);
  refresh(slug);
  return { ok: true, id: newId, slug };
}

export async function setArticleStatus(id: string, publish: boolean): Promise<{ ok: boolean }> {
  await requireRole("admin");
  const db = getDb();
  const existing = db.prepare("SELECT slug, published_at FROM articles WHERE id = ?").get(id) as any;
  if (!existing) return { ok: false };
  if (publish) {
    // First publish stamps the byline date; re-publishing keeps it.
    db.prepare("UPDATE articles SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?").run(
      Date.now(),
      Date.now(),
      id,
    );
  } else {
    db.prepare("UPDATE articles SET status = 'draft', updated_at = ? WHERE id = ?").run(Date.now(), id);
  }
  refresh(existing.slug);
  return { ok: true };
}

export async function setArticleFeatured(id: string, featured: boolean): Promise<{ ok: boolean }> {
  await requireRole("admin");
  const db = getDb();
  const existing = db.prepare("SELECT slug FROM articles WHERE id = ?").get(id) as any;
  if (!existing) return { ok: false };
  db.prepare("UPDATE articles SET featured = ?, updated_at = ? WHERE id = ?").run(featured ? 1 : 0, Date.now(), id);
  refresh(existing.slug);
  return { ok: true };
}

export async function deleteArticle(id: string): Promise<{ ok: boolean }> {
  await requireRole("admin");
  const db = getDb();
  const existing = db.prepare("SELECT slug FROM articles WHERE id = ?").get(id) as any;
  if (!existing) return { ok: false };
  db.prepare("DELETE FROM article_revisions WHERE article_id = ?").run(id);
  db.prepare("DELETE FROM articles WHERE id = ?").run(id);
  refresh(existing.slug);
  return { ok: true };
}

/**
 * Roll an article back to a saved revision. The current state is
 * snapshotted first, so a restore is itself undoable.
 */
export async function restoreRevision(articleId: string, revisionId: number): Promise<{ ok: boolean }> {
  await requireRole("admin");
  const db = getDb();
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
  refresh(slug);
  return { ok: true };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
