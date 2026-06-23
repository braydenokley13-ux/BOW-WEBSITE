import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "BOW Leaderboard",
  description: "The top BOW students by BOW Score — modules, quiz, BOW Daily, reflections, certificate, and the Simulation Room.",
  robots: { index: false, follow: false },
};

export default async function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  // Any signed-in user (student, instructor, admin) can view the leaderboard.
  await requireUser();
  return <>{children}</>;
}
