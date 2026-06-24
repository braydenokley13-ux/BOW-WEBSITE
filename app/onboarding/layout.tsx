import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Welcome to BOW",
  description: "Your first-time setup for BOW Sports Capital.",
  // Onboarding is private; keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Authoritative role check (the proxy only does an optimistic cookie check).
  // Non-students go to the front office; signed-out users to sign-in.
  const me = await requireRole("student");

  // Once a student has finished onboarding it never shows again — send them
  // straight to their dashboard.
  if (me.onboardingCompleted) redirect("/dashboard");

  return <>{children}</>;
}
