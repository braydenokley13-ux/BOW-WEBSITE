/* ============================================================
 * Discussion board read layer (Feature 3).
 *
 * Serializable read functions for the three discussion channels:
 * channel post lists (paginated, pinned-first), a single post with
 * its replies + reactions, and per-channel post counts for the tabs.
 * All names are shown privacy-safe ("Jordan A.") and every author
 * carries their current BOW Rank.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { rankForStudent, publicNameFor } from "@/lib/scoring";
import {
  REACTION_TYPES,
  channelLabel,
  type DiscussionChannel,
  type ReactionType,
} from "@/lib/account";

/** A reaction tally for a post: count per reaction type. */
export interface ReactionCounts {
  fire: number;
  agree: number;
  big_brain: number;
}

/** The author's rank, reduced to what the chip needs. */
export interface AuthorRank {
  key: "rookie" | "scout" | "analyst" | "front-office";
  name: string;
}

/** A post as the channel list renders it (a card). */
export interface PostSummary {
  id: string;
  channel: DiscussionChannel;
  channelLabel: string;
  title: string;
  bodyExcerpt: string;
  authorName: string;
  authorRank: AuthorRank;
  pinned: boolean;
  createdAt: number;
  when: string;
  replyCount: number;
  reactions: ReactionCounts;
  /** Reaction types the viewer has added to this post. */
  viewerReactions: ReactionType[];
}

/** One paginated channel page. */
export interface ChannelPage {
  posts: PostSummary[];
  total: number;
  page: number;
  totalPages: number;
}

/** A single reply, chronological. */
export interface ReplyView {
  id: string;
  authorName: string;
  authorRank: AuthorRank;
  body: string;
  createdAt: number;
  when: string;
}

/** The full post detail view (post + replies + reactions). */
export interface PostDetail {
  id: string;
  channel: DiscussionChannel;
  channelLabel: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  authorRank: AuthorRank;
  pinned: boolean;
  createdAt: number;
  when: string;
  /** The viewer authored this post AND it has no replies, so it can be deleted. */
  canDelete: boolean;
  replies: ReplyView[];
  reactions: ReactionCounts;
  viewerReactions: ReactionType[];
}

