/* ============================================================
 * Publication types & constants shared by server and client.
 *
 * No database imports here — client components (the editor, the admin
 * list) need these shapes without dragging node:sqlite into the
 * browser bundle. Server reads live in lib/articles.
 * ============================================================ */

export const ARTICLE_CATEGORIES = [
  "Trade Analysis",
  "Contract Deep Dives",
  "Draft Economics",
  "Cap Strategy",
  "Model Notes",
] as const;

export type ArticleStatus = "draft" | "published";

export interface Article {
  id: string;
  slug: string;
  title: string;
  dek: string;
  body: string;
  status: ArticleStatus;
  author: string;
  category: string;
  tags: string[];
  coverImage: string;
  featured: boolean;
  viewCount: number;
  metaTitle: string;
  metaDescription: string;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ArticleRevision {
  id: number;
  articleId: string;
  title: string;
  dek: string;
  body: string;
  category: string;
  tags: string;
  savedAt: number;
}

export function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}
