import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Instructor · Self-Paced Roster",
  description: "Manage your self-paced students — modules, reflections, notes, attendance, and email.",
  robots: { index: false, follow: false },
};

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  // Authoritative role check (the proxy only does an optimistic cookie check).
  await requireRole("instructor", "admin");
  return <>{children}</>;
}
