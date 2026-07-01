import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Instructor · Front Office",
  description: "Run your cohort — today's session, roster, and lesson plans.",
  robots: { index: false, follow: false },
};

export default async function AppInstructorLayout({ children }: { children: React.ReactNode }) {
  // Authoritative role check — app/app/layout.tsx only verifies the session,
  // not the role, so every nested route group re-checks here.
  await requireRole("instructor", "admin");
  return <>{children}</>;
}
