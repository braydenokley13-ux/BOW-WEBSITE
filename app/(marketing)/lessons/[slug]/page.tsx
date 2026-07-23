import { redirect } from "next/navigation";

/**
 * Launch-pass curriculum safety: individual lesson detail (full evidence,
 * decision options, learning outcomes) is not a public surface. The
 * underlying content (lib/lessons.ts) is untouched and still powers the
 * curated Track pages and the authenticated student portal.
 */
export default function LessonDetailPage() {
  redirect("/programs");
}
