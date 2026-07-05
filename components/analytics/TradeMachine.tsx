"use client";

import { useId, useMemo, useState } from "react";
import { TradeAnalysisView } from "@/components/analytics/embeds";
import { useAssumptions } from "@/components/analytics/useAssumptions";
import ClipButton from "@/components/research/ClipButton";
import { fmtMillions, fmtSignedMillions, type AnalyticsPlayer } from "@/lib/aasv";
import { buildTradeAnalysis } from "@/lib/intelligence";

/* ============================================================
 * TradeMachine — the interactive half of the trade module.
 *
 * Pick any two tracked players and the same pure engine that powers the
 * <TradeAnalysis/> article embed recomputes live under the reader's tuned
 * assumptions (the apron-multiplier sliders on the dashboard). It makes the
 * platform's sharpest idea tangible: the SAME contract has a different true
 * cost on a different team, so a swap can create surplus out of nothing but
 * the apron math — and both teams can win.
 *
 * Raw player rows come from the server; every valuation happens here,
 * client-side, so there are no round-trips as you change the picks.
 * ============================================================ */

/** First player at a given tier, so the default matchup crosses apron tiers (where the value creation lives). */
function firstAtTier(players: AnalyticsPlayer[], tier: AnalyticsPlayer["apronStatus"]): AnalyticsPlayer | undefined {
  return players.find((p) => p.apronStatus === tier);
}

function PlayerPicker({
  label,
  value,
  players,
  exclude,
  onChange,
}: {
  label: string;
  value: string;
  players: AnalyticsPlayer[];
  exclude: string;
  onChange: (slug: string) => void;
}) {
  const id = useId();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 220px", minWidth: 0 }}>
      <label
        htmlFor={id}
        style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily: "var(--font-interface)",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--bow-ink)",
          background: "var(--bow-white)",
          border: "1px solid var(--border-rule)",
          padding: "9px 12px",
          width: "100%",
          cursor: "pointer",
        }}
      >
        {players.map((p) => (
          <option key={p.slug} value={p.slug} disabled={p.slug === exclude}>
            {p.name} — {p.team} · {fmtMillions(p.capHit)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function TradeMachine({ players }: { players: AnalyticsPlayer[] }) {
  const [assumptions] = useAssumptions();

  const sorted = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);

  // Default to a tier-crossing matchup so the "value created in transit" idea shows on first paint.
  const defaultA = firstAtTier(players, "second") ?? players[0];
  const defaultB = firstAtTier(players, "below") ?? players[1] ?? players[0];
  const [slugA, setSlugA] = useState<string>(defaultA?.slug ?? "");
  const [slugB, setSlugB] = useState<string>(defaultB?.slug ?? "");

  const playerA = players.find((p) => p.slug === slugA) ?? defaultA;
  const playerB = players.find((p) => p.slug === slugB) ?? defaultB;

  if (players.length < 2 || !playerA || !playerB) {
    return (
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
        Need at least two tracked contracts to run a trade.
      </p>
    );
  }

  const analysis = buildTradeAnalysis(playerA, playerB, assumptions);
  const sameTeam = playerA.team === playerB.team;

  return (
    <div style={{ border: "1px solid var(--border-rule)", background: "var(--bow-white)", padding: "clamp(16px,2.2vw,24px)", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Trade Machine
        </span>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)", maxWidth: "62ch" }}>
          Swap any two tracked contracts. Each player&rsquo;s value is repriced at his new team&rsquo;s apron tier — the
          gap between the two is surplus created (or destroyed) by the cap alone. Runs on your slider assumptions.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <PlayerPicker label="Team A trades" value={slugA} players={sorted} exclude={slugB} onChange={setSlugA} />
        <span aria-hidden style={{ fontFamily: "var(--font-data)", fontSize: 20, color: "var(--bow-orange)", padding: "0 2px 8px" }}>
          &harr;
        </span>
        <PlayerPicker label="Team B trades" value={slugB} players={sorted} exclude={slugA} onChange={setSlugB} />
      </div>

      {sameTeam && (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-warning-text)", borderLeft: "3px solid var(--bow-warning)", paddingLeft: 10 }}>
          Both players are on {playerA.team} — pick two different teams to see the apron repricing at work.
        </p>
      )}

      <TradeAnalysisView analysis={analysis} assumptions={assumptions} standalone={false} />

      <ClipButton
        kind="trade"
        title={analysis.headline}
        detail={`${playerA.team} nets ${fmtSignedMillions(analysis.a.netAasvChange)}, ${playerB.team} nets ${fmtSignedMillions(analysis.b.netAasvChange)} · value created ${fmtSignedMillions(analysis.valueCreated)}`}
        refs={[{ kind: "trade", slugs: [playerA.slug, playerB.slug], label: `${playerA.name} for ${playerB.name}` }]}
        style={{ alignSelf: "flex-start" }}
      />
    </div>
  );
}
