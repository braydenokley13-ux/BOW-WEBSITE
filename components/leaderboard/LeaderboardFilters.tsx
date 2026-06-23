"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Props {
  cohorts: { id: string; name: string }[];
  range: string;
  cohortId: string;
}

const RANGES = [
  { key: "all", label: "All Time" },
  { key: "month", label: "This Month" },
  { key: "week", label: "This Week" },
];

const selectStyle: React.CSSProperties = {
  fontFamily: "var(--font-interface)",
  fontSize: 13.5,
  padding: "9px 12px",
  borderRadius: 5,
  border: "1px solid var(--bow-dark-border)",
  background: "var(--bow-dark-surface)",
  color: "#fff",
  outline: "none",
  cursor: "pointer",
};

/** Cohort + time-window filters for the leaderboard (URL-driven). */
export default function LeaderboardFilters({ cohorts, range, cohortId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all" && value !== "") next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`);
  };

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>Cohort</span>
        <select aria-label="Filter by cohort" value={cohortId} onChange={(e) => update("cohort", e.target.value)} style={selectStyle}>
          <option value="">All cohorts</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>Time</span>
        <select aria-label="Filter by time window" value={range} onChange={(e) => update("range", e.target.value)} style={selectStyle}>
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
