import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Instructors",
  description: "The instructor pipeline — applications, onboarding, training, and eligibility.",
  robots: { index: false, follow: false },
};

export default async function InstructorsLayout({ children }: { children: React.ReactNode }) {
  // Authoritative role check — app/app/layout.tsx only verifies the session,
  // not the role, so every nested route group re-checks here.
  await requireStaff();
  return <>{children}</>;
}
