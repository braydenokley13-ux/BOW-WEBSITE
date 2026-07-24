import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Programs",
  description: "Program planning, launch readiness, delivery, completion, and renewal.",
  robots: { index: false, follow: false },
};

export default async function ProgramsLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
