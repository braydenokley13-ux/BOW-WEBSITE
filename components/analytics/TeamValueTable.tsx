"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ApronBadge from "@/components/analytics/ApronBadge";
import { fmtMillions, fmtSignedMillions } from "@/lib/aasv";
import { teamName, teamSlug } from "@/lib/nba-teams";
import type { TeamRollup } from "@/lib/team-aasv";

type SortKey = "team" | "tracked" | "cap" | "production" | "trueCost" | "aasv";

const HEADERS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "team", label: "Team", numeric: false },
  { key: "tracked", label: "Tracked", numeric: true },
  { key: "cap", label: "Tracked cap", numeric: true },
  { key: "production", label: "Production", numeric: true },
  { key: "trueCost", label: "True cost", numeric: true },
  { key: "aasv", label: "Total AASV", numeric: true },
];

/**
 * The league table — same sortable/accessible pattern as ValueTable,
 * one row per team instead of per player. Rank is by total AASV under
 * the current sliders, same as the player table.
 */
export default function TeamValueTable({ rollups }: { rollups: TeamRollup[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("aasv");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const visible = useMemo(() => {
    const dir = sortDir;
    const cmp = (a: TeamRollup, b: TeamRollup): number => {
      switch (sortKey) {
        case "team":
          return teamName(a.team).localeCompare(teamName(b.team)) * dir;
        case "tracked":
          return (a.trackedCount - b.trackedCount) * dir;
        case "cap":
          return (a.totalCap - b.totalCap) * dir;
        case "production":
          return (a.totalProduction - b.totalProduction) * dir;
        case "trueCost":
          return (a.totalTrueCost - b.totalTrueCost) * dir;
        case "aasv":
          return (a.totalAasv - b.totalAasv) * dir;
      }
    };
    return [...rollups].sort(cmp);
  }, [rollups, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "team" ? 1 : -1);
    }
  };

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...thStyle, width: 52, textAlign: "right" }}>
                Rank
              </th>
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  scope="col"
                  aria-sort={sortKey === h.key ? (sortDir === 1 ? "ascending" : "descending") : undefined}
                  style={{ ...thStyle, textAlign: h.numeric ? "right" : "left" }}
                >
                  <button type="button" onClick={() => toggleSort(h.key)} style={{ ...thButton, justifyContent: h.numeric ? "flex-end" : "flex-start" }}>
                    {h.label}
                    <span aria-hidden style={{ opacity: sortKey === h.key ? 1 : 0.25, fontSize: 9 }}>
                      {sortKey === h.key ? (sortDir === 1 ? "▲" : "▼") : "▲▼"}
                    </span>
                  </button>
                </th>
              ))}
              <th scope="col" style={{ ...thStyle, textAlign: "left" }}>
                Apron tier
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.team} style={{ borderTop: "1px solid var(--border-rule)" }}>
                <td style={{ ...tdMono, textAlign: "right", color: "var(--bow-slate)" }}>{i + 1}</td>
                <td style={{ padding: "10px 12px" }}>
                  <Link
                    href={`/analytics/teams/${teamSlug(r.team)}`}
                    className="bow-link"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--bow-ink)", textDecoration: "none" }}
                  >
                    {teamName(r.team)}
                  </Link>
                </td>
                <td style={{ ...tdMono, textAlign: "right", color: "var(--bow-slate)" }}>{r.trackedCount}</td>
                <td style={{ ...tdMono, textAlign: "right" }}>{fmtMillions(r.totalCap)}</td>
                <td style={{ ...tdMono, textAlign: "right" }}>{fmtMillions(r.totalProduction)}</td>
                <td style={{ ...tdMono, textAlign: "right" }}>{fmtMillions(r.totalTrueCost)}</td>
                <td style={{ ...tdMono, textAlign: "right", fontWeight: 700, color: r.totalAasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)" }}>
                  {fmtSignedMillions(r.totalAasv)}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <ApronBadge status={r.apronStatus} compact />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "22px 16px", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)", textAlign: "center" }}>
                  No teams with tracked contracts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--bow-paper)",
  borderBottom: "1px solid var(--border-rule)",
  whiteSpace: "nowrap",
};

const thButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bow-ink)",
};

const tdMono: React.CSSProperties = {
  padding: "10px 12px",
  fontFamily: "var(--font-data)",
  fontSize: 13.5,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};
