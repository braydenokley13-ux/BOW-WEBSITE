"use server";

/* ============================================================
 * Discussion board server actions (Feature 3).
 *
 * Create posts, reply, react (toggle), delete an own reply-free post,
 * and pin (instructor/admin). Every action validates the session via
 * requireUser()/requireRole() BEFORE any DB access, then revalidates
 * the discussion routes.
 * ============================================================ */

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireDiscussionMember } from "@/lib/dal";
import { createNotification } from "@/lib/notifications";
import { isDiscussionChannel, isReactionType } from "@/lib/account";
import { consumeRateLimit } from "@/lib/rate-limit";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Create a new discussion post in a channel. */
export async function createPost(
  channel: string,
  title: string,
  body: string,
): Promise<{ ok: boolean; postId?: string; error?: string }> {
  const me = await requireDiscussionMember();
  if (!["student", "instructor", "admin"].includes(me.role)) return { ok: false, error: "Your role cannot create community posts." };

  if (!isDiscussionChannel(channel)) return { ok: false, error: "Unknown channel." };
  const t = title.trim();
  const b = body.trim();
  if (!t || !b) return { ok: false, error: "A title and body are required." };
  if (t.length > 160) return { ok: false, error: "Keep the discussion title under 160 characters." };
  if (b.length > 5000) return { ok: false, error: "Keep the discussion post under 5,000 characters." };
  const postLimit = (await consumeRateLimit("discussion-post-user", me.id, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }));
  if (!postLimit.allowed) return { ok: false, error: "You have posted too often. Wait before starting another discussion." };

  const id = `dp-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  (await getDb()
        .prepare(
          "INSERT INTO discussion_posts (id, user_id, org_id, channel, title, body, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)",
        )
        .run(id, me.id, me.orgId, channel, t, b, now, now));

  revalidatePath("/discussion");
  return { ok: true, postId: id };
}

/** Add a reply to a post; notifies the post author when someone else replies. */
export async function addReply(postId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireDiscussionMember();

  const b = body.trim();
  if (!b) return { ok: false, error: "A reply can't be empty." };
  if (b.length > 3000) return { ok: false, error: "Keep the reply under 3,000 characters." };
  const replyLimit = (await consumeRateLimit("discussion-reply-user", me.id, {
      limit: 40,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }));
  if (!replyLimit.allowed) return { ok: false, error: "You have replied too often. Wait before adding another reply." };

  const id = `dr-${randomUUID().slice(0, 12)}`;
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const post = (await db
          .prepare(
            `SELECT p.id, p.user_id
           FROM discussion_posts p JOIN users u ON u.id = p.user_id
          WHERE p.id = ? AND p.org_id = ? AND u.status = 'active'`,
          )
          .get(postId, me.orgId)) as any;
    if (!post) throw new Error("post_missing");

    (await db.prepare("INSERT INTO discussion_replies (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
            .run(id, postId, me.id, b, Date.now()));

    // Keep the reply and its notification in one durable operation.
    if (post.user_id !== me.id) {
      (await createNotification({
                userId: post.user_id,
                type: "discussion_reply",
                title: `${me.first} replied to your post.`,
                body: b.length > 60 ? `${b.slice(0, 60)}…` : b,
                link: `/discussion/${postId}`,
              }));
    }
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the reply failure.
    }
    if (error instanceof Error && error.message === "post_missing") {
      return { ok: false, error: "That post no longer exists in your organization." };
    }
    return { ok: false, error: "The reply could not be saved. Try again." };
  }

  revalidatePath("/discussion");
  return { ok: true };
}

/** Toggle a reaction on a post for the current user (one per user/post/type). */
export async function toggleReaction(
  postId: string,
  reactionType: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireDiscussionMember();

  if (!isReactionType(reactionType)) return { ok: false, error: "Unknown reaction." };
  const reactionLimit = (await consumeRateLimit("discussion-reaction-user", me.id, {
      limit: 300,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }));
  if (!reactionLimit.allowed) return { ok: false, error: "Too many reactions. Wait and try again." };

  const db = getDb();
  const post = (await db.prepare(
      `SELECT p.id
       FROM discussion_posts p JOIN users u ON u.id = p.user_id
      WHERE p.id = ? AND p.org_id = ? AND u.status = 'active'`,
    ).get(postId, me.orgId));
  if (!post) return { ok: false, error: "That post is no longer available in your organization." };
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const livePost = (await db.prepare("SELECT id FROM discussion_posts WHERE id = ? AND org_id = ?").get(postId, me.orgId));
    if (!livePost) throw new Error("post_unavailable");
    const existing = (await db
          .prepare(
            "SELECT id FROM discussion_reactions WHERE post_id = ? AND user_id = ? AND reaction_type = ? ORDER BY created_at LIMIT 1",
          )
          .get(postId, me.id, reactionType)) as any;

    if (existing) {
      // Delete every legacy duplicate as well as the canonical row so one
      // toggle always produces one deterministic off-state.
      (await db.prepare("DELETE FROM discussion_reactions WHERE post_id = ? AND user_id = ? AND reaction_type = ?")
                .run(postId, me.id, reactionType));
    } else {
      const id = `dx-${randomUUID().slice(0, 12)}`;
      (await db.prepare(
                "INSERT INTO discussion_reactions (id, post_id, user_id, reaction_type, created_at) VALUES (?, ?, ?, ?, ?)",
              ).run(id, postId, me.id, reactionType, Date.now()));
    }
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the scoped mutation failure.
    }
    if (error instanceof Error && error.message === "post_unavailable") {
      return { ok: false, error: "That post is no longer available in your organization." };
    }
    return { ok: false, error: "The reaction could not be saved. Try again." };
  }

  revalidatePath("/discussion");
  return { ok: true };
}

/** Delete the viewer's own post, only when it has no replies. */
export async function deletePost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireDiscussionMember();

  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const post = (await db
          .prepare("SELECT id, user_id FROM discussion_posts WHERE id = ? AND org_id = ?")
          .get(postId, me.orgId)) as any;
    if (!post) throw new Error("post_missing");
    if (post.user_id !== me.id) throw new Error("not_owner");

    const replies = (await db
          .prepare("SELECT COUNT(*) AS n FROM discussion_replies WHERE post_id = ?")
          .get(postId)) as any;
    if ((Number(replies?.n) || 0) > 0) throw new Error("has_replies");

    (await db.prepare("DELETE FROM discussion_reactions WHERE post_id = ?").run(postId));
    const removed = (await db.prepare("DELETE FROM discussion_posts WHERE id = ? AND org_id = ? AND user_id = ?")
          .run(postId, me.orgId, me.id));
    if (removed.changes !== 1) throw new Error("post_missing");
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the scoped deletion failure.
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "not_owner") return { ok: false, error: "You can only delete your own posts." };
    if (code === "has_replies") return { ok: false, error: "Posts with replies can't be deleted." };
    if (code === "post_missing") return { ok: false, error: "That post no longer exists in your organization." };
    return { ok: false, error: "The post could not be deleted. Try again." };
  }

  revalidatePath("/discussion");
  return { ok: true };
}

/** Flip a post's pinned flag (instructor/admin only). */
export async function togglePin(postId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireDiscussionMember();
  if (me.role !== "instructor" && me.role !== "admin") return { ok: false, error: "Only instructors and administrators can pin posts." };

  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const post = (await db
          .prepare(
            `SELECT p.id, p.pinned
           FROM discussion_posts p JOIN users u ON u.id = p.user_id
          WHERE p.id = ? AND p.org_id = ? AND u.status = 'active'`,
          )
          .get(postId, me.orgId)) as any;
    if (!post) throw new Error("post_missing");

    const next = post.pinned ? 0 : 1;
    const updated = (await db.prepare("UPDATE discussion_posts SET pinned = ?, updated_at = ? WHERE id = ? AND org_id = ? AND pinned = ?").run(
          next,
          Date.now(),
          postId,
          me.orgId,
          post.pinned ? 1 : 0,
        ));
    if (updated.changes !== 1) throw new Error("post_changed");
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the scoped pin failure.
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "post_missing") return { ok: false, error: "That post no longer exists in your organization." };
    if (code === "post_changed") return { ok: false, error: "That post changed while its pin was being updated. Try again." };
    return { ok: false, error: "The pin could not be updated. Try again." };
  }

  revalidatePath("/discussion");
  return { ok: true };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
