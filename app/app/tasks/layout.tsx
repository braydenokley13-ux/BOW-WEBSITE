import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Tasks · BOW HQ",
  description: "Follow-ups and founder handoffs across the pipeline.",
  robots: { index: false, follow: false },
};

export default async function TasksLayout({ children }: { children: React.ReactNode }) {
  // Authoritative role check — app/app/layout.tsx only verifies the session,
  // not the role, so every nested route group re-checks here.
  await requireStaff();
  return <>{children}</>;
}
