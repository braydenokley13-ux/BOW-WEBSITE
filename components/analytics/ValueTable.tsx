"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ApronBadge from "@/components/analytics/ApronBadge";
import {
  fmtMillions,
  fmtSignedMillions,
  valuate,
  type AnalyticsPlayer,
  type ApronStatus,
  type Assumptions,
} from "@/lib/aasv";

type SortKey = "name" | "team" | "capHit" | "apron" | "production" | "aasv";

interface Row {
  p: AnalyticsPlayer;
  production: number;
  trueCost: number;
  aasv: number;
  rank: number;
}

const HEADERS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Player", numeric: false },
  { key: "team", label: "Team", numeric: false },
  { key: "capHit", label: "Cap hit", numeric: true },
  { key: "apron", label: "Apron status", numeric: false },
  { key: "production", label: "Production value", numeric: true },
  { key: "aasv", label: "AASV", numeric: true },
];

/**
 * The dashboard's accessible twin of the scatter: every player, every
 * value, sortable on any column and filterable by search/apron tier.
 * Rank is by AASV under the CURRENT slider settings, so it re-ranks
 * live as assumptions move.
 */
export default function ValueTable({
  players,
  assumptions,
}: {
  players: AnalyticsPlayer[];
  assumptions: Assumptions;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("aasv");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [query, setQuery] = useState("");
  const [apron, setApron] = useState<ApronStatus | "all">("all");

  const rows = useMemo(() => {
    const valued = players.map((p) => {
      const v = valuate(p, assumptions);
      return { p, production: v.productionValue, trueCost: v.trueCost, aasv: v.aasv, rank: 0 };
    });
    // Rank across the FULL list (not the filtered view) so #1 means #1 overall.
    [...valued].sort((a, b) => b.aasv - a.aasv).forEach((r, i) => (r.rank = i + 1));
    return valued;
  }, [players, assumptions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (q) list = list.filter((r) => r.p.name.toLowerCase().includes(q) || r.p.team.toLowerCase().includes(q));
    if (apron !== "all") list = list.filter((r) => r.p.apronStatus === apron);
    const dir = sortDir;
    const cmp = (a: Row, b: Row): number => {
      switch (sortKey) {
        case "name":
          return a.p.name.localeCompare(b.p.name) * dir;
        case "team":
          return a.p.team.localeCompare(b.p.team) * dir;
        case "capHit":
          return (a.p.capHit - b.p.capHit) * dir;
        case "apron": {
          const order: Record<ApronStatus, number> = { below: 0, first: 1, second: 2 };
          return (order[a.p.apronStatus] - order[b.p.apronStatus]) * dir;
        }
        case "production":
          return (a.production - b.production) * dir;
        case "aasv":
          return (a.aasv - b.aasv) * dir;
      }
    };
    return [...list].sort(cmp);
  }, [rows, query, apron, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "team" ? 1 : -1);
    }
  };

  const filterLabel: React.CSSProperties = {
    fontFamily: "var(--font-data)",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--bow-slate)",
  };
  const control: React.CSSProperties = {
    fontFamily: "var(--font-interface)",
    fontSize: 14,
    padding: "8px 10px",
    border: "1px solid var(--border-rule)",
    background: "var(--bow-white)",
    color: "var(--bow-ink)",
    borderRadius: 0,
  };

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)" }}>
      {/* one filter row above everything it scopes */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", padding: "14px 16px", borderBottom: "1px solid var(--border-rule)" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px", maxWidth: 300 }}>
          <span style={filterLabel}>Search player / team</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Brunson or NYK" style={control} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={filterLabel}>Apron tier</span>
          <select value={apron} onChange={(e) => setApron(e.target.value as ApronStatus | "all")} style={{ ...control, cursor: "pointer" }}>
            <option value="all">All tiers</option>
            <option value="below">Below apron</option>
            <option value="first">First apron</option>
            <option value="second">Second apron</option>
          </select>
        </label>
        <span style={{ ...filterLabel, marginLeft: "auto", paddingBottom: 10 }}>
          {visible.length} of {rows.length} players
        </span>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.p.slug} style={{ borderTop: "1px solid var(--border-rule)" }}>
                <td style={{ ...tdMono, textAlign: "right", color: "var(--bow-slate)" }}>{r.rank}</td>
                <td style={{ padding: "10px 12px" }}>
                  <Link
                    href={`/analytics/players/${r.p.slug}`}
                    className="bow-link"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--bow-ink)", textDecoration: "none" }}
                  >
                    {r.p.name}
                  </Link>
                </td>
                <td style={{ ...tdMono, color: "var(--bow-slate)" }}>{r.p.team}</td>
                <td style={{ ...tdMono, textAlign: "right" }}>{fmtMillions(r.p.capHit)}</td>
                <td style={{ padding: "10px 12px" }}>
                  <ApronBadge status={r.p.apronStatus} compact />
                </td>
                <td style={{ ...tdMono, textAlign: "right" }}>{fmtMillions(r.production)}</td>
                <td style={{ ...tdMono, textAlign: "right", fontWeight: 700, color: r.aasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)" }}>
                  {fmtSignedMillions(r.aasv)}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "22px 16px", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)", textAlign: "center" }}>
                  No players match that filter.
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
