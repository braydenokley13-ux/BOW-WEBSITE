import { requireTeachingUser } from "@/lib/dal";
import { getSelfRoster, getSelfModules, isInstructorOfSelfPaced } from "@/lib/self-paced";
import { getCohortAnalytics } from "@/lib/analytics";
import { getLeaderboard } from "@/lib/scoring";
import { SELF_PACED_COHORT_ID, SELF_PACED_COHORT_NAME, SELF_PACED_SESSIONS } from "@/lib/account";
import InstructorDashboard from "@/components/selfpaced/InstructorDashboard";

export default async function InstructorPage() {
  const me = await requireTeachingUser();
  // Admins can view any cohort; an instructor must actually be assigned to
  // the self-paced cohort — otherwise this page would leak every self-paced
  // student's roster, reflections, and notes to any instructor account.
  if (me.role === "instructor" && !isInstructorOfSelfPaced(me.id)) {
    return (
      <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 28 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>
            You&apos;re not assigned to the self-paced cohort. A BOW administrator can assign you if this is your class.
          </p>
        </div>
      </div>
    );
  }
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
