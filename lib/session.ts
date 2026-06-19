/* ============================================================
 * Session management — database-backed sessions.
 *
 * A random opaque token is stored in the `sessions` table and sent
 * to the browser as an HttpOnly cookie. Because the token carries no
 * data of its own, there is nothing to forge or decrypt: every
 * request is validated against the database.
 *
 * Server-only.
 * ============================================================ */

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getDb, rowToUser } from "@/lib/db";
import type { User } from "@/lib/account";

export const SESSION_COOKIE = "bow_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // one week

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Resolve the signed-in user from the session cookie, or null. */
export async function getSessionUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const row = db
    .prepare(
      "SELECT u.*, s.expires_at AS __exp FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?",
    )
    .get(token) as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!row) return null;
  if (Number(row.__exp) < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  // A suspended account's sessions are dead on arrival.
  if (row.status === "suspended") return null;

  return rowToUser(row);
}