/** Post counts per channel, for the tab badges. */
export interface ChannelCounts {
  gm_decisions: number;
  econ_wild: number;
  track_talk: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Relative "time ago" label from an epoch-ms timestamp. */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/** First `max` chars of a body, with an ellipsis when it was truncated. */
function excerpt(body: string, max = 120): string {
  const text = body.trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The author's privacy-safe name + current rank, for any user id. */
function authorMeta(userId: string): { name: string; rank: AuthorRank } {
  const u = getDb().prepare("SELECT name, first FROM users WHERE id = ?").get(userId) as any;
  const name = u ? publicNameFor(u.name, u.first) : "Student";
  const r = rankForStudent(userId);
  return { name, rank: { key: r.key, name: r.name } };
}

/** Reply count for a single post. */
function replyCountFor(postId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM discussion_replies WHERE post_id = ?")
    .get(postId) as any;
  return Number(row?.n) || 0;
}

/** Reaction tallies for a single post. */
function reactionCountsFor(postId: string): ReactionCounts {
  const counts: ReactionCounts = { fire: 0, agree: 0, big_brain: 0 };
  const rows = getDb()
    .prepare(
      "SELECT reaction_type AS type, COUNT(*) AS n FROM discussion_reactions WHERE post_id = ? GROUP BY reaction_type",
    )
    .all(postId) as any[];
  for (const r of rows) {
    if (r.type === "fire" || r.type === "agree" || r.type === "big_brain") {
      counts[r.type as keyof ReactionCounts] = Number(r.n) || 0;
    }
  }
  return counts;
}

/** Reaction types a viewer has added to a post. */
function viewerReactionsFor(postId: string, viewerId: string): ReactionType[] {
  const rows = getDb()
    .prepare("SELECT reaction_type AS type FROM discussion_reactions WHERE post_id = ? AND user_id = ?")
    .all(postId, viewerId) as any[];
  const order = REACTION_TYPES.map((r) => r.key);
  return rows
    .map((r) => r.type as ReactionType)
    .filter((t): t is ReactionType => order.includes(t));
}

/**
 * One page of posts in a channel. Pinned posts come first, then newest first
 * (pinned DESC, created_at DESC). `page` is 1-based and clamped to range.
 */
export function getChannelPosts(
  channel: DiscussionChannel,
  page = 1,
  perPage = 10,
  viewerId: string,
): ChannelPage {
  const db = getDb();
  const totalRow = db
    .prepare("SELECT COUNT(*) AS n FROM discussion_posts WHERE channel = ?")
    .get(channel) as any;
  const total = Number(totalRow?.n) || 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const offset = (safePage - 1) * perPage;

  const rows = db
    .prepare(
      `SELECT id, user_id, channel, title, body, pinned, created_at
       FROM discussion_posts
       WHERE channel = ?
       ORDER BY pinned DESC, created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(channel, perPage, offset) as any[];

  const posts: PostSummary[] = rows.map((r) => {
    const meta = authorMeta(r.user_id);
    return {
      id: r.id,
      channel: r.channel as DiscussionChannel,
      channelLabel: channelLabel(r.channel),
      title: r.title,
      bodyExcerpt: excerpt(r.body ?? ""),
      authorName: meta.name,
      authorRank: meta.rank,
      pinned: !!r.pinned,
      createdAt: Number(r.created_at) || 0,
      when: timeAgo(Number(r.created_at) || 0),
      replyCount: replyCountFor(r.id),
      reactions: reactionCountsFor(r.id),
      viewerReactions: viewerReactionsFor(r.id, viewerId),
    };
  });

  return { posts, total, page: safePage, totalPages };
}

/** A single post with its replies and reactions, or null if it doesn't exist. */
export function getPostDetail(postId: string, viewerId: string): PostDetail | null {
  const db = getDb();
  const p = db
    .prepare(
      "SELECT id, user_id, channel, title, body, pinned, created_at FROM discussion_posts WHERE id = ?",
    )
    .get(postId) as any;
  if (!p) return null;

  const meta = authorMeta(p.user_id);
  const replyRows = db
    .prepare(
      "SELECT id, user_id, body, created_at FROM discussion_replies WHERE post_id = ? ORDER BY created_at ASC",
    )
    .all(postId) as any[];

  const replies: ReplyView[] = replyRows.map((r) => {
    const rm = authorMeta(r.user_id);
    return {
      id: r.id,
      authorName: rm.name,
      authorRank: rm.rank,
      body: r.body,
      createdAt: Number(r.created_at) || 0,
      when: timeAgo(Number(r.created_at) || 0),
    };
  });

  return {
    id: p.id,
    channel: p.channel as DiscussionChannel,
    channelLabel: channelLabel(p.channel),
    title: p.title,
    body: p.body ?? "",
    authorId: p.user_id,
    authorName: meta.name,
    authorRank: meta.rank,
    pinned: !!p.pinned,
    createdAt: Number(p.created_at) || 0,
    when: timeAgo(Number(p.created_at) || 0),
    canDelete: viewerId === p.user_id && replies.length === 0,
    replies,
    reactions: reactionCountsFor(postId),
    viewerReactions: viewerReactionsFor(postId, viewerId),
  };
}

/** Post counts per channel, for the tab badges. */
export function getChannelCounts(): ChannelCounts {
  const counts: ChannelCounts = { gm_decisions: 0, econ_wild: 0, track_talk: 0 };
  const rows = getDb()
    .prepare("SELECT channel, COUNT(*) AS n FROM discussion_posts GROUP BY channel")
    .all() as any[];
  for (const r of rows) {
    if (r.channel === "gm_decisions" || r.channel === "econ_wild" || r.channel === "track_talk") {
      counts[r.channel as keyof ChannelCounts] = Number(r.n) || 0;
    }
  }
  return counts;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
