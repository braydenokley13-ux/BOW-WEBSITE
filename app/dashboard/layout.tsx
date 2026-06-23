import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Your Dashboard",
  description: "Your self-paced Track 101 — modules, reflections, progress, and your BOW Daily briefing.",
  // The student dashboard is private; keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Authoritative role check (the proxy only does an optimistic cookie check).
  // Non-students are redirected to the front office; signed-out users to sign-in.
  await requireRole("student");
  return <>{children}</>;
}
