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

async function discussionViewer(viewerId: string): Promise<{ org_id: string } | undefined> {
  return (await getDb().prepare(
      `SELECT u.org_id
       FROM users u
       JOIN organizations o ON o.id = u.org_id
      WHERE u.id = ? AND u.status = 'active' AND o.status = 'active'
        AND (
          u.role != 'student'
          OR (
            EXISTS (
              SELECT 1 FROM invitations i
               WHERE i.status = 'accepted' AND i.role = 'student'
                 AND i.org_id = u.org_id
                 AND lower(trim(i.email)) = lower(trim(u.email))
            )
            AND EXISTS (
              SELECT 1 FROM enrollments e
               WHERE e.user_id = u.id AND e.enroll = 'active'
            )
          )
        )
        AND (
          u.role != 'instructor'
          OR EXISTS (
            SELECT 1
              FROM people pe
              JOIN instructors i ON i.person_id = pe.id
             WHERE pe.user_id = u.id
               AND i.stage = 'active'
               AND i.eligibility_status = 'eligible'
          )
        )`,
    ).get(viewerId)) as { org_id: string } | undefined;
}

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
async function authorMeta(userId: string): Promise<{ name: string; rank: AuthorRank }> {
  const u = (await getDb().prepare("SELECT name, first FROM users WHERE id = ? AND status = 'active'").get(userId)) as any;
  const name = u ? publicNameFor(u.name, u.first) : "Student";
  const r = (await rankForStudent(userId));
  return { name, rank: { key: r.key, name: r.name } };
}

/** Reply count for a single post. */
async function replyCountFor(postId: string, orgId: string): Promise<number> {
  const row = (await getDb()
      .prepare(
        `SELECT COUNT(*) AS n
         FROM discussion_replies r
         JOIN users u ON u.id = r.user_id
        JOIN discussion_posts p ON p.id = r.post_id
        WHERE r.post_id = ? AND p.org_id = ? AND u.status = 'active'`,
      )
      .get(postId, orgId)) as any;
  return Number(row?.n) || 0;
}

/** Reaction tallies for a single post. */
async function reactionCountsFor(postId: string, orgId: string): Promise<ReactionCounts> {
  const counts: ReactionCounts = { fire: 0, agree: 0, big_brain: 0 };
  const rows = (await getDb()
      .prepare(
        `SELECT r.reaction_type AS type, COUNT(*) AS n
         FROM discussion_reactions r
         JOIN users u ON u.id = r.user_id
        JOIN discussion_posts p ON p.id = r.post_id
        WHERE r.post_id = ? AND p.org_id = ? AND u.status = 'active'
        GROUP BY r.reaction_type`,
      )
      .all(postId, orgId)) as any[];
  for (const r of rows) {
    if (r.type === "fire" || r.type === "agree" || r.type === "big_brain") {
      counts[r.type as keyof ReactionCounts] = Number(r.n) || 0;
    }
  }
  return counts;
}

/** Reaction types a viewer has added to a post. */
async function viewerReactionsFor(postId: string, viewerId: string): Promise<ReactionType[]> {
  const rows = (await getDb()
      .prepare("SELECT reaction_type AS type FROM discussion_reactions WHERE post_id = ? AND user_id = ?")
      .all(postId, viewerId)) as any[];
  const order = REACTION_TYPES.map((r) => r.key);
  return rows
    .map((r) => r.type as ReactionType)
    .filter((t): t is ReactionType => order.includes(t));
}

/**
 * One page of posts in a channel. Pinned posts come first, then newest first
 * (pinned DESC, created_at DESC). `page` is 1-based and clamped to range.
 */
export async function getChannelPosts(
  channel: DiscussionChannel,
  page = 1,
  perPage = 10,
  viewerId: string,
): Promise<ChannelPage> {
  const db = getDb();
  const viewer = (await discussionViewer(viewerId));
  if (!viewer) return { posts: [], total: 0, page: 1, totalPages: 1 };
  const totalRow = (await db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM discussion_posts p JOIN users u ON u.id = p.user_id
        WHERE p.channel = ? AND p.org_id = ? AND u.status = 'active'`,
      )
      .get(channel, viewer.org_id)) as any;
  const total = Number(totalRow?.n) || 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const offset = (safePage - 1) * perPage;

  const rows = (await db
      .prepare(
        `SELECT p.id, p.user_id, p.channel, p.title, p.body, p.pinned, p.created_at
       FROM discussion_posts p JOIN users u ON u.id = p.user_id
       WHERE p.channel = ? AND p.org_id = ? AND u.status = 'active'
       ORDER BY p.pinned DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      )
      .all(channel, viewer.org_id, perPage, offset)) as any[];

  const posts: PostSummary[] = (await Promise.all(rows.map(async (r) => {
      const meta = (await authorMeta(r.user_id));
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
        replyCount: (await replyCountFor(r.id, viewer.org_id)),
        reactions: (await reactionCountsFor(r.id, viewer.org_id)),
        viewerReactions: (await viewerReactionsFor(r.id, viewerId)),
      };
    })));

  return { posts, total, page: safePage, totalPages };
}

/** A single post with its replies and reactions, or null if it doesn't exist. */
export async function getPostDetail(postId: string, viewerId: string): Promise<PostDetail | null> {
  const db = getDb();
  const viewer = (await discussionViewer(viewerId));
  if (!viewer) return null;
  const p = (await db
      .prepare(
        `SELECT p.id, p.user_id, p.channel, p.title, p.body, p.pinned, p.created_at
         FROM discussion_posts p JOIN users u ON u.id = p.user_id
        WHERE p.id = ? AND p.org_id = ? AND u.status = 'active'`,
      )
      .get(postId, viewer.org_id)) as any;
  if (!p) return null;

  const meta = (await authorMeta(p.user_id));
  const replyRows = (await db
      .prepare(
        `SELECT r.id, r.user_id, r.body, r.created_at
         FROM discussion_replies r JOIN users u ON u.id = r.user_id
        WHERE r.post_id = ? AND u.status = 'active'
        ORDER BY r.created_at ASC`,
      )
      .all(postId)) as any[];

  const replies: ReplyView[] = (await Promise.all(replyRows.map(async (r) => {
      const rm = (await authorMeta(r.user_id));
      return {
        id: r.id,
        authorName: rm.name,
        authorRank: rm.rank,
        body: r.body,
        createdAt: Number(r.created_at) || 0,
        when: timeAgo(Number(r.created_at) || 0),
      };
    })));

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
    reactions: (await reactionCountsFor(postId, viewer.org_id)),
    viewerReactions: (await viewerReactionsFor(postId, viewerId)),
  };
}

/** Post counts per channel, for the tab badges. */
export async function getChannelCounts(viewerId: string): Promise<ChannelCounts> {
  const counts: ChannelCounts = { gm_decisions: 0, econ_wild: 0, track_talk: 0 };
  const db = getDb();
  const viewer = (await discussionViewer(viewerId));
  if (!viewer) return counts;
  const rows = (await db
      .prepare(
        `SELECT p.channel, COUNT(*) AS n
         FROM discussion_posts p JOIN users u ON u.id = p.user_id
        WHERE u.status = 'active' AND p.org_id = ?
        GROUP BY p.channel`,
      )
      .all(viewer.org_id)) as any[];
  for (const r of rows) {
    if (r.channel === "gm_decisions" || r.channel === "econ_wild" || r.channel === "track_talk") {
      counts[r.channel as keyof ChannelCounts] = Number(r.n) || 0;
    }
  }
  return counts;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
