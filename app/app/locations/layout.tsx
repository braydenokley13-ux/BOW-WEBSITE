import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Locations",
  description: "Market readiness, local leadership, partner demand, instructor supply, and Programs by Location.",
  robots: { index: false, follow: false },
};

export default async function LocationsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
