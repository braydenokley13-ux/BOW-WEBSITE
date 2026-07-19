import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Regions · BOW HQ",
  description: "Regional leadership, Location portfolios, lifecycle, and expansion visibility.",
  robots: { index: false, follow: false },
};

export default async function RegionsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}

