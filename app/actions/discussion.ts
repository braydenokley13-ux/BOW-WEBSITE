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
import { requireUser, requireRole } from "@/lib/dal";
import { createNotification } from "@/lib/notifications";
import { isDiscussionChannel, isReactionType } from "@/lib/account";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Create a new discussion post in a channel. */
export async function createPost(
  channel: string,
  title: string,
  body: string,
): Promise<{ ok: boolean; postId?: string; error?: string }> {
  const me = await requireRole("student", "instructor", "admin");

  if (!isDiscussionChannel(channel)) return { ok: false, error: "Unknown channel." };
  const t = title.trim();
  const b = body.trim();
  if (!t || !b) return { ok: false, error: "A title and body are required." };

  const id = `dp-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO discussion_posts (id, user_id, channel, title, body, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
    )
    .run(id, me.id, channel, t, b, now, now);

  revalidatePath("/discussion");
  return { ok: true, postId: id };
}

/** Add a reply to a post; notifies the post author when someone else replies. */
export async function addReply(postId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireUser();

  const b = body.trim();
  if (!b) return { ok: false, error: "A reply can't be empty." };

  const post = getDb()
    .prepare("SELECT id, user_id FROM discussion_posts WHERE id = ?")
    .get(postId) as any;
  if (!post) return { ok: false, error: "That post no longer exists." };

  const id = `dr-${randomUUID().slice(0, 12)}`;
  getDb()
    .prepare("INSERT INTO discussion_replies (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, postId, me.id, b, Date.now());

  // Notify the post's author when a different user replies.
  if (post.user_id !== me.id) {
    createNotification({
      userId: post.user_id,
      type: "discussion_reply",
      title: `${me.first} replied to your post.`,
      body: b.length > 60 ? `${b.slice(0, 60)}…` : b,
      link: `/discussion/${postId}`,
    });
  }

  revalidatePath("/discussion");
  return { ok: true };
}

/** Toggle a reaction on a post for the current user (one per user/post/type). */
export async function toggleReaction(
  postId: string,
  reactionType: string,
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireUser();

  if (!isReactionType(reactionType)) return { ok: false, error: "Unknown reaction." };

  const db = getDb();
  const existing = db
    .prepare(
      "SELECT id FROM discussion_reactions WHERE post_id = ? AND user_id = ? AND reaction_type = ?",
    )
    .get(postId, me.id, reactionType) as any;

  if (existing) {
    db.prepare("DELETE FROM discussion_reactions WHERE id = ?").run(existing.id);
  } else {
    const id = `dx-${randomUUID().slice(0, 12)}`;
    db.prepare(
      "INSERT OR IGNORE INTO discussion_reactions (id, post_id, user_id, reaction_type, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(id, postId, me.id, reactionType, Date.now());
  }

  revalidatePath("/discussion");
  return { ok: true };
}

/** Delete the viewer's own post, only when it has no replies. */
export async function deletePost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await requireUser();

  const db = getDb();
  const post = db
    .prepare("SELECT id, user_id FROM discussion_posts WHERE id = ?")
    .get(postId) as any;
  if (!post) return { ok: false, error: "That post no longer exists." };
  if (post.user_id !== me.id) return { ok: false, error: "You can only delete your own posts." };

  const replies = db
    .prepare("SELECT COUNT(*) AS n FROM discussion_replies WHERE post_id = ?")
    .get(postId) as any;
  if ((Number(replies?.n) || 0) > 0) {
    return { ok: false, error: "Posts with replies can't be deleted." };
  }

  db.prepare("DELETE FROM discussion_reactions WHERE post_id = ?").run(postId);
  db.prepare("DELETE FROM discussion_posts WHERE id = ?").run(postId);

  revalidatePath("/discussion");
  return { ok: true };
}

/** Flip a post's pinned flag (instructor/admin only). */
export async function togglePin(postId: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole("instructor", "admin");

  const db = getDb();
  const post = db
    .prepare("SELECT id, pinned FROM discussion_posts WHERE id = ?")
    .get(postId) as any;
  if (!post) return { ok: false, error: "That post no longer exists." };

  const next = post.pinned ? 0 : 1;
  db.prepare("UPDATE discussion_posts SET pinned = ?, updated_at = ? WHERE id = ?").run(
    next,
    Date.now(),
    postId,
  );

  revalidatePath("/discussion");
  return { ok: true };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
