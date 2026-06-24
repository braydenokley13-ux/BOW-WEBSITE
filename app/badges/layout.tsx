import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Your Achievements · BOW Sports Capital",
  description: "Badges you've earned answering the BOW Daily Question — streaks, accuracy, difficulty, and more.",
  robots: { index: false, follow: false },
};

export default async function BadgesLayout({ children }: { children: React.ReactNode }) {
  // Student-only — answering the Daily Question is a student feature.
  await requireRole("student");
  return <>{children}</>;
}
