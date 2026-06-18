import type { Metadata } from "next";
import { DataStrip } from "@/components/ds";
import type { DataItem } from "@/components/ds";
import CurriculumExplorer from "@/components/site/CurriculumExplorer";
import { lessons } from "@/lib/lessons";

export const metadata: Metadata = {
  title: "Lessons — Curriculum Explorer | BOW Sports Capital",
  description:
    "Browse the BOW front office one case at a time. Step into a role, review the evidence, make the call, and live with the tradeoff.",
};

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

const statTracks = uniq(lessons.map((l) => l.track)).length;
const statModules = uniq(lessons.map((l) => `${l.track}-${l.moduleNumber}`)).length;
const statLessons = lessons.length;
const statSims = lessons.filter((l) => l.simulationStatus === "available").length;
const statDev = lessons.filter((l) => l.status === "coming-soon" || l.status === "in-development").length;

const explorerStats: DataItem[] = [
  { value: String(statTracks), label: "Active Tracks" },
  { value: String(statModules), label: "Modules" },
  { value: String(statLessons), label: "Lessons" },
  { value: String(statSims), label: "Playable Sims" },
  { value: String(statDev), label: "In Development" },
];

export default function LessonsPage() {
  return (
    <div data-screen-label="Lessons · Curriculum Explorer">
      {/* opener */}
      <section
        style={{
          background: "var(--bow-ink)",
          color: "#fff",
          padding: "clamp(40px,5vw,80px) clamp(18px,4vw,40px) clamp(32px,4vw,56px)",
          borderBottom: "1px solid var(--bow-dark-border)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            right: -30,
            top: -50,
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "clamp(140px,22vw,320px)",
            lineHeight: 0.8,
            color: "rgba(255,255,255,0.05)",
            pointerEvents: "none",
          }}
        >
          CASES
        </div>
        <div className="bow-container" style={{ position: "relative" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            Curriculum · Case Library
          </span>
          <h1
            style={{
              margin: "14px 0 0",
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontSize: "clamp(38px,6vw,84px)",
              lineHeight: 0.9,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              maxWidth: "16ch",
            }}
          >
            Every lesson starts with a decision.
          </h1>
          <p style={{ margin: "20px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.5vw,21px)", lineHeight: 1.55, color: "#c8cad0", maxWidth: 640 }}>
            You step into a role. You review the evidence. You make the call — and then you live with the tradeoff. Browse the BOW front office one case at a time.
          </p>
          <div style={{ marginTop: 30 }}>
            <DataStrip dark items={explorerStats} />
          </div>
        </div>
      </section>

      {/* explorer body (interactive) */}
      <CurriculumExplorer lessons={lessons} />
    </div>
  );
}
