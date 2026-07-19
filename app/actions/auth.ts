"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { DUMMY_PASSWORD_HASH, hashPassword, isPublicDemoPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import { getCurrentUser } from "@/lib/dal";
import { isEnrolledSelfPaced } from "@/lib/self-paced";
import { roleHomePath, SELF_PACED_COHORT_ID, SELF_PACED_ORG_ID, type Role } from "@/lib/account";
import { hashOpaqueToken } from "@/lib/security-tokens";
import { clearRateLimit, clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/hiring";
import {
  developmentAppOrigin,
  publicAppOrigin,
  sendTransactionalEmail,
} from "@/lib/transactional-email";

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
  if (password.length > 256) return { error: "That email and password don't match an account." };

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("auth-login-network", address, {
          limit: 40,
          windowMs: 15 * 60 * 1000,
          blockMs: 15 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }
  const identityLimit = (await consumeRateLimit("auth-login-identity", email, {
      limit: 8,
      windowMs: 15 * 60 * 1000,
      blockMs: 15 * 60 * 1000,
    }));
  if (!identityLimit.allowed) return { error: "Too many sign-in attempts. Wait a few minutes and try again." };

  const db = getDb();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const user = (await db.prepare("SELECT * FROM users WHERE email = ?").get(email)) as any;

  // Same message whether the account is missing or the password is
  // wrong, so we don't leak which emails exist.
  const passwordMatches = verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    return { error: "That email and password don't match an account." };
  }
  if (user.status === "suspended") {
    return { error: "This account is suspended. Contact your BOW administrator." };
  }
  if (user.status === "invited") {
    return { error: "Finish setting up your account from your invitation link first." };
  }

  try {
    await createSession(user.id);
  } catch {
    // The password was already proven, so this can be specific enough to help
    // a real owner without becoming an account-enumeration oracle. createSession
    // rechecks both account and organization state under its writer lock.
    return { error: "Sign-in is unavailable for this account or organization. Contact your BOW administrator." };
  }
  (await clearRateLimit("auth-login-identity", email));

  if (user.password_change_required) redirect("/change-password");

  // Honor an explicit ?next, otherwise send self-paced students to their
  // async dashboard and everyone else to their role's front-office home.
  let dest: string;
  if (next && (next.startsWith("/app") || next === "/dashboard" || next === "/instructor")) {
    dest = next;
  } else if (user.role === "student" && (await isEnrolledSelfPaced(user.id))) {
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
  if (password.length < 8 || password.length > 256) return { error: "Choose a password between 8 and 256 characters." };
  if (isPublicDemoPassword(password)) return { error: "Choose a password that is not the public BOW demo password." };

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("auth-join-network", address, {
          limit: 20,
          windowMs: 60 * 60 * 1000,
          blockMs: 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return { error: "Too many accounts were created from this network. Wait and try again." };
  }
  const identityLimit = (await consumeRateLimit("auth-join-identity", email, {
      limit: 3,
      windowMs: 24 * 60 * 60 * 1000,
      blockMs: 24 * 60 * 60 * 1000,
    }));
  if (!identityLimit.allowed) return { error: "This email has made too many sign-up attempts. Wait and try again." };

  const db = getDb();
  const userId = `u-${randomUUID().slice(0, 8)}`;
  const first = name.split(/\s+/)[0] || name;
  // Scrypt is intentionally expensive. Finish it before taking SQLite's
  // writer lock so one sign-up cannot stall every other operating action.
  const passwordHash = hashPassword(password);
  const now = Date.now();
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    if ((await db.prepare("SELECT 1 FROM users WHERE lower(trim(email)) = ?").get(email))) {
      throw new Error("account_exists");
    }
    if (!(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status = 'active'").get(SELF_PACED_ORG_ID))) {
      throw new Error("topology_unavailable");
    }
    if (!(await db.prepare("SELECT 1 FROM cohorts WHERE id = ? AND org_id = ? AND status IN ('active','enrolling')").get(SELF_PACED_COHORT_ID, SELF_PACED_ORG_ID))) {
      throw new Error("topology_unavailable");
    }
    if (!(await db.prepare("SELECT 1 FROM classes WHERE id = ?").get(SELF_PACED_COHORT_ID))) {
      throw new Error("topology_unavailable");
    }

    (await db.prepare(
            "INSERT INTO users (id, name, first, email, role, org_id, grade, status, last, signin, password_hash, last_active_at, created_at) VALUES (?, ?, ?, ?, 'student', ?, NULL, 'active', 'Just now', 'Email + password', ?, ?, ?)",
          ).run(userId, name, first, email, SELF_PACED_ORG_ID, passwordHash, now, now));

    const matchingPeople = (await db.prepare(
          "SELECT id, user_id FROM people WHERE lower(trim(email)) = ? ORDER BY created_at, id",
        ).all(email)) as { id: string; user_id: string | null }[];
    if (matchingPeople.length > 1 || matchingPeople[0]?.user_id) throw new Error("identity_ambiguous");
    const personId = matchingPeople[0]?.id ?? `per-${randomUUID().slice(0, 12)}`;
    if (
      matchingPeople[0]
      && (await db.prepare("SELECT 1 FROM instructors WHERE person_id = ? AND stage NOT IN ('rejected','inactive') LIMIT 1").get(personId))
    ) {
      throw new Error("identity_ambiguous");
    }
    if (matchingPeople[0]) {
      const claimed = (await db.prepare(
              `UPDATE people
            SET user_id = ?, name = CASE WHEN trim(name) = '' THEN ? ELSE name END, updated_at = ?
          WHERE id = ? AND user_id IS NULL`,
            ).run(userId, name, now, personId));
      if (claimed.changes !== 1) throw new Error("identity_ambiguous");
    } else {
      (await db.prepare(
                "INSERT INTO people (id, name, email, phone, user_id, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?, ?)",
              ).run(personId, name, email, userId, now, now));
    }

    const matchingStudents = (await db.prepare(
          `SELECT id, user_id, enrollment_status
         FROM students
        WHERE person_id = ? OR lower(trim(email)) = ?
        ORDER BY created_at, id`,
        ).all(personId, email)) as { id: string; user_id: string | null; enrollment_status: string }[];
    if (matchingStudents.length > 1 || matchingStudents[0]?.user_id || matchingStudents[0]?.enrollment_status === "inactive") {
      throw new Error("identity_ambiguous");
    }
    const studentId = matchingStudents[0]?.id ?? `stu-${randomUUID().slice(0, 12)}`;
    if (matchingStudents[0]) {
      const claimed = (await db.prepare(
              "UPDATE students SET user_id = ?, person_id = ?, updated_at = ? WHERE id = ? AND user_id IS NULL AND enrollment_status = 'active'",
            ).run(userId, personId, now, studentId));
      if (claimed.changes !== 1) throw new Error("identity_ambiguous");
    } else {
      (await db.prepare(
                `INSERT INTO students
          (id, name, age, grade, email, guardian_person_id, emergency_notes, enrollment_status,
           form_status, communication_notes, user_id, person_id, created_at, updated_at)
         VALUES (?, ?, NULL, NULL, ?, NULL, NULL, 'active', 'missing', NULL, ?, ?, ?, ?)`,
              ).run(studentId, name, email, userId, personId, now, now));
    }

    (await db.prepare(
            "INSERT INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last) VALUES (?, ?, 'active', 'not-started', 'Just now', 'none')",
          ).run(userId, SELF_PACED_COHORT_ID));
    (await db.prepare(
            `INSERT INTO class_enrollments (id, class_id, student_id, status, enrolled_at, withdrawn_at, withdrawal_reason)
       VALUES (?, ?, ?, 'enrolled', ?, NULL, NULL)
       ON CONFLICT(class_id, student_id) DO UPDATE SET
         status = 'enrolled', withdrawn_at = NULL, withdrawal_reason = NULL`,
          ).run(`cen-${randomUUID().slice(0, 12)}`, SELF_PACED_COHORT_ID, studentId, now));
    (await logActivity("student", studentId, "created", "Self-paced learner account and canonical enrollment created.", userId));
    (await db.exec("COMMIT"));
  } catch (error) {
    if (db.isTransaction) (await db.exec("ROLLBACK"));
    const code = error instanceof Error ? error.message : "";
    if (code === "account_exists") return { error: "An account with that email already exists. Try signing in instead." };
    if (code === "identity_ambiguous") return { error: "BOW already has an account or student record for this email. Contact BOW so we can connect it safely." };
    if (code === "topology_unavailable") return { error: "Self-paced enrollment is temporarily unavailable. Please try again later." };
    return { error: "Your account could not be created. No sign-up records were changed." };
  }

  try {
    await createSession(userId);
  } catch {
    return { error: "Your account was created, but automatic sign-in failed. Use the sign-in page with the email and password you just chose." };
  }
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

export interface InvitationPreview {
  email: string;
  role: "student" | "instructor";
  roleLabel: string;
  org: string;
  cohort: string;
  track: string;
  expires: string;
}

export type InvitationPreviewResult =
  | { ok: true; invite: InvitationPreview }
  | { ok: false; error: string };

const INVITATION_UNAVAILABLE = "This invitation is invalid, expired, or no longer available. Ask BOW for a fresh link.";
const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * PUBLIC — a live, high-entropy invitation token is the authorization proof.
 * The accept page calls this after reading the fragment in the browser, so the
 * bearer credential never enters the page's initial HTTP request.
 */
export async function previewInvitation(tokenInput: string): Promise<InvitationPreviewResult> {
  const token = String(tokenInput ?? "").trim();
  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("auth-invitation-preview-network", address, {
          limit: 60,
          windowMs: 60 * 60 * 1000,
          blockMs: 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return { ok: false, error: INVITATION_UNAVAILABLE };
  }
  if (!INVITATION_TOKEN_PATTERN.test(token)) return { ok: false, error: INVITATION_UNAVAILABLE };

  const db = getDb();
  const row = (await db.prepare(
      `SELECT i.email, i.role, i.org_id, i.cohort_id, i.expires_at,
            o.name AS org_name, c.name AS cohort_name, c.track AS cohort_track,
            c.org_id AS cohort_org_id, c.status AS cohort_status
       FROM invitations i
       JOIN organizations o ON o.id = i.org_id AND o.status = 'active'
       LEFT JOIN cohorts c ON c.id = i.cohort_id
      WHERE i.token_hash = ? AND i.status = 'pending' AND i.expires_at > ?`,
    ).get(hashOpaqueToken(token), Date.now())) as
    | {
        email: string;
        role: string;
        org_id: string;
        cohort_id: string | null;
        expires_at: number;
        org_name: string;
        cohort_name: string | null;
        cohort_track: string | null;
        cohort_org_id: string | null;
        cohort_status: string | null;
      }
    | undefined;
  if (!row || (row.role !== "student" && row.role !== "instructor")) {
    return { ok: false, error: INVITATION_UNAVAILABLE };
  }

  const tokenLimit = (await consumeRateLimit("auth-invitation-preview-token", token, {
      limit: 30,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }));
  if (!tokenLimit.allowed) return { ok: false, error: INVITATION_UNAVAILABLE };

  if (row.role === "student") {
    if (
      !row.cohort_id ||
      row.cohort_org_id !== row.org_id ||
      !row.cohort_status ||
      !["active", "enrolling"].includes(row.cohort_status)
    ) {
      return { ok: false, error: INVITATION_UNAVAILABLE };
    }
  } else {
    const approvals = (await db.prepare(
          `SELECT COUNT(*) AS n
         FROM people p
         JOIN instructors i ON i.person_id = p.id
        WHERE lower(p.email) = lower(?)
          AND i.stage IN ('accepted','onboarding','training','practice_evaluation','eligible','active')`,
        ).get(row.email)) as { n: number };
    if (row.org_id !== "org-bow" || approvals.n !== 1) {
      return { ok: false, error: INVITATION_UNAVAILABLE };
    }
  }

  return {
    ok: true,
    invite: {
      email: row.email,
      role: row.role,
      roleLabel: row.role === "instructor" ? "Instructor" : "Student",
      org: row.org_name,
      cohort: row.cohort_name ?? "—",
      track: row.cohort_track ? `Track ${row.cohort_track}` : "—",
      expires: new Date(Number(row.expires_at)).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    },
  };
}

export async function acceptInvitation(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const first = String(formData.get("first") ?? "").trim();
  const last = String(formData.get("last") ?? "").trim();
  const grade = String(formData.get("grade") ?? "").trim();

  if (!token) return { error: "This invitation link is missing its token." };
  if (!INVITATION_TOKEN_PATTERN.test(token)) return { error: "We couldn't find this invitation." };
  if (!first) return { error: "Enter your first name or full name." };
  if (first.length > 160) return { error: "Name must be 160 characters or fewer." };
  if (last.length > 80) return { error: "Last name or initial is too long." };
  if (grade.length > 80) return { error: "Grade band must be 80 characters or fewer." };
  if (password.length < 8 || password.length > 256) return { error: "Choose a password between 8 and 256 characters." };
  if (isPublicDemoPassword(password)) return { error: "Choose a password that is not the public BOW demo password." };

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("auth-invitation-network", address, {
          limit: 30,
          windowMs: 60 * 60 * 1000,
          blockMs: 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return { error: "Too many invitation attempts. Wait and try again." };
  }
  const db = getDb();
  const tokenHash = hashOpaqueToken(token);
  const inv = (await db.prepare("SELECT * FROM invitations WHERE token_hash = ?").get(tokenHash)) as
    | {
        id: string;
        email: string;
        role: string;
        org_id: string;
        cohort_id: string | null;
        status: string;
        expires_at: number | null;
      }
    | undefined;

  if (!inv) return { error: "We couldn't find this invitation." };
  // Random bearer-token guesses should remain read-only instead of growing the
  // persistent limiter table one unique row at a time.
  const tokenLimit = (await consumeRateLimit("auth-invitation-token", token, {
      limit: 6,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }));
  if (!tokenLimit.allowed) return { error: "Too many invitation attempts. Ask for a fresh invitation." };

  if (inv.status === "revoked") return { error: "This invitation was revoked." };
  if (inv.status === "accepted") return { error: "This invitation was already used. Try signing in." };
  if (inv.status !== "pending" || !inv.expires_at || inv.expires_at <= Date.now()) {
    return { error: "This invitation has expired. Ask for a fresh one." };
  }
  if (inv.role !== "student" && inv.role !== "instructor") return { error: "This invitation has an invalid account role." };
  if (inv.role === "student" && last && !/^[A-Za-z]\.?$/.test(last)) {
    return { error: "Enter one letter for the student's last initial (a period is optional)." };
  }

  const passwordHash = hashPassword(password);
  let userId = `u-${randomUUID()}`;
  let acceptedRole = inv.role as Role;
  let approvedInstructorPersonId: string | null = null;
  const now = Date.now();

  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const current = (await db
          .prepare("SELECT email, role, org_id, cohort_id, status, expires_at FROM invitations WHERE id = ? AND token_hash = ?")
          .get(inv.id, tokenHash)) as
      | {
          email: string;
          role: string;
          org_id: string;
          cohort_id: string | null;
          status: string;
          expires_at: number | null;
        }
      | undefined;
    if (!current || current.status !== "pending" || !current.expires_at || current.expires_at <= now) {
      throw new Error("invitation_unavailable");
    }
    if (current.role !== "student" && current.role !== "instructor") throw new Error("invitation_unavailable");
    if (current.role === "student" && last && !/^[A-Za-z]\.?$/.test(last)) {
      throw new Error("invalid_last_initial");
    }
    acceptedRole = current.role;
    const email = String(current.email).trim().toLowerCase();
    const name = buildName(first, last, email.split("@")[0]);
    const accountFirst = current.role === "instructor"
      ? (name.split(/\s+/)[0] || name)
      : (first || name.split(/\s+/)[0] || name);
    const existingUser = (await db
          .prepare(
            `SELECT id, role, org_id, status, password_hash
         FROM users
         WHERE lower(email) = lower(?)`,
          )
          .get(email)) as
      | { id: string; role: string; org_id: string; status: string; password_hash: string | null }
      | undefined;
    const claimablePlaceholder =
      existingUser?.status === "invited" &&
      existingUser.password_hash == null &&
      existingUser.role === current.role &&
      existingUser.org_id === current.org_id;
    if (existingUser && !claimablePlaceholder) throw new Error("account_exists");
    if (!(await db.prepare("SELECT 1 FROM organizations WHERE id = ? AND status = 'active'").get(current.org_id))) {
      throw new Error("organization_missing");
    }
    if (current.role === "student") {
      const cohort = current.cohort_id
        ? ((await db.prepare("SELECT org_id, status FROM cohorts WHERE id = ?").get(current.cohort_id)) as
            | { org_id: string; status: string }
            | undefined)
        : undefined;
      if (!cohort || cohort.org_id !== current.org_id || !["active", "enrolling"].includes(cohort.status)) {
        throw new Error("cohort_missing");
      }
    } else {
      const pipelineRows = (await db.prepare(
              `SELECT p.id AS person_id, p.user_id, i.stage
           FROM people p
           JOIN instructors i ON i.person_id = p.id
          WHERE lower(p.email) = lower(?)
            AND i.stage IN ('accepted','onboarding','training','practice_evaluation','eligible','active')
          ORDER BY i.updated_at DESC
          LIMIT 2`,
            ).all(email)) as { person_id: string; user_id: string | null; stage: string }[];
      if (
        current.org_id !== "org-bow"
        || pipelineRows.length !== 1
      ) {
        throw new Error("instructor_approval_missing");
      }
      approvedInstructorPersonId = pipelineRows[0].person_id;
    }

    if (existingUser) {
      userId = existingUser.id;
      const claimed = (await db
              .prepare(
                `UPDATE users
           SET name = ?, first = ?, grade = ?, status = 'active', last = 'Just now',
               signin = 'Email + password', password_hash = ?, last_active_at = ?,
               created_at = COALESCE(created_at, ?)
           WHERE id = ? AND status = 'invited' AND password_hash IS NULL
             AND role = ? AND org_id = ?`,
              )
              .run(name, accountFirst, grade || null, passwordHash, now, now, userId, current.role, current.org_id));
      if (claimed.changes !== 1) throw new Error("account_exists");
    } else {
      (await db.prepare(
                "INSERT INTO users (id, name, first, email, role, org_id, grade, status, last, signin, password_hash, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'Just now', 'Email + password', ?, ?, ?)",
              ).run(userId, name, accountFirst, email, current.role, current.org_id, grade || null, passwordHash, now, now));
    }

    if (current.role === "student" && current.cohort_id) {
      (await db.prepare(
                `INSERT INTO enrollments (user_id, cohort_id, enroll, lesson_status, last, att_last)
         VALUES (?, ?, 'active', 'not-started', 'Just now', 'none')
         ON CONFLICT(user_id, cohort_id) DO UPDATE SET
           enroll = 'active',
           lesson_status = CASE
             WHEN enrollments.lesson_status = 'none' THEN 'not-started'
             ELSE enrollments.lesson_status
           END,
           last = 'Just now'`,
              ).run(userId, current.cohort_id));
    }

    const accepted = (await db
          .prepare("UPDATE invitations SET status = 'accepted' WHERE id = ? AND token_hash = ? AND status = 'pending' AND expires_at > ?")
          .run(inv.id, tokenHash, now));
    if (accepted.changes !== 1) throw new Error("invitation_unavailable");
    (await db.prepare(
            "UPDATE invitations SET status = 'revoked' WHERE id != ? AND lower(email) = lower(?) AND status = 'pending'",
          ).run(inv.id, email));

    // Connect an accepted instructor to an existing hiring record only when
    // the email matches and the Person has not already been claimed.
    if (current.role === "instructor") {
      const person = (await db.prepare("SELECT user_id FROM people WHERE id = ?").get(approvedInstructorPersonId)) as
        | { user_id: string | null }
        | undefined;
      if (!person || (person.user_id !== null && person.user_id !== userId)) {
        throw new Error("instructor_approval_missing");
      }
      if (person.user_id === null) {
        const linked = (await db.prepare(
                  "UPDATE people SET user_id = ?, updated_at = ? WHERE id = ? AND user_id IS NULL",
                ).run(userId, now, approvedInstructorPersonId));
        if (linked.changes !== 1) throw new Error("instructor_approval_missing");
      }
    }
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the original failure.
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "account_exists") {
      return { error: "An account already exists for this email. Sign in or use account recovery instead." };
    }
    if (code === "organization_missing" || code === "cohort_missing") {
      return { error: "This invitation no longer points to an active BOW organization or cohort." };
    }
    if (code === "instructor_approval_missing") {
      return { error: "This instructor invitation is no longer connected to an approved BOW hiring record. Ask the instructor manager for a fresh invitation." };
    }
    if (code === "invalid_last_initial") {
      return { error: "Enter one letter for the student's last initial (a period is optional)." };
    }
    return { error: "This invitation is no longer available. Ask for a fresh one." };
  }

  try {
    await createSession(userId);
  } catch {
    return {
      error: "Your account was created, but BOW could not start a session. Use Sign in, or contact a BOW administrator if your organization is paused.",
    };
  }
  redirect(acceptedRole === "instructor" ? "/app/teach" : roleHomePath(acceptedRole));
}

function buildName(first: string, last: string, fallback: string): string {
  const composed = [first, last].filter(Boolean).join(" ").trim();
  return composed || fallback;
}

/* ---------------- Password recovery ---------------- */

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_RESPONSE_FLOOR_MS = 350;
const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an active BOW account uses that email, we’ll send a password-reset link. Check your inbox and spam folder.";

export interface PasswordResetRequestState {
  message?: string;
  /** Development-only escape hatch, returned only when explicitly enabled. */
  resetUrl?: string;
}

export interface PasswordResetState {
  error?: string;
  ok?: boolean;
}

async function passwordResetRequestResponse(
  startedAt: number,
  extra: Pick<PasswordResetRequestState, "resetUrl"> = {},
): Promise<PasswordResetRequestState> {
  // Once delivery happens after the response, the only meaningful timing
  // difference is a small local database write for a real account. A short,
  // jittered floor keeps that difference from becoming an account oracle; the
  // configured network bucket and real-identity bucket constrain repeat abuse.
  const jitterMs = randomBytes(1)[0] % 101;
  const remainingMs = PASSWORD_RESET_RESPONSE_FLOOR_MS + jitterMs - (Date.now() - startedAt);
  if (remainingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }
  return { message: PASSWORD_RESET_REQUEST_MESSAGE, ...extra };
}

export async function requestPasswordReset(
  _prev: PasswordResetRequestState,
  formData: FormData,
): Promise<PasswordResetRequestState> {
  const startedAt = Date.now();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("auth-password-reset-request-network", address, {
          limit: 10,
          windowMs: 60 * 60 * 1000,
          blockMs: 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return (await passwordResetRequestResponse(startedAt));
  }
  if (email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) {
    return (await passwordResetRequestResponse(startedAt));
  }

  const db = getDb();
  const user = (await db
      .prepare(
        `SELECT u.id, u.email
         FROM users u
         JOIN organizations o ON o.id = u.org_id AND o.status = 'active'
        WHERE lower(u.email) = lower(?) AND u.status = 'active'`,
      )
      .get(email)) as { id: string; email: string } | undefined;
  if (!user) return (await passwordResetRequestResponse(startedAt));

  // Only real identities need a durable per-identity bucket. Recording every
  // random address would let unauthenticated traffic grow the limiter table and
  // is unnecessary now that the public response has a timing floor.
  const identityLimit = (await consumeRateLimit("auth-password-reset-request-identity", email, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }));
  if (!identityLimit.allowed) return (await passwordResetRequestResponse(startedAt));

  let tokenId: string | null = null;
  try {
    const publicOrigin = publicAppOrigin();
    const revealLinks = process.env.NODE_ENV !== "production" && process.env.BOW_REVEAL_RESET_LINKS === "true";
    const linkOrigin = publicOrigin ?? (revealLinks ? developmentAppOrigin() : null);
    if (!linkOrigin) return (await passwordResetRequestResponse(startedAt));

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashOpaqueToken(token);
    const issuedTokenId = `prt-${randomUUID()}`;
    tokenId = issuedTokenId;
    const now = Date.now();
    (await db.exec("BEGIN IMMEDIATE"));
    try {
      const accountStillEligible = (await db.prepare(
              `SELECT 1
           FROM users u
           JOIN organizations o ON o.id = u.org_id AND o.status = 'active'
          WHERE u.id = ? AND u.status = 'active'`,
            ).get(user.id));
      if (!accountStillEligible) throw new Error("reset_unavailable");
      // A new request supersedes every older link for this account. Keeping the
      // invalidation and insert in one write transaction guarantees at most one
      // live reset credential even when requests arrive concurrently.
      (await db.prepare(
                "UPDATE password_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL",
              ).run(now, user.id));
      (await db.prepare(
                `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`,
              ).run(issuedTokenId, user.id, tokenHash, now + PASSWORD_RESET_TTL_MS, now));
      (await db.prepare(
                "DELETE FROM password_reset_tokens WHERE (consumed_at IS NOT NULL OR expires_at <= ?) AND created_at < ?",
              ).run(now, now - 7 * 24 * 60 * 60 * 1000));
      (await db.exec("COMMIT"));
    } catch (error) {
      try {
        (await db.exec("ROLLBACK"));
      } catch {
        // Preserve the issuance failure.
      }
      throw error;
    }

    // Fragments are not sent in HTTP requests or Referer headers, so the bearer
    // token stays out of ordinary access logs. The client moves it into the
    // reset form and immediately cleans the visible URL after hydration.
    const resetUrl = `${linkOrigin}/reset-password#token=${encodeURIComponent(token)}`;
    if (revealLinks) {
      return (await passwordResetRequestResponse(startedAt, { resetUrl }));
    }

    // Next.js 16.2 supports after() for Server Functions on this repository's
    // documented `next start` single-host deployment. This removes Resend's
    // network latency from the enumeration-safe public response.
    after(async () => {
      let delivered = false;
      try {
        const deliveryDb = getDb();
        const stillActive = (await deliveryDb.prepare(
                  `SELECT 1
             FROM password_reset_tokens prt
             JOIN users u ON u.id = prt.user_id AND u.status = 'active'
             JOIN organizations o ON o.id = u.org_id AND o.status = 'active'
            WHERE prt.id = ? AND prt.consumed_at IS NULL AND prt.expires_at > ?`,
                ).get(issuedTokenId, Date.now()));
        // A newer request may have superseded this token while the response was
        // finishing. Do not send a link that is already known to be stale.
        if (!stillActive) return;
        delivered = Boolean(publicOrigin && (await sendTransactionalEmail({
          to: user.email,
          subject: "Reset your BOW Sports Capital password",
          text:
            "A password reset was requested for your BOW Sports Capital account.\n\n" +
            `Reset your password within 30 minutes:\n${resetUrl}\n\n` +
            "If you did not request this, you can ignore this message. Your password has not changed.",
        })));
      } catch {
        // Keep all post-response failures outside the public action result.
      }
      if (!delivered) {
        try {
          // A secret that never reached its owner should not remain a valid
          // bearer credential. A newer request may already have consumed it.
          (await getDb().prepare("DELETE FROM password_reset_tokens WHERE id = ? AND consumed_at IS NULL").run(issuedTokenId));
        } catch {
          // Delivery already failed; keep the post-response task contained.
        }
      }
    });
    return (await passwordResetRequestResponse(startedAt));
  } catch {
    if (tokenId) {
      try {
        (await db.prepare("DELETE FROM password_reset_tokens WHERE id = ? AND consumed_at IS NULL").run(tokenId));
      } catch {
        // Keep the enumeration-safe response even if the database is unavailable.
      }
    }
    return (await passwordResetRequestResponse(startedAt));
  }
}

export async function resetPassword(
  _prev: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = (await consumeRateLimit("auth-password-reset-network", address, {
          limit: 30,
          windowMs: 60 * 60 * 1000,
          blockMs: 60 * 60 * 1000,
        }));
    if (!networkLimit.allowed) return { error: "Too many reset attempts. Wait a few minutes and request a new link." };
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return { error: "This password-reset link is invalid or has expired. Request a new one." };
  }
  if (password.length < 12 || password.length > 256) {
    return { error: "Choose a password between 12 and 256 characters." };
  }
  if (password !== confirm) return { error: "Password and confirmation don’t match." };
  if (isPublicDemoPassword(password)) {
    return { error: "Choose a password that is not the public BOW demo password." };
  }

  const db = getDb();
  const tokenHash = hashOpaqueToken(token);
  const now = Date.now();
  const candidate = (await db
      .prepare(
        `SELECT prt.id, prt.user_id, u.password_hash
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
         JOIN organizations o ON o.id = u.org_id AND o.status = 'active'
        WHERE prt.token_hash = ? AND prt.consumed_at IS NULL AND prt.expires_at > ? AND u.status = 'active'`,
      )
      .get(tokenHash, now)) as { id: string; user_id: string; password_hash: string | null } | undefined;
  if (!candidate) return { error: "This password-reset link is invalid or has expired. Request a new one." };

  // Do not persist one limiter row for every random 43-character guess. Once a
  // live bearer token is proven to exist, its own bucket protects the expensive
  // password-verification and hashing work below.
  const tokenLimit = (await consumeRateLimit("auth-password-reset-token", token, {
      limit: 6,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }));
  if (!tokenLimit.allowed) return { error: "Too many reset attempts. Request a new password-reset link." };

  if (verifyPassword(password, candidate.password_hash)) {
    return { error: "Choose a new password that is different from your current password." };
  }

  const passwordHash = hashPassword(password);
  let resetEmail: string | null = null;
  (await db.exec("BEGIN IMMEDIATE"));
  try {
    const current = (await db
          .prepare(
            `SELECT prt.id, prt.user_id, u.role, u.email, u.password_hash
           FROM password_reset_tokens prt
           JOIN users u ON u.id = prt.user_id
           JOIN organizations o ON o.id = u.org_id AND o.status = 'active'
          WHERE prt.id = ? AND prt.token_hash = ? AND prt.consumed_at IS NULL
            AND prt.expires_at > ? AND u.status = 'active'`,
          )
          .get(candidate.id, tokenHash, Date.now())) as
      | { id: string; user_id: string; role: string; email: string; password_hash: string | null }
      | undefined;
    if (!current || current.user_id !== candidate.user_id || current.password_hash !== candidate.password_hash) {
      throw new Error("reset_unavailable");
    }
    const consumedAt = Date.now();
    const consumed = (await db
          .prepare("UPDATE password_reset_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
          .run(consumedAt, current.id));
    const updated = (await db
          .prepare(
            `UPDATE users
            SET password_hash = ?, password_change_required = 0, signin = 'Email + password'
          WHERE id = ? AND status = 'active' AND password_hash IS ?`,
          )
          .run(passwordHash, current.user_id, current.password_hash));
    if (consumed.changes !== 1 || updated.changes !== 1) throw new Error("reset_unavailable");

    (await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(current.user_id));
    (await db.prepare(
            "UPDATE password_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL",
          ).run(consumedAt, current.user_id));
    (await db.prepare("INSERT INTO activity (id, icon, text, when_label, role) VALUES (?, 'lock', ?, 'Just now', ?)")
            .run(`act-${randomUUID()}`, "Account security: password reset completed and prior sessions revoked.", current.role));
    resetEmail = current.email.trim().toLowerCase();
    (await db.exec("COMMIT"));
  } catch {
    try {
      (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the safe public result below if rollback is already complete.
    }
    return { error: "This password-reset link is invalid or has expired. Request a new one." };
  }

  try {
    (await clearRateLimit("auth-password-reset-token", token));
    if (resetEmail) {
      // Proof of control over the reset token is enough to release stale
      // identity throttles so the owner can sign in with the new password.
      (await clearRateLimit("auth-password-reset-request-identity", resetEmail));
      (await clearRateLimit("auth-login-identity", resetEmail));
    }
  } catch {
    // The credential change is already committed. Throttle cleanup is
    // best-effort and must never turn a successful reset into an error page.
  }
  return { ok: true };
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

  if (current.length > 256 || next.length > 256 || confirm.length > 256) {
    return { error: "Passwords cannot be longer than 256 characters." };
  }
  if (next !== confirm) return { error: "New password and confirmation don't match." };

  const db = getDb();
  const row = (await db
      .prepare("SELECT password_hash, password_change_required FROM users WHERE id = ?")
      .get(me.id)) as { password_hash: string | null; password_change_required: number } | undefined;
  if (!row) return { error: "Your account is no longer available. Sign in again." };

  // The database is the authority for the stronger bootstrap-password policy.
  // A hidden form field is user-controlled and must never be allowed to choose
  // which password policy applies or whether the requirement is cleared.
  const passwordChangeWasRequired = row.password_change_required !== 0;
  const strongerPolicyPassed = next.length >= 12;
  const minimumLength = passwordChangeWasRequired ? 12 : 8;
  if (next.length < minimumLength) return { error: `New password must be at least ${minimumLength} characters.` };
  if (isPublicDemoPassword(next)) return { error: "Choose a password that is not the public BOW demo password." };

  if (!verifyPassword(current, row?.password_hash)) {
    return { error: "Your current password is incorrect." };
  }
  if (verifyPassword(next, row?.password_hash)) {
    return { error: "Choose a new password that is different from the current password." };
  }

  // Scrypt is intentionally completed before taking SQLite's writer lock.
  const passwordHash = hashPassword(next);
  let committedRequirement = row.password_change_required;
  let committedChangeWasRequired = passwordChangeWasRequired;
  try {
    (await db.exec("BEGIN IMMEDIATE"));
    const locked = (await db
          .prepare("SELECT password_hash, password_change_required, status FROM users WHERE id = ?")
          .get(me.id)) as
      | { password_hash: string | null; password_change_required: number; status: string }
      | undefined;
    if (!locked || locked.status !== "active") throw new Error("account_unavailable");
    if (locked.password_hash !== row.password_hash) throw new Error("password_changed");

    // Re-evaluate the database-owned policy under the same lock as the write.
    // This closes the narrow race where another path changes the bootstrap flag
    // after the initial password verification but before the credential update.
    committedChangeWasRequired = locked.password_change_required !== 0;
    const lockedMinimumLength = committedChangeWasRequired ? 12 : 8;
    if (next.length < lockedMinimumLength) throw new Error(`password_policy:${lockedMinimumLength}`);

    const updated = (await db
          .prepare(
            `UPDATE users
         SET password_hash = ?,
             password_change_required = CASE
               WHEN COALESCE(password_change_required, 0) != 0 AND ? = 0 THEN 1
               ELSE 0
             END
         WHERE id = ? AND status = 'active' AND password_hash IS ?
         RETURNING password_change_required`,
          )
          .get(passwordHash, strongerPolicyPassed ? 1 : 0, me.id, locked.password_hash)) as
      | { password_change_required: number }
      | undefined;
    if (!updated) throw new Error("password_changed");

    const committedAt = Date.now();
    (await db.prepare(
            "UPDATE password_reset_tokens SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL",
          ).run(committedAt, me.id));
    (await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(me.id));
    committedRequirement = updated.password_change_required;
    (await db.exec("COMMIT"));
  } catch (error) {
    try {
      if (db.isTransaction) (await db.exec("ROLLBACK"));
    } catch {
      // Preserve the safe public error selected below.
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "account_unavailable") {
      return { error: "Your account is no longer available. Sign in again." };
    }
    if (code === "password_changed") {
      return { error: "Your password changed in another session. Refresh and try again." };
    }
    if (code.startsWith("password_policy:")) {
      const lockedMinimumLength = Number(code.split(":")[1]) || 12;
      return { error: `New password must be at least ${lockedMinimumLength} characters.` };
    }
    return { error: "We couldn't change your password. Refresh and try again." };
  }

  // Session rows are already revoked. Cookie mutation and the replacement
  // session happen after COMMIT so neither request APIs nor createSession's own
  // writer transaction can nest inside the credential transaction.
  await destroySession();
  await createSession(me.id);
  if (committedRequirement !== 0) redirect("/change-password");
  if (committedChangeWasRequired) redirect("/app");
  return { ok: true };
}
