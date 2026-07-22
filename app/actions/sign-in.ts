"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";
import { migrateLegacyPasswordOnSignIn } from "@/lib/supabase/auth-helpers";
import { getSessionUser } from "@/lib/session";
import { roleHomePath, SELF_PACED_COHORT_ID, type Role } from "@/lib/account-identity";
import { clearRateLimit, clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";

export interface SignInState {
  error?: string;
}

const INVALID_CREDENTIALS_ERROR = "That email and password don't match an account.";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };
  if (password.length > 256) return { error: INVALID_CREDENTIALS_ERROR };

  const address = await clientAddressBucket();
  if (address) {
    const networkLimit = await consumeRateLimit("auth-login-network", address, {
      limit: 40,
      windowMs: 15 * 60 * 1000,
      blockMs: 15 * 60 * 1000,
    });
    if (!networkLimit.allowed) return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }
  const identityLimit = await consumeRateLimit("auth-login-identity", email, {
    limit: 8,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });
  if (!identityLimit.allowed) return { error: "Too many sign-in attempts. Wait a few minutes and try again." };

  const db = getDb();
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const user = (await db.prepare("SELECT * FROM users WHERE email = ?").get(email)) as any;

  const supabase = await createClient();

  if (!user) {
    // Do the same shape of work as a real account so unknown emails and bad
    // passwords take the same time. There is no Supabase identity to try.
    verifyPassword(password, DUMMY_PASSWORD_HASH);
    return { error: INVALID_CREDENTIALS_ERROR };
  }

  let { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    // Zero-friction migration: a legacy scrypt account that has never signed
    // in through Supabase Auth. If the submitted password matches the old
    // hash, provision a linked Supabase identity with it and retry once.
    const migrated = await migrateLegacyPasswordOnSignIn(user, password);
    if (migrated) {
      ({ error: signInError } = await supabase.auth.signInWithPassword({ email, password }));
    }
  }
  if (signInError) return { error: INVALID_CREDENTIALS_ERROR };

  if (user.status === "suspended") {
    await supabase.auth.signOut();
    return { error: "This account is suspended. Contact your BOW administrator." };
  }
  if (user.status === "invited") {
    await supabase.auth.signOut();
    return { error: "Finish setting up your account from your invitation link first." };
  }

  // Re-resolve through the same invariant enforcement every other request
  // uses (active user, active organization, auth_user_id backfill).
  const appUser = await getSessionUser();
  if (!appUser) {
    return { error: "Sign-in is unavailable for this account or organization. Contact your BOW administrator." };
  }

  await clearRateLimit("auth-login-identity", email);

  if (appUser.passwordChangeRequired) redirect("/change-password");

  let destination: string;
  if (next && (next.startsWith("/app") || next === "/dashboard" || next === "/instructor")) {
    destination = next;
  } else if (appUser.role === "student") {
    const selfPacedEnrollment = await db
      .prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND cohort_id = ? AND enroll = 'active'")
      .get(appUser.id, SELF_PACED_COHORT_ID);
    destination = selfPacedEnrollment ? "/dashboard" : roleHomePath("student");
  } else {
    destination = roleHomePath(appUser.role as Role);
  }
  redirect(destination);
}
