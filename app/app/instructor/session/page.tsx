import { redirect } from "next/navigation";
import { requireTeachingUser } from "@/lib/dal";

/**
 * Compatibility boundary for bookmarks created before Class sessions became
 * the single delivery record. The parent layout still enforces teaching
 * eligibility before this redirect runs.
 */
export default async function LegacyInstructorSessionPage() {
  const user = await requireTeachingUser();
  redirect(user.role === "admin" ? "/app/classes" : "/app/teach/classes");
}
