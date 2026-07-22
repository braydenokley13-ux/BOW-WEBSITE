"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { roleHomePath, SELF_PACED_COHORT_ID, type Role } from "@/lib/account-identity";
import { clearRateLimit, clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";

export interface SignInState {
  error?: string;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };
  if (password.length > 256) return { error: "That email and password don't match an account." };

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

  // Use the same work and public error for unknown emails and bad passwords.
  const passwordMatches = verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) return { error: "That email and password don't match an account." };
  if (user.status === "suspended") return { error: "This account is suspended. Contact your BOW administrator." };
  if (user.status === "invited") return { error: "Finish setting up your account from your invitation link first." };

  try {
    await createSession(user.id);
  } catch {
    return { error: "Sign-in is unavailable for this account or organization. Contact your BOW administrator." };
  }
  await clearRateLimit("auth-login-identity", email);

  if (user.password_change_required) redirect("/change-password");

  let destination: string;
  if (next && (next.startsWith("/app") || next === "/dashboard" || next === "/instructor")) {
    destination = next;
  } else if (user.role === "student") {
    const selfPacedEnrollment = await db
      .prepare("SELECT 1 FROM enrollments WHERE user_id = ? AND cohort_id = ? AND enroll = 'active'")
      .get(user.id, SELF_PACED_COHORT_ID);
    destination = selfPacedEnrollment ? "/dashboard" : roleHomePath("student");
  } else {
    destination = roleHomePath(user.role as Role);
  }
  redirect(destination);
}
