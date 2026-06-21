/* ============================================================
 * BOW Daily Feed (Proposal 3) — data layer + session.
 *
 * The Daily Feed is a standalone experience: a visitor needs no
 * cohort, instructor, or school. They sign up with just an email and
 * a display name, get a `feed_users` row, and carry an opaque session
 * token in an HttpOnly cookie — exactly the way lib/session.ts works
 * for regular users, but against the `feed_sessions` table so the two
 * audiences never collide.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { cookies } from "next/headers";
import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import {
  feedStories as feedStorySeed,
  type FeedStory,
  type FeedUser,
} from "@/lib/account";

export const FEED_SESSION_COOKIE = "bow_feed_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — low-stakes, no PII beyond a name

/* ---------------- mappers ---------------- */
/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToFeedUser(r: any): FeedUser {
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    createdAt: Number(r.created_at),
    decisionsCompleted: Number(r.decisions_completed) || 0,
    simCompleted: !!r.sim_completed,
    certificateId: r.certificate_id ?? null,
  };
}

function rowToFeedStory(r: any): FeedStory {
  return {
    id: r.id,
    ordinal: Number(r.ordinal),
    headline: r.headline,
    framing: r.framing,
    prompt: r.prompt,
    concept: r.concept,
    outcome: r.outcome,
    explanation: r.explanation,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ---------------- stories ---------------- */

/** The ordered Daily Feed stories (DB first, falling back to the seed). */
export function getFeedStories(): FeedStory[] {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const rows = getDb().prepare("SELECT * FROM feed_stories ORDER BY ordinal ASC").all() as any[];
  if (rows.length === 0) return [...feedStorySeed].sort((a, b) => a.ordinal - b.ordinal);
  return rows.map(rowToFeedStory);
}

/* ---------------- session ---------------- */

export async function createFeedSession(feedUserId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  getDb()
    .prepare("INSERT INTO feed_sessions (token, feed_user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, feedUserId, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(FEED_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroyFeedSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(FEED_SESSION_COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM feed_sessions WHERE token = ?").run(token);
  cookieStore.delete(FEED_SESSION_COOKIE);
}

/** Resolve the current feed visitor from the session cookie, or null. */
export async function getCurrentFeedUser(): Promise<FeedUser | null> {
  const token = (await cookies()).get(FEED_SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const row = db
    .prepare(
      "SELECT u.*, s.expires_at AS __exp FROM feed_sessions s JOIN feed_users u ON u.id = s.feed_user_id WHERE s.token = ?",
    )
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .get(token) as any;

  if (!row) return null;
  if (Number(row.__exp) < Date.now()) {
    db.prepare("DELETE FROM feed_sessions WHERE token = ?").run(token);
    return null;
  }
  return rowToFeedUser(row);
}

/* ---------------- mutations (called by server actions) ---------------- */

/** Create a minimal feed user (re-using an existing one for the same email). */
export function upsertFeedUser(email: string, displayName: string): FeedUser {
  const db = getDb();
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim().slice(0, 60);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const existing = db.prepare("SELECT * FROM feed_users WHERE email = ?").get(cleanEmail) as any;
  if (existing) {
    if (cleanName && cleanName !== existing.display_name) {
      db.prepare("UPDATE feed_users SET display_name = ? WHERE id = ?").run(cleanName, existing.id);
      existing.display_name = cleanName;
    }
    return rowToFeedUser(existing);
  }
  const id = `feed-${randomUUID().slice(0, 12)}`;
  db.prepare(
    "INSERT INTO feed_users (id, email, display_name, created_at, decisions_completed, sim_completed, certificate_id) VALUES (?, ?, ?, ?, 0, 0, NULL)",
  ).run(id, cleanEmail, cleanName, Date.now());
  return { id, email: cleanEmail, displayName: cleanName, createdAt: Date.now(), decisionsCompleted: 0, simCompleted: false, certificateId: null };
}

export function getFeedUserById(id: string): FeedUser | null {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const row = getDb().prepare("SELECT * FROM feed_users WHERE id = ?").get(id) as any;
  return row ? rowToFeedUser(row) : null;
}

/** Story ids this visitor has already answered. */
export function getAnsweredStoryIds(feedUserId: string): string[] {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const rows = getDb().prepare("SELECT story_id FROM feed_responses WHERE feed_user_id = ?").all(feedUserId) as any[];
  return rows.map((r) => r.story_id as string);
}

/**
 * Save a visitor's response to a story (idempotent per story). Returns the new
 * total of distinct decisions completed.
 */
export function recordFeedResponse(feedUserId: string, storyId: string, response: string): number {
  const db = getDb();
  const id = `fr-${randomUUID().slice(0, 12)}`;
  db.prepare(
    "INSERT OR IGNORE INTO feed_responses (id, feed_user_id, story_id, response, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, feedUserId, storyId, response.trim(), Date.now());

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM feed_responses WHERE feed_user_id = ?").get(feedUserId) as any;
  const count = Number(n) || 0;
  db.prepare("UPDATE feed_users SET decisions_completed = ? WHERE id = ?").run(count, feedUserId);
  return count;
}

export function setFeedSimComplete(feedUserId: string): void {
  getDb().prepare("UPDATE feed_users SET sim_completed = 1 WHERE id = ?").run(feedUserId);
}

/** Issue (or return the existing) certificate completion id for a visitor. */
export function ensureCertificateId(feedUserId: string): string {
  const db = getDb();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const row = db.prepare("SELECT certificate_id FROM feed_users WHERE id = ?").get(feedUserId) as any;
  if (row?.certificate_id) return row.certificate_id as string;
  const certId = randomUUID();
  db.prepare("UPDATE feed_users SET certificate_id = ? WHERE id = ?").run(certId, feedUserId);
  return certId;
}
