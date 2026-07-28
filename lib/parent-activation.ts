/* ============================================================
 * Parent account activation.
 *
 * Registration happens before the account exists. A family must receive a
 * real registration result first; only then is the guardian invited to prove
 * control of the email and set a password. This module owns that bridge.
 *
 * The states are explicit rather than inferred because the two halves can
 * fail independently: the local `users` row and the Supabase Auth identity.
 * Claiming "your account is ready" when Supabase provisioning failed would
 * strand the family with a link that never works, so `failed` and
 * `support_required` are real, queryable states an admin can act on.
 *
 * Server-only, not a "use server" module.
 * ============================================================ */

import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { hashOpaqueToken } from "@/lib/security-tokens";

export type ActivationState =
  | "invitation_pending"
  | "identity_created"
  | "family_linked"
  | "complete"
  | "expired"
  | "failed"
  | "support_required";

/** Activation links are short-lived; a stale link must never open a family. */
const ACTIVATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_RESENDS = 10;

export class ActivationError extends Error {
  constructor(
    message: string,
    readonly code: "expired" | "not_found" | "used" | "conflict" | "privileged" | "invalid" = "invalid",
  ) {
    super(message);
  }
}

export interface ActivationTicket {
  id: string;
  token: string;
  email: string;
  expiresAt: number;
}

/**
 * Roles that must never be claimed through a family activation link. A
 * guardian email that happens to match a staff account is a support case, not
 * an automatic privilege grant — this is the check that keeps a public
 * registration form from being an admin-account takeover.
 */
const PRIVILEGED_ROLES: ReadonlySet<string> = new Set(["admin", "growth", "instructor"]);

/**
 * Create (or refresh) an activation invitation for a guardian. Called after a
 * registration produced a real result. Never throws into the registration
 * path: the caller treats failure as "resend it later from the support
 * centre", because the registration itself already succeeded.
 */
