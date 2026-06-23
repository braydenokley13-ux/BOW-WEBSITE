import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "BOW Admin",
  description: "Platform administration — students, cohorts, content, and platform health.",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Admin only — everyone else is sent to their student dashboard.
  const me = await requireUser();
  if (me.role !== "admin") redirect("/dashboard");
  return <>{children}</>;
}
