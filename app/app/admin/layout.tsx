import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Admin · Front Office",
  description: "Platform administration — cohorts, organizations, invitations, and people.",
  robots: { index: false, follow: false },
};

export default async function AppAdminLayout({ children }: { children: React.ReactNode }) {
  // Authoritative role check — app/app/layout.tsx only verifies the session,
  // not the role, so every nested route group re-checks here.
  await requireRole("admin");
  return <>{children}</>;
}
