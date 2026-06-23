import { requireRole } from "@/lib/dal";
import { getSelfRoster, getSelfModules } from "@/lib/self-paced";
import { getCohortAnalytics } from "@/lib/analytics";
import { getLeaderboard } from "@/lib/scoring";
import { SELF_PACED_COHORT_ID, SELF_PACED_COHORT_NAME, SELF_PACED_SESSIONS } from "@/lib/account";
import InstructorDashboard from "@/components/selfpaced/InstructorDashboard";

export default async function InstructorPage() {
  const me = await requireRole("instructor", "admin");
  // Live roster, analytics, and cohort leaderboard from SQLite — no static data.
  const roster = getSelfRoster(SELF_PACED_COHORT_ID);
  const modules = getSelfModules();
  const analytics = getCohortAnalytics(SELF_PACED_COHORT_ID);
  const leaderboard = getLeaderboard({ cohortId: SELF_PACED_COHORT_ID });

  return (
    <InstructorDashboard
      instructorName={me.name}
      cohortName={SELF_PACED_COHORT_NAME}
      roster={roster}
      modules={modules}
      sessions={SELF_PACED_SESSIONS}
      analytics={analytics}
      leaderboard={leaderboard}
    />
  );
}
