import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";

export const metadata: Metadata = {
  title: "All inquiries",
  description: "Qualify public demand and turn it into owned Program work.",
  robots: { index: false, follow: false },
};

export default async function InquiriesLayout({ children }: { children: React.ReactNode }) {
  await requireStaff();
  return <>{children}</>;
}
