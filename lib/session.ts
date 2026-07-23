/* ============================================================
 * Session management — Supabase Auth backed.
 *
 * The browser holds Supabase's own auth cookies (managed by
 * `@supabase/ssr`); this module never issues or reads an app-specific
 * session cookie any more. `getSessionUser()` asks Supabase Auth to
 * revalidate the caller (`supabase.auth.getUser()`, never `getSession()`
 * alone) and then resolves the app `users` row that owns that identity,
 * enforcing the same active-user / active-organization invariants the old
 * SQLite-session implementation enforced.
 *
 * Server-only.
 * ============================================================ */

import { getDb, rowToUser } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/lib/account";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Sign the caller out of Supabase Auth. Replaces the old cookie-delete. */
export async function destroySession(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/**
 * Resolve the signed-in app user from the current Supabase Auth session, or
 * null. Loads the `users` row by `auth_user_id` first; if a Supabase
 * identity has not been linked yet (e.g. an account created before this
 * migration), falls back to matching by lower(email) and backfills
 * `auth_user_id` so future lookups take the fast path.
 *
 * Only fully active accounts in an active organization may resolve to a
 * session. Anything else signs the Supabase session out and returns null,
 * mirroring the invariant the previous `sessions`-table implementation
 * enforced in `createSession`/`getSessionUser`.
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const db = getDb();
  let row = (await db
      .prepare(
        `SELECT u.*, o.status AS __organization_status
         FROM users u
         LEFT JOIN organizations o ON o.id = u.org_id
        WHERE u.auth_user_id = ?`,
      )
      .get(authUser.id)) as any;

  if (!row && authUser.email) {
    row = (await db
        .prepare(
          `SELECT u.*, o.status AS __organization_status
           FROM users u
           LEFT JOIN organizations o ON o.id = u.org_id
          WHERE lower(u.email) = lower(?) AND u.auth_user_id IS NULL`,
        )
        .get(authUser.email)) as any;
    if (row) {
      const claimed = (await db
          .prepare("UPDATE users SET auth_user_id = ? WHERE id = ? AND auth_user_id IS NULL")
          .run(authUser.id, row.id));
      // Another request may have linked this identity concurrently (or to a
      // different row); either way, re-resolve by auth_user_id below so the
      // returned user always matches what is actually persisted.
      if (claimed.changes === 1) row.auth_user_id = authUser.id;
    }
  }

  if (!row || row.status !== "active" || row.__organization_status !== "active") {
    await supabase.auth.signOut();
    return null;
  }

  await db.prepare("UPDATE users SET last_active_at = ? WHERE id = ?").run(Date.now(), row.id);
  return rowToUser(row);
}
