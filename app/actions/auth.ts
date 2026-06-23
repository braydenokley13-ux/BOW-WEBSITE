"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { getCurrentUser } from "@/lib/dal";
import { isEnrolledSelfPaced } from "@/lib/self-paced";
import { roleHomePath, SELF_PACED_COHORT_ID, SELF_PACED_ORG_ID, type Role } from "@/lib/account";

export interface AuthState {
  error?: string;
}

/* ---------------- Sign in ---------------- */

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const db = getDb();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

  // Same message whether the account is missing or the password is
  // wrong, so we don't leak which emails exist.
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "That email and password don't match an account." };
  }
  if (user.status === "suspended") {
    return { error: "This account is suspended. Contact your BOW administrator." };
  }
  if (user.status === "invited") {
    return { error: "Finish setting up your account from your invitation link first." };
  }

  await createSession(user.id);

  // Honor an explicit ?next, otherwise send self-paced students to their
  // async dashboard and everyone else to their role's front-office home.
  let dest: string;
  if (next && (next.startsWith("/app") || next === "/dashboard" || next === "/instructor")) {
    dest = next;
  } else if (user.role === "student" && isEnrolledSelfPaced(user.id)) {
    dest = "/dashboard";
  } else {
    dest = roleHomePath(user.role as Role);
  }
  redirect(dest);
}

/* ---------------- Self-paced sign-up (/join) ---------------- */

/**
 * Create a self-learning student account with just a name, email, and
 * password — no instructor code. The account gets the `student` role, is
 * placed in the default "BOW Self-Paced" async cohort, and is signed in
 * immediately (same accounts/sessions tables and cookie session as every
 * other user). Module 1 of Track 101 is open the moment they land on
 * /dashboard.
 */
export async function joinSelfPaced(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { error: "Enter your name so we know what to call you." };
  if (!/.+@.+\..+/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Choose a password with at least 8 characters." };

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return { error: "An account with that email already exists. Try signing in instead." };

  const userId = `u-${randomUUID().slice(0, 8)}`;
  const first = name.split(/\s+/)[0] || name;
  const passwordHash = hashPassword(password);

  const now = Date.now();
  db.prepare(
    "INSERT INTO users (id, name, first, email, role, org_id, grade, status, last, signin, password_hash, last_active_at, created_at) VALUES (?, ?, ?, ?, 'student', ?, NULL, 'active', 'Just now', 'Email + password', ?, ?, ?)",
  ).run(userId, name, first, email, SELF_PACED_ORG_ID, passwordHash, now, now);

  // Place them in the default async cohort so the instructor roster and the
  // self-paced module sequence both pick them up.
  db.prepare(
    "INSERT OR IGNORE INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last) VALUES (?, ?, 'active', 'not-started', 'Just now', 'none')",
  ).run(userId, SELF_PACED_COHORT_ID);

  await createSession(userId);
  redirect("/onboarding");
}

/* ---------------- Sign out ---------------- */

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}

/* ---------------- Accept invitation ---------------- */

export interface AcceptState {
  error?: string;
}

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const first = String(formData.get("first") ?? "").trim();
  const last = String(formData.get("last") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();

  if (!token) return { error: "This invitation link is missing its token." };
  if (password.length < 8) return { error: "Choose a password with at least 8 characters." };

  const db = getDb();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const inv = db.prepare("SELECT * FROM invitations WHERE token = ?").get(token) as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (!inv) return { error: "We couldn't find this invitation." };
  if (inv.status === "revoked") return { error: "This invitation was revoked." };
  if (inv.status === "accepted") return { error: "This invitation was already used. Try signing in." };
  if (inv.status === "expired") return { error: "This invitation has expired. Ask for a fresh one." };

  const email = String(inv.email).toLowerCase();
  const passwordHash = hashPassword(password);

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const existing = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

  let userId: string;
  if (existing) {
    userId = existing.id;
    db.prepare(
      "UPDATE users SET status = 'active', password_hash = ?, signin = 'Email + password', first = COALESCE(NULLIF(?, ''), first), name = COALESCE(NULLIF(?, ''), name), grade = COALESCE(NULLIF(?, ''), grade), last = 'Just now' WHERE id = ?",
    ).run(passwordHash, first, buildName(first, last, existing.name), grade, userId);
  } else {
    userId = `u-${randomUUID().slice(0, 8)}`;
    const name = buildName(first, last, email.split("@")[0]);
    db.prepare(
      "INSERT INTO users (id, name, first, email, role, org_id, grade, status, last, signin, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'Just now', 'Email + password', ?, ?)",
    ).run(userId, name, first || name, email, inv.role, inv.org_id, grade || null, passwordHash, Date.now());
  }

  // Enroll students into their invited cohort if not already enrolled.
  if (inv.role === "student" && inv.cohort_id) {
    const enrolled = db
      .prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND cohort_id = ?")
      .get(userId, inv.cohort_id);
    if (!enrolled) {
      db.prepare(
        "INSERT INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last) VALUES (?, ?, 'active', 'not-started', 'Just now', 'none')",
      ).run(userId, inv.cohort_id);
    }
  }

  db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(inv.id);

  await createSession(userId);
  redirect(roleHomePath(inv.role as Role));
}

function buildName(first: string, last: string, fallback: string): string {
  const composed = [first, last].filter(Boolean).join(" ").trim();
  return composed || fallback;
}

/* ---------------- Change password ---------------- */

export interface PasswordState {
  error?: string;
  ok?: boolean;
}

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const me = await getCurrentUser();
  if (!me) return { error: "You need to be signed in." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New password and confirmation don't match." };

  const db = getDb();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(me.id) as any;
  if (!verifyPassword(current, row?.password_hash)) {
    return { error: "Your current password is incorrect." };
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), me.id);
  return { ok: true };
}
