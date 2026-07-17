import type { Metadata } from "next";
import { requireInstructorSelf } from "@/lib/dal";

export const metadata: Metadata = {
  title: "My Onboarding & Training · BOW",
  description: "Onboarding checklist, training modules, sessions, and practice evaluation status.",
  robots: { index: false, follow: false },
};

export default async function TeachLayout({ children }: { children: React.ReactNode }) {
  // requireInstructorSelf resolves people.user_id -> instructors row and
  // redirects to /app for anyone without one — including existing LMS-only
  // instructor seeds (e.g. u-coach) who have no BOW HQ instructor record.
  // This is the security boundary for /app/teach, not just a UX nicety.
  await requireInstructorSelf();
  return <>{children}</>;
}
