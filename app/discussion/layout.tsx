import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Discussion",
  description: "Debate front-office moves, spot economics in the wild, and get help on course content with the BOW community.",
  robots: { index: false, follow: false },
};

export default async function DiscussionLayout({ children }: { children: React.ReactNode }) {
  // Any signed-in user (student, instructor, admin) can view the discussion board.
  await requireUser();
  return <>{children}</>;
}
