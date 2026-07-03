/* ============================================================
 * Team roll-up — aggregates the same AASV math lib/aasv.ts already
 * computes per player, grouped by team. Nothing here is a new model;
 * it's addition and sorting over lib/aasv's valuate() output, so the
 * league-wide numbers and the per-player numbers can never disagree.
 *
 * Pure math, no I/O — safe to import from a client component (the
 * team dashboard recomputes this on every slider move, same pattern
 * as the player dashboard).
 * ============================================================ */

import { valuate, type AnalyticsPlayer, type ApronStatus, type Assumptions, type Valuation } from "@/lib/aasv";

export interface TeamContract {
  player: AnalyticsPlayer;
  valuation: Valuation;
}

export interface TeamRollup {
  team: string;
  /** Sorted by cap hit, highest first. */
  contracts: TeamContract[];
  totalCap: number;
  totalTrueCost: number;
  totalProduction: number;
  totalAasv: number;
  /** Majority apron tier across TRACKED players only — not the full 15-man roster. */
  apronStatus: ApronStatus;
  bestContract: TeamContract | null;
  worstContract: TeamContract | null;
  trackedCount: number;
}

const APRON_ORDER: ApronStatus[] = ["below", "first", "second"];

/** Build one team's roll-up from its (already-filtered) tracked contracts. Null when the team has none. */
function buildRollup(team: string, group: AnalyticsPlayer[], assumptions: Assumptions): TeamRollup | null {
  if (group.length === 0) return null;

  const contracts: TeamContract[] = group
    .map((player) => ({ player, valuation: valuate(player, assumptions) }))
    .sort((a, b) => b.player.capHit - a.player.capHit);

  const totalCap = contracts.reduce((s, c) => s + c.player.capHit, 0);
  const totalTrueCost = contracts.reduce((s, c) => s + c.valuation.trueCost, 0);
  const totalProduction = contracts.reduce((s, c) => s + c.valuation.productionValue, 0);
  const totalAasv = contracts.reduce((s, c) => s + c.valuation.aasv, 0);

  // Majority apron tier among tracked players. Ties resolve toward the
  // lower/safer tier (iteration order below → first → second, strict >).
  const counts: Record<ApronStatus, number> = { below: 0, first: 0, second: 0 };
  for (const c of contracts) counts[c.player.apronStatus] += 1;
  let apronStatus: ApronStatus = contracts[0].player.apronStatus;
  let bestCount = -1;
  for (const s of APRON_ORDER) {
    if (counts[s] > bestCount) {
      bestCount = counts[s];
      apronStatus = s;
    }
  }

  const byAasv = [...contracts].sort((a, b) => b.valuation.aasv - a.valuation.aasv);
  const bestContract = byAasv[0] ?? null;
  const worstContract = byAasv[byAasv.length - 1] ?? null;

  return {
    team,
    contracts,
    totalCap,
    totalTrueCost,
    totalProduction,
    totalAasv,
    apronStatus,
    bestContract,
    worstContract,
    trackedCount: contracts.length,
  };
}

/** Every team with at least one tracked contract, sorted by total AASV (best surplus first). */
export function aggregateTeams(players: AnalyticsPlayer[], assumptions: Assumptions): TeamRollup[] {
  const byTeam = new Map<string, AnalyticsPlayer[]>();
  for (const p of players) {
    const group = byTeam.get(p.team);
    if (group) group.push(p);
    else byTeam.set(p.team, [p]);
  }
  const rollups: TeamRollup[] = [];
  for (const [team, group] of byTeam) {
    const rollup = buildRollup(team, group, assumptions);
    if (rollup) rollups.push(rollup);
  }
  return rollups.sort((a, b) => b.totalAasv - a.totalAasv);
}

/** One team's roll-up, or null when it has no tracked contracts. */
export function aggregateTeam(players: AnalyticsPlayer[], team: string, assumptions: Assumptions): TeamRollup | null {
  return buildRollup(
    team,
    players.filter((p) => p.team === team),
    assumptions,
  );
}
