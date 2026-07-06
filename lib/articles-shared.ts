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
  "Research Papers",
] as const;

/**
 * "submitted" is the review queue: a reader compiled their notebook into
 * a paper and sent it in. Only an admin can move it to "published" —
 * students submit, the desk decides.
 */
export type ArticleStatus = "draft" | "submitted" | "published";

/** House-written article vs. a reader-authored research paper. */
export type ArticleKind = "article" | "paper";

export interface Article {
  id: string;
  slug: string;
  title: string;
  /** For kind "paper" this is the abstract. */
  dek: string;
  body: string;
  status: ArticleStatus;
  kind: ArticleKind;
  author: string;
  /** Account id of the submitting reader (papers only), for the profile byline. */
  authorUserId: string | null;
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
