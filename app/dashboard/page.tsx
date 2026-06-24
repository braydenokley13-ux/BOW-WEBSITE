import { requireRole } from "@/lib/dal";
import {
  getSelfModuleViews,
  getQuizModuleSections,
  getActiveScenario,
  getScenarioArchive,
  hasCertificate,
} from "@/lib/self-paced";
import { getCurrentWeeklyChallenge, getPastWeeklyChallenges, ensureWeeklyChallengeNotification } from "@/lib/weekly";
import { getNotifications, getUnreadCount } from "@/lib/notifications";
import { getDailyQuestionView } from "@/lib/daily-question";
import { getStreak, streakLabel, getUserXp } from "@/lib/streak";
import { rankForStudent } from "@/lib/scoring";
import { TRACK_101, TRACK_201 } from "@/lib/account";
import StudentDashboard from "@/components/selfpaced/StudentDashboard";

export default async function DashboardPage() {
  const me = await requireRole("student");
  // Make sure this week's challenge has surfaced a notification (idempotent).
  ensureWeeklyChallengeNotification(me.id);

  // Everything is read live from SQLite — no static data.
  const track101 = {
    modules: getSelfModuleViews(me.id, TRACK_101),
    quizSections: getQuizModuleSections(me.id, TRACK_101),
    certificateEarned: hasCertificate(me.id, TRACK_101),
  };
  const track201 = {
    modules: getSelfModuleViews(me.id, TRACK_201),
    quizSections: getQuizModuleSections(me.id, TRACK_201),
    certificateEarned: hasCertificate(me.id, TRACK_201),
  };

  const streak = getStreak(me.id);
  const rank = rankForStudent(me.id);

  return (
    <StudentDashboard
      firstName={me.first}
      track101={track101}
      track201={track201}
      dailyQuestion={getDailyQuestionView(me.id)}
      streak={{ current: streak.current, longest: streak.longest, label: streakLabel(streak.current) }}
      xp={getUserXp(me.id)}
      rankName={rank.name}
      rankKey={rank.key}
      activeScenario={getActiveScenario(me.id)}
      scenarioArchive={getScenarioArchive(me.id)}
      weeklyCurrent={getCurrentWeeklyChallenge(me.id)}
      weeklyPast={getPastWeeklyChallenges(me.id)}
      notifications={getNotifications(me.id, 10)}
      unreadCount={getUnreadCount(me.id)}
    />
  );
}
