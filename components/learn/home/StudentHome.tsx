import Link from "next/link";
import type { StudentHomeData } from "@/lib/learn/home";
import type { DailyQuestionView } from "@/lib/daily-question";
import DailyQuestionCard from "@/components/selfpaced/DailyQuestionCard";
import IdentityPanel from "@/components/learn/home/IdentityPanel";
import CareerMap from "@/components/learn/home/CareerMap";
import ProgramBand from "@/components/learn/home/ProgramBand";
import type { StudentProgram } from "@/lib/student-program";
import LeaderboardTile, { type LeaderboardTileProps } from "@/components/learn/home/LeaderboardTile";

interface Props {
  firstName: string;
  home: StudentHomeData;
  dailyQuestion: DailyQuestionView | null;
  /** The student's real-world class, when they are enrolled in one. */
  program?: StudentProgram | null;
  leaderboard: LeaderboardTileProps;
}

function ContinueCard({ home }: { home: StudentHomeData }) {
  const t = home.continueTarget;

  if (t.kind === "none") {
    return (
      <div
        style={{
          background: "var(--bow-ink)",
          color: "var(--bow-paper)",
          borderRadius: 18,
          padding: "clamp(24px,4vw,40px)",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.7 }}>
          Career Map
        </div>
        <h2 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,4vw,34px)", textTransform: "uppercase" }}>
          You&apos;re all caught up
        </h2>
        <p style={{ margin: "8px 0 0", opacity: 0.8, fontFamily: "var(--font-interface)" }}>
          Every unlocked lesson is complete. Check back for new drops, or replay a lesson to push your score higher.
        </p>
      </div>
    );
  }

  const eyebrow = t.moduleTitle ? t.moduleTitle : t.kind === "resume" ? "Continue" : "Next Up";
  const cta = t.kind === "resume" ? "Resume Lesson" : "Start Lesson";

  return (
    <Link href={t.lessonId ? `/dashboard/lesson/${t.lessonId}` : "#"} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "var(--bow-ink)",
          color: "var(--bow-paper)",
          borderRadius: 18,
          padding: "clamp(24px,4vw,40px)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          cursor: "pointer",
          border: "2px solid var(--bow-orange)",
        }}
      >
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          {eyebrow}
        </span>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,5vw,44px)", lineHeight: 0.98, textTransform: "uppercase" }}>
          {t.title}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {t.estMinutesRemaining != null && (
            <span style={{ fontFamily: "var(--font-data)", fontSize: 13, opacity: 0.8 }}>
              ~{t.estMinutesRemaining} min {t.kind === "resume" ? "left" : ""}
            </span>
          )}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bow-orange)",
              color: "#fff",
              fontFamily: "var(--font-data)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderRadius: 999,
              padding: "10px 20px",
            }}
          >
            {cta} →
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function StudentHome({ firstName, home, dailyQuestion, leaderboard, program }: Props) {
  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            Career Home · BOW Sports Capital
          </span>
          <h1 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4.5vw,44px)", lineHeight: 0.96, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
            Welcome back, {firstName}.
          </h1>
        </div>

        {program ? (
          <div style={{ marginBottom: 24 }}>
            <ProgramBand program={program} />
          </div>
        ) : null}

        <div style={{ marginBottom: 28 }}>
          <ContinueCard home={home} />
        </div>

        <div className="bow-student-home-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(280px,340px)", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            <DailyQuestionCard view={dailyQuestion} streakCurrent={home.identity.streak.current} />
            <div>
              <h2 style={{ margin: "0 0 14px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(20px,3vw,28px)", textTransform: "uppercase", color: "var(--bow-ink)" }}>
                Career Map
              </h2>
              <CareerMap sections={home.sections} />
            </div>
          </div>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            <IdentityPanel identity={home.identity} />
            <LeaderboardTile {...leaderboard} />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .bow-student-home-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
