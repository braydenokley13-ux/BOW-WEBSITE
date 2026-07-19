/* ============================================================
 * In-app notifications (Feature 6).
 *
 * A lightweight, on-platform notification system — no email. Server
 * actions fire notifications through {@link createNotification}; the
 * dashboard nav reads them with {@link getNotifications}. Passing a
 * fixed `id` makes a trigger idempotent (INSERT OR IGNORE), so a
 * notification for "Module 3 unlocked" is created exactly once.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export type NotificationType =
  | "module_unlocked"
  | "quiz_available"
  | "weekly_challenge"
  | "certificate_earned"
  | "discussion_reply"
  | "rank_up"
  | "streak_milestone"
  | "instructor_pipeline"
  | "partner_pipeline"
  | "class_ops"
  | "quality";

/** A notification as the bell dropdown renders it (fully serializable). */
export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  createdAt: number;
  /** Relative label, e.g. "2 hours ago". */
  when: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  /** Optional fixed id — when supplied, the insert is idempotent. */
  id?: string;
}

/** Persist a notification. With a fixed `id`, repeat calls are no-ops. */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const id = input.id ?? `ntf-${randomUUID().slice(0, 12)}`;
  (await getDb()
        .prepare(
          "INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, read, link, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
        )
        .run(id, input.userId, input.type, input.title, input.body, input.link ?? null, Date.now()));
}

/** Relative "time ago" label from an epoch-ms timestamp. */
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The most recent notifications for a user (default 10), newest first. */
export async function getNotifications(userId: string, limit = 10): Promise<NotificationView[]> {
  const rows = (await getDb()
      .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(userId, limit)) as any[];
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    read: !!r.read,
    link: r.link ?? null,
    createdAt: Number(r.created_at) || 0,
    when: timeAgo(Number(r.created_at) || 0),
  }));
}

/** The number of unread notifications for a user. */
export async function getUnreadCount(userId: string): Promise<number> {
  const row = (await getDb()
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0")
      .get(userId)) as any;
  return Number(row?.n) || 0;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
