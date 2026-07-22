/**
 * One-time (but safely re-runnable) backfill: provision a Supabase Auth
 * identity for every app `users` row that does not yet have one, and link it
 * via `users.auth_user_id`.
 *
 * Each provisioned Supabase user gets a random password the row's owner will
 * never see or need — `password_hash` in the app database is intentionally
 * left untouched by this script. The lazy-migration path in
 * `app/actions/sign-in.ts` sets the account's *real* password in Supabase on
 * the user's first successful sign-in (verified against the legacy scrypt
 * hash), then clears `password_hash`. Until that happens, the account can
 * still sign in exactly as before; this script only pre-creates the Supabase
 * side so `auth_user_id` is never null for long.
 *
 * Usage:
 *   npm run db:migrate:auth
 *
 * Idempotent: rows that already have `auth_user_id` are skipped. If a
 * Supabase Auth user already exists for a row's email (e.g. a previous
 * partial run, or the row was created by `joinSelfPaced`/`acceptInvitation`
 * concurrently), the script looks it up and links to it instead of failing.
 */

import { randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { getDb } = await import("@/lib/db");
  const { getSupabaseAdmin, findSupabaseUserIdByEmail } = await import("@/lib/supabase/admin");

  const db = getDb();
  const admin = getSupabaseAdmin();

  const rows = (await db
      .prepare("SELECT id, email FROM users WHERE auth_user_id IS NULL ORDER BY created_at, id")
      .all()) as { id: string; email: string }[];

  console.log(`[migrate-users-to-supabase-auth] ${rows.length} user(s) without auth_user_id.`);

  let linked = 0;
  let created = 0;
  let failed = 0;

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email) {
      console.warn(`[migrate-users-to-supabase-auth] skipping ${row.id}: no email on file`);
      failed += 1;
      continue;
    }

    try {
      let authUserId: string | null = null;

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
      });

      if (!error && data.user) {
        authUserId = data.user.id;
        created += 1;
      } else {
        // Most likely: a Supabase Auth user already exists for this email.
        authUserId = await findSupabaseUserIdByEmail(email);
        if (authUserId) linked += 1;
      }

      if (!authUserId) {
        console.error(`[migrate-users-to-supabase-auth] FAILED ${row.id} <${email}>: ${error?.message ?? "unknown error"}`);
        failed += 1;
        continue;
      }

      const result = await db
        .prepare("UPDATE users SET auth_user_id = ? WHERE id = ? AND auth_user_id IS NULL")
        .run(authUserId, row.id);
      if (result.changes !== 1) {
        console.warn(`[migrate-users-to-supabase-auth] ${row.id} <${email}>: already linked by a concurrent run, skipping`);
      }
    } catch (err) {
      console.error(`[migrate-users-to-supabase-auth] FAILED ${row.id} <${email}>:`, err);
      failed += 1;
    }
  }

  console.log(
    `[migrate-users-to-supabase-auth] done. created=${created} linked-existing=${linked} failed=${failed} total=${rows.length}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[migrate-users-to-supabase-auth] fatal error:", err);
  process.exitCode = 1;
});
