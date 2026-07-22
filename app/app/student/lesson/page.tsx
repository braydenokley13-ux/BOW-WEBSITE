import { redirect } from "next/navigation";
import { getLearnCutoverEnabled } from "@/lib/learn/cutover";
import LegacyStudentLesson from "./LegacyStudentLesson";

/**
 * Stage 11 cutover. Legacy lesson ids (lib/lessons.ts) do not map 1:1 to the
 * new learn_lessons rows (see docs/learn/stage10-migration.md's slug
 * mapping) — a legacy lesson id can correspond to zero, one, or more
 * redesigned lessons depending on curriculum split/merge decisions made
 * during the Stage 10 import, and the legacy page reads its target lesson
 * from client-side AppState rather than a URL param, so there is no
 * server-visible id to translate at redirect time anyway. Rather than
 * guess, every legacy lesson deep link sends the student to /dashboard,
 * where StudentHome's Continue card and CareerMap resolve the correct
 * next/in-progress lesson on the new platform.
 */
export default async function StudentLessonEntry() {
  if (await getLearnCutoverEnabled()) redirect("/dashboard");
  return <LegacyStudentLesson />;
}
