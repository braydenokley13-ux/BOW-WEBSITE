import { requireRole } from "@/lib/dal";
import { getDailyQuestionView } from "@/lib/daily-question";
import { loadStudentHome } from "@/lib/learn/home";
import { getXPLeaderboard, getStudentRank, getStudentLeaderboardRow } from "@/lib/leaderboard";
import { getStudentProgram } from "@/lib/student-program";
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

  const orgScope = me.orgId ?? null;

  const [home, dailyQuestion, top5, myRank, program] = await Promise.all([
    loadStudentHome(me.id, me.first),
    getDailyQuestionView(me.id),
    getXPLeaderboard(orgScope),
    getStudentRank(me.id, "xp", orgScope),
    // A student enrolled in a real class needs to see it before the Playbook.
    // Self-paced-only learners have none; the band is simply not rendered.
    getStudentProgram(me.id).catch(() => null),
  ]);
  const top5Rows = top5.slice(0, 5);
  // Only fetch the viewer's own row when they're not already visible in the
  // top 5 shown on the tile — keeps this compact, links to /leaderboard for
  // the full board (plan: competition stays clean, doesn't overwhelm the
  // main UI).
  const myRow = myRank > 0 && myRank > 5 ? (await getStudentLeaderboardRow(me.id, "xp", orgScope)) : null;

  return (
    <StudentHome
      firstName={me.first}
      home={home}
      dailyQuestion={dailyQuestion}
      leaderboard={{ top5: top5Rows, myRank, myRow }}
      program={program}
    />
  );
}
