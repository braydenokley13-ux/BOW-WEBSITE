"use server";

/* ============================================================
 * Parent account activation — the bridge from a registered guardian
 * `people` row to a real, signed-in `/family` account.
 *
 * Follows the same shape as acceptInvitation() in app/actions/auth.ts:
 * validate -> provision Supabase identity -> create/claim the local `users`
 * row -> sign in. The one addition activation needs that invitation-accept
 * does not is `failActivation()` — Supabase provisioning failing here must
 * never be reported to the family as success, because the registration
 * already succeeded and the family is trusting this step to finish the job.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { isPublicDemoPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";
import { ensureSupabaseAuthUser, linkAppUserToSupabaseAuth } from "@/lib/supabase/auth-helpers";
import { roleHomePath } from "@/lib/account-identity";
import { clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";
import { inspectActivation, failActivation, linkFamilyToAccount, queueActivation, ActivationError } from "@/lib/parent-activation";
import { SELF_PACED_ORG_ID } from "@/lib/account-identity";

export interface ActivateState {
  error?: string;
}

/**
 * Set the parent's password and finish activation. On any Supabase-identity
 * failure the activation is marked `failed` and the family is told plainly —
 * never redirected as if the account exists.
 */
export async function activateParentAccount(_prev: ActivateState, formData: FormData): Promise<ActivateState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!token || token.length < 32) return { error: "This activation link is invalid." };
  if (password.length < 8 || password.length > 256) return { error: "Choose a password between 8 and 256 characters." };
  if (isPublicDemoPassword(password)) return { error: "Choose a password that is not the public BOW demo password." };
  if (name.length > 160) return { error: "Name must be 160 characters or fewer." };

  const address = await clientAddressBucket();
  if (address) {
    const limit = await consumeRateLimit("parent-activation-network", address, {
      limit: 30,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });
    if (!limit.allowed) return { error: "Too many attempts. Wait a while and try again." };
  }
  const tokenLimit = await consumeRateLimit("parent-activation-token", token, {
    limit: 8,
    windowMs: 60 * 60 * 1000,
    blockMs: 60 * 60 * 1000,
  });
  if (!tokenLimit.allowed) return { error: "Too many attempts on this link. Ask for a fresh one." };

  const lookup = await inspectActivation(token);
  if (!lookup) return { error: "We couldn't find this activation link." };
  if (lookup.state === "complete") return { error: "This account is already active. Sign in instead." };
  if (lookup.state === "expired") return { error: "This activation link has expired. Ask for a fresh one from the support centre." };
  if (lookup.state === "support_required") {
    return { error: "This email is already tied to a BOW staff account. Contact support to sort this out." };
  }
  if (lookup.state === "failed") {
    return { error: "This link's previous attempt did not finish. Ask for a fresh activation link." };
  }

  const db = getDb();
  const person = (await db.prepare("SELECT id, name, user_id FROM people WHERE id = ?").get(lookup.personId)) as
    | { id: string; name: string | null; user_id: string | null }
    | undefined;
  if (!person) return { error: "We couldn't find the family record for this link." };
  if (person.user_id) return { error: "This account is already active. Sign in instead." };

  const email = lookup.email;
  const existingUser = (await db.prepare("SELECT id, role FROM users WHERE lower(email) = ?").get(email)) as
    | { id: string; role: string }
    | undefined;
  if (existingUser && existingUser.role !== "parent") {
    // The lib-level guard in queueActivation already prevents new invitations
    // for staff emails; this is the same guard re-checked at submit time in
    // case the account changed role between invite and submit.
    await failActivation(lookup.id, "Email now belongs to a non-parent account.");
    return { error: "This email is tied to a different kind of BOW account. Contact support." };
  }

  const displayName = name || person.name || email.split("@")[0];
  const userId = existingUser?.id ?? `u-${randomUUID()}`;
  const now = Date.now();

  if (!existingUser) {
    await db
      .prepare(
        `INSERT INTO users (id, name, first, email, role, org_id, status, last, signin, password_hash, last_active_at, created_at)
         VALUES (?, ?, ?, ?, 'parent', ?, 'active', 'Just now', 'Email + password', NULL, ?, ?)`,
      )
      .run(userId, displayName, displayName.split(/\s+/)[0] || displayName, email, SELF_PACED_ORG_ID, now, now);
  }

  // Provision the Supabase identity before touching anything else. If this
  // fails, nothing else about the account is created or claimed.
  const authUserId = await ensureSupabaseAuthUser(email, password);
  if (!authUserId) {
    if (!existingUser) await db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    await failActivation(lookup.id, "Supabase identity provisioning failed.");
    return {
      error: "We couldn't finish creating your account. It was not activated — please contact support and we'll fix it.",
    };
  }
  await linkAppUserToSupabaseAuth(userId, authUserId);

  await linkFamilyToAccount(lookup.id, lookup.personId, userId);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return {
      error: "Your account was created, but we couldn't start your session. Use Sign in from the homepage.",
    };
  }

  redirect(roleHomePath("parent"));
}

export interface ResendState {
  error?: string;
  sent?: boolean;
}

/**
 * Secure resend: takes only the activation id (never guessable from the
 * expired/failed token itself) so a stale link's "resend" button cannot be
 * used to enumerate other families' activations.
 */
export async function resendActivation(_prev: ResendState, formData: FormData): Promise<ResendState> {
  const activationId = String(formData.get("activationId") ?? "").trim();
  if (!activationId.startsWith("pac-")) return { error: "Invalid request." };

  const address = await clientAddressBucket();
  if (address) {
    const limit = await consumeRateLimit("parent-activation-resend", address, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    });
    if (!limit.allowed) return { error: "Too many resend attempts. Wait a while and try again." };
  }

  const db = getDb();
  const row = (await db.prepare("SELECT person_id, email FROM parent_activations WHERE id = ?").get(activationId)) as
    | { person_id: string; email: string }
    | undefined;
  if (!row) return { error: "We couldn't find that activation." };

  const person = (await db.prepare("SELECT name FROM people WHERE id = ?").get(row.person_id)) as
    | { name: string | null }
    | undefined;

  const ticket = await queueActivation(row.person_id, row.email);
  if (!ticket) {
    return { error: "This link can no longer be resent automatically. Contact support for help." };
  }
  // Email delivery is deliberately out of this file's scope (same separation
  // recordNotification() uses elsewhere) — the ticket's token would be sent
  // by the notification/email layer, never rendered to the browser here.
  return { sent: true };
}

export { ActivationError };
