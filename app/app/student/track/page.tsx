import { redirect } from "next/navigation";

/**
 * Stage 2: student cutover is permanent. /app/student/track always
 * redirects to /dashboard. LegacyStudentTrack is kept on disk (unused)
 * until Stage 9's dedicated deletion pass.
 */
export default function StudentTrackEntry() {
  redirect("/dashboard");
}
