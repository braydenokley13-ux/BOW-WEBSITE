"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataStrip } from "@/components/ds";
import { VerdictBadge } from "@/components/intelligence";
import CapStackBar from "@/components/analytics/CapStackBar";
import SliderPanel from "@/components/analytics/SliderPanel";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import { fmtMillions, fmtSignedMillions, type AnalyticsPlayer, type Assumptions } from "@/lib/aasv";
import { buildContractVerdict, buildLeagueContext } from "@/lib/intelligence";
import type { LeagueContext } from "@/lib/intelligence-types";
import { teamName } from "@/lib/nba-teams";
import { aggregateTeam, type TeamContract } from "@/lib/team-aasv";

/**
 * One team's cap sheet: every tracked contract stacked, ranked, and
 * priced the same way the player pages price a single guy. Reuses the
 * SAME session-persisted sliders as /analytics and /analytics/players
 * so a reader who has already tuned the model sees consistent numbers
 * everywhere.
 *
 * Cap-stack segments are colored by AASV sign (surplus vs. overpay)
 * rather than apron tier — apron status is already carried by the
 * ApronBadge on the page header, and sign is the more useful second
 * signal on a per-contract bar: it says WHERE the value sits, not just
 * how expensive the team's tax bracket is.
 */
const stepCard: React.CSSProperties = {
  background: "var(--bow-white)",
  border: "1px solid var(--border-rule)",
  padding: "clamp(16px,2vw,22px)",
};
const stepKicker: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
};

function ContractCard({
  label,
  contract,
  assumptions,
  ctx,
}: {
  label: string;
  contract: TeamContract;
  assumptions: Assumptions;
  ctx: LeagueContext;
}) {
  const verdict = buildContractVerdict(contract.player, contract.valuation, assumptions, ctx);
  return (
    <div style={{ ...stepCard, borderLeft: `4px solid ${contract.valuation.aasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)"}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={stepKicker}>{label}</span>
        <VerdictBadge tier={verdict.tier} size="sm" />
      </div>
      <Link
        href={`/analytics/players/${contract.player.slug}`}
        className="bow-link"
        style={{ display: "block", margin: "8px 0 0", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.01em", color: "var(--bow-ink)", textDecoration: "none" }}
      >
        {contract.player.name}
      </Link>
      <p style={{ margin: "6px 0 0", fontFamily: "var(--font-data)", fontSize: 13.5, fontVariantNumeric: "tabular-nums", color: "var(--bow-slate)" }}>
        {fmtMillions(contract.player.capHit)} cap hit
      </p>
      <p style={{ margin: "6px 0 0", fontFamily: "var(--font-data)", fontSize: 17, fontWeight: 700, color: contract.valuation.aasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)" }}>
        {fmtSignedMillions(contract.valuation.aasv)} AASV
      </p>
    </div>
  );
}

export default function TeamCapSheet({ team, players }: { team: string; players: AnalyticsPlayer[] }) {
  const [assumptions, setAssumptions, resetAssumptions] = useAssumptions();

  const rollup = useMemo(() => aggregateTeam(players, team, assumptions), [players, team, assumptions]);
  // League context (tracked-contract ranking) is built off the FULL tracked
  // list, not just this team, so a verdict here can honestly say "top-5 of N
  // tracked deals" the same way the player pages do.
  const ctx = useMemo(() => buildLeagueContext(players, assumptions), [players, assumptions]);

  if (rollup == null) {
    return (
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
        No tracked contracts for {teamName(team)} yet.
      </p>
    );
  }

  const segments = rollup.contracts.map((c) => ({
    slug: c.player.slug,
    label: c.player.name,
    value: c.player.capHit,
    color: c.valuation.aasv >= 0 ? "#158a55" /* --bow-positive */ : "#d63b3b" /* --bow-negative */,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(18px,2.4vw,28px)" }}>
      {/* header + disclosure */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          {teamName(team)} · Cap Sheet
        </span>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--bow-slate)",
            border: "1px solid var(--border-rule)",
            padding: "3px 9px",
          }}
        >
          {rollup.trackedCount} contract{rollup.trackedCount === 1 ? "" : "s"} tracked
        </span>
      </div>

      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
        This is BOW&rsquo;s curated slice of {teamName(team)}&rsquo;s books, not the full roster — totals below cover
        only the {rollup.trackedCount} tracked contract{rollup.trackedCount === 1 ? "" : "s"} shown here.
      </p>

      <DataStrip
        dense
        items={[
          { label: "Tracked cap committed", value: fmtMillions(rollup.totalCap) },
          { label: "Production value", value: fmtMillions(rollup.totalProduction) },
          { label: "True cost", value: fmtMillions(rollup.totalTrueCost) },
          { label: "Total AASV", value: fmtSignedMillions(rollup.totalAasv), tone: rollup.totalAasv >= 0 ? "positive" : "negative" },
        ]}
      />

      <div style={{ ...stepCard }}>
        <span style={stepKicker}>Tracked cap hits</span>
        <div style={{ marginTop: 14 }}>
          <CapStackBar segments={segments} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) minmax(0, 1fr)", gap: "clamp(16px,2.4vw,28px)", alignItems: "start" }} className="bow-analytics-grid">
        <SliderPanel assumptions={assumptions} onChange={setAssumptions} onReset={resetAssumptions} />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rollup.trackedCount === 1 && rollup.bestContract ? (
            <ContractCard label="Only tracked contract" contract={rollup.bestContract} assumptions={assumptions} ctx={ctx} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
              {rollup.bestContract && <ContractCard label="Best value" contract={rollup.bestContract} assumptions={assumptions} ctx={ctx} />}
              {rollup.worstContract && <ContractCard label="Biggest hole" contract={rollup.worstContract} assumptions={assumptions} ctx={ctx} />}
            </div>
          )}

          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr>
                    <th scope="col" style={thStyle}>
                      Player
                    </th>
                    <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                      Cap hit
                    </th>
                    <th scope="col" style={{ ...thStyle, textAlign: "right" }}>
                      AASV
                    </th>
                    <th scope="col" style={thStyle}>
                      Verdict
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.contracts.map((c) => {
                    const verdict = buildContractVerdict(c.player, c.valuation, assumptions, ctx);
                    return (
                      <tr key={c.player.slug} style={{ borderTop: "1px solid var(--border-rule)" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <Link
                            href={`/analytics/players/${c.player.slug}`}
                            className="bow-link"
                            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--bow-ink)", textDecoration: "none" }}
                          >
                            {c.player.name}
                          </Link>
                        </td>
                        <td style={tdMono}>{fmtMillions(c.player.capHit)}</td>
                        <td style={{ ...tdMono, fontWeight: 700, color: c.valuation.aasv >= 0 ? "var(--bow-positive)" : "var(--bow-negative)" }}>
                          {fmtSignedMillions(c.valuation.aasv)}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <VerdictBadge tier={verdict.tier} size="sm" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <style>{`@media (max-width: 900px) { .bow-analytics-grid { grid-template-columns: 1fr !important; } }`}</style>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--bow-paper)",
  borderBottom: "1px solid var(--border-rule)",
  whiteSpace: "nowrap",
  textAlign: "left",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bow-ink)",
};

const tdMono: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "right",
  fontFamily: "var(--font-data)",
  fontSize: 13.5,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};
