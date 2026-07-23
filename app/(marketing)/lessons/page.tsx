import { redirect } from "next/navigation";

/**
 * Launch-pass curriculum safety: the full lesson-by-lesson library is not a
 * public surface. Programs are the public entry point; curriculum detail
 * stays inside curated Track pages and the authenticated student portal.
 * The underlying content (lib/lessons.ts, CurriculumExplorer) is untouched.
 */
export default function LessonsPage() {
  redirect("/programs");
}
