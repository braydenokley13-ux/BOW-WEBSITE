import type { Metadata } from "next";
import { requireTeachingUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Instructor · Front Office",
  description: "Review Cohorts and enter assigned Classes for scheduled-session delivery.",
  robots: { index: false, follow: false },
};

export default async function AppInstructorLayout({ children }: { children: React.ReactNode }) {
  // Authoritative role check — app/app/layout.tsx only verifies the session,
  // not the role, so every nested route group re-checks here.
  await requireTeachingUser();
  return <>{children}</>;
}
