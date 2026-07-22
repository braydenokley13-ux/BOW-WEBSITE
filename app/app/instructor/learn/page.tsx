import Link from "next/link";
import { requireTeachingUser } from "@/lib/dal";
import { loadInstructorCohorts, loadCohortRoster, loadReleasableMapNodes } from "@/lib/learn/instructorConsole";
import CohortRoster from "@/components/learn/instructor/CohortRoster";

export const metadata = {
  title: "Cohort Console · BOW HQ",
  description: "Per-student lesson status, scores, and release controls for your cohorts.",
  robots: { index: false, follow: false },
};

export default async function InstructorLearnConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const user = await requireTeachingUser();
  const { cohort: cohortParam } = await searchParams;

  const cohorts = await loadInstructorCohorts(user.id);
  const activeCohort = cohorts.find((c) => c.id === cohortParam) ?? cohorts[0];

  const [students, releasableNodes] = activeCohort
    ? await Promise.all([loadCohortRoster(activeCohort.id), loadReleasableMapNodes()])
    : [[], []];

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,40px)", textTransform: "uppercase", color: "var(--bow-ink)" }}>
            Cohort console
          </h1>
          <Link href="/app/instructor/learn/review" style={{ fontFamily: "var(--font-data)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bow-blue)", textDecoration: "none" }}>
            Reflection review queue →
          </Link>
        </div>
        <p style={{ margin: "0 0 20px", color: "var(--bow-slate)" }}>
          Playbook Engine attempt data (learn_attempts / learn_lesson_mastery / learn_assignment_progress) — the new
          platform&rsquo;s replacement for the legacy cohort pacing view.
        </p>

        {cohorts.length === 0 ? (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24 }}>
            <p style={{ margin: 0, color: "var(--bow-slate)" }}>You aren&rsquo;t assigned as instructor of any cohort yet.</p>
          </div>
        ) : (
          <>
            {cohorts.length > 1 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
                {cohorts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/app/instructor/learn?cohort=${c.id}`}
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "8px 14px",
                      borderRadius: 4,
                      textDecoration: "none",
                      border: "1px solid var(--border-rule)",
                      background: c.id === activeCohort?.id ? "var(--bow-ink)" : "var(--bow-white)",
                      color: c.id === activeCohort?.id ? "#fff" : "var(--bow-ink)",
                    }}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
            {activeCohort && <CohortRoster cohortId={activeCohort.id} students={students} releasableNodes={releasableNodes} />}
          </>
        )}
      </div>
    </div>
  );
}
