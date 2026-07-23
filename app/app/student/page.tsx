import { redirect } from "next/navigation";

/**
 * Stage 2: student cutover is permanent. /app/student always redirects to
 * /dashboard. LegacyStudentHome is kept on disk (unused) until Stage 9's
 * dedicated deletion pass.
 */
export default function StudentHomeEntry() {
  redirect("/dashboard");
}
