/* ============================================================
 * Session management — database-backed sessions.
 *
 * A random opaque token is sent to the browser as an HttpOnly cookie;
 * only its SHA-256 digest is stored in the `sessions` table. Because the
 * token carries no data of its own, there is nothing to forge or decrypt,
 * and a leaked database digest cannot be replayed as a browser credential.
 *
 * Server-only.
 * ============================================================ */

import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { getDb, rowToUser } from "@/lib/db";
import type { User } from "@/lib/account";

export const SESSION_COOKIE = "bow_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // one week

const digestSessionToken = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Cookie mutation is unavailable during some Server Component render paths. */
function clearSessionCookieWhenPossible(cookieStore: Awaited<ReturnType<typeof cookies>>): void {
  try {
    cookieStore.delete(SESSION_COOKIE);
  } catch {
    // The invalid database session is still revoked. Middleware or the next
    // Server Action can remove the now-harmless stale browser cookie.
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const tokenDigest = digestSessionToken(token);
  const now = Date.now();
  const expiresAt = now + MAX_AGE_SECONDS * 1000;
  const db = getDb();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    // Status is rechecked under the writer lock so a suspension or completed
    // deletion request cannot race an already-in-flight sign-in into creating
    // a fresh authenticated session.
    const inserted = (await db.prepare(
          `INSERT INTO sessions (token, user_id, expires_at)
       SELECT ?, u.id, ?
         FROM users u
         JOIN organizations o ON o.id = u.org_id
        WHERE u.id = ? AND u.status = 'active' AND o.status = 'active'`,
        ).run(tokenDigest, expiresAt, userId));
    if (inserted.changes !== 1) throw new Error("Account or organization is not active.");
    (await db.prepare(
            `UPDATE users SET last_active_at = ?
        WHERE id = ? AND status = 'active'
          AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = users.org_id AND o.status = 'active')`,
          ).run(now, userId));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    throw error;
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
  } catch (error) {
    // Do not leave a durable credential behind when the browser cookie could
    // not be issued.
    (await db.prepare("DELETE FROM sessions WHERE token = ?").run(tokenDigest));
    throw error;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    (await getDb().prepare("DELETE FROM sessions WHERE token = ?").run(digestSessionToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Resolve the signed-in user from the session cookie, or null. */
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenDigest = digestSessionToken(token);

  const db = getDb();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const row = (await db
      .prepare(
        `SELECT u.*, s.expires_at AS __exp, s.token AS __session_token,
              o.status AS __organization_status
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN organizations o ON o.id = u.org_id
        WHERE s.token = ?`,
      )
      .get(tokenDigest)) as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!row) {
    clearSessionCookieWhenPossible(cookieStore);
    return null;
  }
  if (Number(row.__exp) <= Date.now()) {
    (await db.prepare("DELETE FROM sessions WHERE token = ?").run(row.__session_token));
    clearSessionCookieWhenPossible(cookieStore);
    return null;
  }
  // Only fully active accounts in an active organization may hold sessions.
  if (row.status !== "active" || row.__organization_status !== "active") {
    (await db.prepare("DELETE FROM sessions WHERE token = ?").run(row.__session_token));
    clearSessionCookieWhenPossible(cookieStore);
    return null;
  }
  return rowToUser(row);
}
