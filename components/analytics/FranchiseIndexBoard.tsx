"use client";

import Link from "next/link";
import { WINDOW_LABELS, type FranchiseIndex, type IndexScore, type TeamBrief } from "@/lib/intelligence-types";
import { teamName, teamSlug } from "@/lib/nba-teams";

const GRADE_COLOR: Record<IndexScore["grade"], string> = {
  A: "var(--bow-positive)",
  B: "var(--bow-blue)",
  C: "var(--bow-warning-text)",
  D: "var(--bow-orange)",
  F: "var(--bow-negative)",
};

type Dimension = Exclude<keyof FranchiseIndex, "overall">;

/** The three dimensions that read fastest as a leaderboard mini-score row. */
const MINI_DIMS: { key: Dimension; label: string }[] = [
  { key: "rosterQuality", label: "Roster" },
  { key: "capFlexibility", label: "Cap flex" },
  { key: "assetBase", label: "Assets" },
];

function MiniScore({ label, score }: { label: string; score: IndexScore }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 72 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: GRADE_COLOR[score.grade] }}>
        {score.score} · {score.grade}
      </span>
    </div>
  );
}

/**
 * FranchiseIndexBoard — the Franchise Strategy Index leaderboard. One row
 * per tracked team, ranked by overall FSI score (the caller sorts and
 * recomputes on every slider move via buildTeamBrief/buildFranchiseIndex),
 * with grade, window read, three headline sub-scores, and the one-line
 * driver behind the grade. Every row links to that team's full brief.
 */
export default function FranchiseIndexBoard({ briefs }: { briefs: TeamBrief[] }) {
  if (briefs.length === 0) {
    return (
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
        No teams with tracked contracts yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {briefs.map((brief, i) => {
        const color = GRADE_COLOR[brief.index.overall.grade];
        return (
          <Link
            key={brief.rollup.team}
            href={`/analytics/teams/${teamSlug(brief.rollup.team)}`}
            className="bow-fsi-row"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "clamp(12px,2vw,22px)",
              background: "var(--bow-white)",
              border: "1px solid var(--border-rule)",
              borderLeft: `4px solid ${color}`,
              padding: "clamp(12px,1.6vw,18px)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span style={{ fontFamily: "var(--font-data)", fontSize: 15, fontWeight: 700, color: "var(--bow-slate)", width: 26, flexShrink: 0, textAlign: "right" }}>
              {i + 1}
            </span>

            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 160, flex: "1 1 200px" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, textTransform: "uppercase", letterSpacing: "0.01em", color: "var(--bow-ink)" }}>
                {teamName(brief.rollup.team)}
              </span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                {WINDOW_LABELS[brief.window]}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 22, color }}>{brief.index.overall.grade}</span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--bow-slate)" }}>
                {brief.index.overall.score}/100
              </span>
            </div>

            <div style={{ display: "flex", gap: "clamp(10px,1.6vw,18px)", flexShrink: 0 }}>
              {MINI_DIMS.map((d) => (
                <MiniScore key={d.key} label={d.label} score={brief.index[d.key]} />
              ))}
            </div>

            <p style={{ margin: 0, flex: "1 1 240px", fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
              {brief.index.overall.driver}
            </p>
          </Link>
        );
      })}

      <style>{`.bow-fsi-row:hover { background: var(--bow-paper) !important; }`}</style>
    </div>
  );
}
