import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { startAttempt } from "@/app/actions/learn-play";
import LessonPlayer from "@/components/learn/player/LessonPlayer";

/*
 * Stage 2 routing note: the plan's §3/§6 text names `app/app/dashboard/lesson/…`,
 * but `app/app/dashboard` does not exist in this repo — `app/app/*` is the
 * cohort/staff portal (student cohort pages live at `app/app/student/*`),
 * while the self-paced gamified dashboard the plan actually targets
 * ("`/app/dashboard`, `components/selfpaced/*`") is `app/dashboard/page.tsx`.
 * Lesson play routes are placed as siblings of that real dashboard.
 */
export default async function LessonPlayPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  await requireRole("student", "admin");

  const result = await startAttempt(lessonId, "play");
  if (!result.ok) {
    redirect("/dashboard");
  }

  return <LessonPlayer lessonId={lessonId} attemptId={result.attemptId} doc={result.doc} resume={result.resume} />;
}
