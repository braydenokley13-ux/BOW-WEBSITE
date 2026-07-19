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
  (await ensureWeeklyChallengeNotification(me.id));

  // Everything is read live from SQLite — no static data.
  const track101 = {
    modules: (await getSelfModuleViews(me.id, TRACK_101)),
    quizSections: (await getQuizModuleSections(me.id, TRACK_101)),
    certificateEarned: (await hasCertificate(me.id, TRACK_101)),
  };
  const track201 = {
    modules: (await getSelfModuleViews(me.id, TRACK_201)),
    quizSections: (await getQuizModuleSections(me.id, TRACK_201)),
    certificateEarned: (await hasCertificate(me.id, TRACK_201)),
  };

  const streak = (await getStreak(me.id));
  const rank = (await rankForStudent(me.id));

  // Front Office Lab: the same live model the research desk runs, on one
  // real contract. Biggest cap hit on the tracked list = the deal every
  // student has an instinct about, which is what the exercise needs.
  const labPlayers = (await getAnalyticsPlayers());
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
      dailyQuestion={(await getDailyQuestionView(me.id))}
      streak={{ current: streak.current, longest: streak.longest, label: streakLabel(streak.current) }}
      xp={(await getUserXp(me.id))}
      rankName={rank.name}
      rankKey={rank.key}
      activeScenario={(await getActiveScenario(me.id))}
      scenarioArchive={(await getScenarioArchive(me.id))}
      weeklyCurrent={(await getCurrentWeeklyChallenge(me.id))}
      weeklyPast={(await getPastWeeklyChallenges(me.id))}
      notifications={(await getNotifications(me.id, 10))}
      unreadCount={(await getUnreadCount(me.id))}
      alsoInCohortClass={(await isEnrolledInCohortClass(me.id))}
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
