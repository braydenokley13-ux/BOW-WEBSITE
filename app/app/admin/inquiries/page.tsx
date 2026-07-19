import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";

export default async function AdminInquiriesPage() {
  await requireRole("admin");
  redirect("/app/inquiries");
}