export async function queueActivation(personId: string, email: string): Promise<ActivationTicket | null> {
  const db = getDb();
  const now = Date.now();
  const normalized = email.trim().toLowerCase();

  // An already-activated guardian does not need another invitation.
  const complete = (await db
    .prepare("SELECT id FROM parent_activations WHERE person_id = ? AND state = 'complete' LIMIT 1")
    .get(personId)) as { id: string } | undefined;
  if (complete) return null;

  const existingUser = (await db.prepare("SELECT id, role FROM users WHERE lower(email) = ?").get(normalized)) as
    | { id: string; role: string }
    | undefined;
  if (existingUser && PRIVILEGED_ROLES.has(existingUser.role)) {
    // Record the situation instead of silently doing nothing, so it shows up
    // in the admin support queue rather than looking like a lost email.
    await db
      .prepare(
        `INSERT INTO parent_activations
           (id, person_id, email, token_hash, state, expires_at, failure_reason, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'support_required', ?, ?, ?, ?)`,
      )
      .run(
        `pac-${randomUUID().slice(0, 12)}`,
        personId,
        normalized,
        hashOpaqueToken(randomUUID()),
        now,
        "This email already belongs to a staff account.",
        now,
        now,
      );
    return null;
  }

  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = now + ACTIVATION_TTL_MS;

  const pending = (await db
    .prepare(
      `SELECT id, resend_count FROM parent_activations
        WHERE person_id = ? AND state IN ('invitation_pending', 'expired', 'failed')
        ORDER BY created_at DESC LIMIT 1`,
    )
    .get(personId)) as { id: string; resend_count: number } | undefined;

  if (pending) {
    if (pending.resend_count >= MAX_RESENDS) {
      await db
        .prepare("UPDATE parent_activations SET state = 'support_required', failure_reason = ?, updated_at = ? WHERE id = ?")
        .run("Too many activation attempts.", now, pending.id);
      return null;
    }
    await db
      .prepare(
        `UPDATE parent_activations
            SET token_hash = ?, state = 'invitation_pending', email = ?, expires_at = ?,
                failure_reason = NULL, resend_count = resend_count + 1, last_sent_at = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(tokenHash, normalized, expiresAt, now, now, pending.id);
    return { id: pending.id, token, email: normalized, expiresAt };
  }

  const id = `pac-${randomUUID().slice(0, 12)}`;
  await db
    .prepare(
      `INSERT INTO parent_activations
         (id, person_id, email, token_hash, state, expires_at, last_sent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'invitation_pending', ?, ?, ?, ?)`,
    )
    .run(id, personId, normalized, tokenHash, expiresAt, now, now, now);
  return { id, token, email: normalized, expiresAt };
}

export interface ActivationLookup {
  id: string;
  personId: string;
  email: string;
  state: ActivationState;
  expiresAt: number;
}

/**
 * Resolve an activation token without consuming it, so the activation page can
 * render the right state (valid / expired / already used) before asking for a
 * password.
 */
export async function inspectActivation(token: string): Promise<ActivationLookup | null> {
  if (!token || token.length < 32) return null;
  const db = getDb();
  const row = (await db
    .prepare("SELECT id, person_id, email, state, expires_at FROM parent_activations WHERE token_hash = ?")
    .get(hashOpaqueToken(token))) as
    | { id: string; person_id: string; email: string; state: string; expires_at: number }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    personId: row.person_id,
    email: row.email,
    state: (row.expires_at < Date.now() && row.state === "invitation_pending" ? "expired" : row.state) as ActivationState,
    expiresAt: row.expires_at,
  };
}

/**
 * Mark an activation failed with a reason an admin can read. Used when
 * Supabase identity provisioning does not succeed, so the family is never told
 * an account exists when it does not.
 */
export async function failActivation(activationId: string, reason: string): Promise<void> {
  const db = getDb();
  await db
    .prepare("UPDATE parent_activations SET state = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?")
    .run(reason.slice(0, 300), Date.now(), activationId);
}

/**
 * Link the newly created account to the guardian Person and every student that
 * Person is an active guardian for. This is the step that turns an activated
 * login into a family: without it the parent signs in to an empty dashboard.
 */
export async function linkFamilyToAccount(
  activationId: string,
  personId: string,
  userId: string,
): Promise<number> {
  const db = getDb();
  const now = Date.now();
  await db.prepare("UPDATE people SET user_id = ?, updated_at = ? WHERE id = ?").run(userId, now, personId);
  const linked = (await db
    .prepare("SELECT COUNT(*) AS n FROM student_guardians WHERE person_id = ? AND status = 'active'")
    .get(personId)) as { n: number | string };
  await db
    .prepare("UPDATE parent_activations SET state = 'complete', user_id = ?, consumed_at = ?, updated_at = ? WHERE id = ?")
    .run(userId, now, now, activationId);
  return Number(linked?.n ?? 0);
}

/**
 * The guardian Person for a signed-in parent account, or null. Every family
 * surface resolves the viewer through this so a parent can only ever reach
 * their own children.
 */
export async function guardianPersonForUser(userId: string): Promise<string | null> {
  const db = getDb();
  const rows = (await db
    .prepare("SELECT id FROM people WHERE user_id = ? ORDER BY created_at, id")
    .all(userId)) as unknown as { id: string }[];
  // Ambiguity must stop the read, not pick a winner: an account linked to two
  // People is an identity conflict, and guessing could open the wrong family.
  // The admin duplicate-review queue is where this gets resolved.
  if (rows.length !== 1) return null;
  return rows[0].id;
}

/** Student ids this guardian may see. The single source of family scope. */
export async function studentIdsForGuardian(personId: string): Promise<string[]> {
  const db = getDb();
  const rows = (await db
    .prepare("SELECT student_id FROM student_guardians WHERE person_id = ? AND status = 'active' ORDER BY created_at")
    .all(personId)) as unknown as { student_id: string }[];
  return rows.map((row) => row.student_id);
}

/**
 * Authorization check for every parent-scoped read and write. Returns false
 * for a revoked guardian, which is what stops a removed second parent from
 * keeping access through a stale session.
 */
export async function guardianCanAccessStudent(personId: string, studentId: string): Promise<boolean> {
  const db = getDb();
  const row = (await db
    .prepare("SELECT 1 AS ok FROM student_guardians WHERE person_id = ? AND student_id = ? AND status = 'active'")
    .get(personId, studentId)) as { ok: number } | undefined;
  return Boolean(row);
}
