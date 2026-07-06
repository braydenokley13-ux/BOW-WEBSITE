import { requireRole } from "@/lib/dal";
import {
  getSelfModuleViews,
  getQuizModuleSections,
  getActiveScenario,
  getScenarioArchive,
  hasCertificate,
  isEnrolledInCohortClass,
} from "@/lib/self-paced";
import { getCurrentWeeklyChallenge, getPastWeeklyChallenges, ensureWeeklyChallengeNotification } from "@/lib/weekly";
import { getNotifications, getUnreadCount } from "@/lib/notifications";
import { getDailyQuestionView } from "@/lib/daily-question";
import { getStreak, streakLabel, getUserXp } from "@/lib/streak";
import { rankForStudent } from "@/lib/scoring";
import { TRACK_101, TRACK_201 } from "@/lib/account";
import { getAnalyticsPlayers } from "@/lib/nba";
import StudentDashboard from "@/components/selfpaced/StudentDashboard";
import FrontOfficeLab from "@/components/selfpaced/FrontOfficeLab";

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

  // Front Office Lab: the same live model the research desk runs, on one
  // real contract. Biggest cap hit on the tracked list = the deal every
  // student has an instinct about, which is what the exercise needs.
  const labPlayers = getAnalyticsPlayers();
  const labPlayer = labPlayers.reduce<(typeof labPlayers)[number] | null>(
    (best, p) => (best === null || p.capHit > best.capHit ? p : best),
    null,
  );

  return (
    <>
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
      alsoInCohortClass={isEnrolledInCohortClass(me.id)}
      />
      {labPlayer && (
        <div style={{ padding: "0 clamp(16px,4vw,32px) clamp(28px,4vw,48px)" }}>
          <div style={{ maxWidth: 1060, margin: "0 auto" }}>
            <FrontOfficeLab player={labPlayer} allPlayers={labPlayers} />
          </div>
        </div>
      )}
    </>
  );
}
