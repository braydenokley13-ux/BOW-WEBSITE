import { redirect } from "next/navigation";

/**
 * Stage 2: student cutover is permanent. Legacy lesson ids don't map 1:1
 * to learn_lessons rows and the legacy page read its target lesson from
 * client-side AppState (no server-visible id to translate), so every
 * legacy lesson deep link redirects to /dashboard, where StudentHome's
 * Continue card and CareerMap resolve the correct lesson. LegacyStudentLesson
 * is kept on disk (unused) until Stage 9's dedicated deletion pass.
 */
export default function StudentLessonEntry() {
  redirect("/dashboard");
}
