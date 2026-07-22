import { requireRole } from "@/lib/dal";
import { getDailyQuestionView } from "@/lib/daily-question";
import { loadStudentHome } from "@/lib/learn/home";
import StudentHome from "@/components/learn/home/StudentHome";

/**
 * Stage 7: student home, replaced per plan §5/§6 — dominant ContinueCard +
 * IdentityPanel + CareerMap, with DailyQuestionCard kept as a secondary
 * tile (same data path, components/selfpaced/DailyQuestionCard unchanged).
 * The former StudentDashboard content (track/module progress, weekly
 * challenge, discussion scenarios, Front Office Lab) is legacy-surface
 * content slated for Stage 8/11 parity + cutover, not deleted — still
 * reachable at /app/student and via the nav links StudentDashboard itself
 * exposed. See docs/learn/stage7-progression.md for the cutover note.
 */
export default async function DashboardPage() {
  const me = await requireRole("student");

  const [home, dailyQuestion] = await Promise.all([
    loadStudentHome(me.id, me.first),
    getDailyQuestionView(me.id),
  ]);

  return <StudentHome firstName={me.first} home={home} dailyQuestion={dailyQuestion} />;
}
