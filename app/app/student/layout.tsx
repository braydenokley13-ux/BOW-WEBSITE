import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Student · Front Office",
  description: "Your track, your next lesson, and your progress.",
  robots: { index: false, follow: false },
};

export default async function AppStudentLayout({ children }: { children: React.ReactNode }) {
  // Authoritative role check — app/app/layout.tsx only verifies the session,
  // not the role, so every nested route group re-checks here.
  await requireRole("student");
  return <>{children}</>;
}
