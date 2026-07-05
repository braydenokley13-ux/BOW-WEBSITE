"use client";

import { useAssumptions } from "@/components/analytics/useAssumptions";
import type { AnalyticsPlayer } from "@/lib/aasv";
import {
  AASVChartEmbed,
  AASVTableEmbed,
  ContractVerdictEmbed,
  PlayerCardEmbed,
  ScenarioBandEmbed,
  TeamCapSheetEmbed,
  TeamFlexEmbed,
  TradeAnalysisEmbed,
} from "@/components/analytics/embeds";

/* ============================================================
 * LiveAssumptions — the ONLY client boundary in the embed pipeline.
 *
 * The audit's integrity finding: the articles page calls embeds "live",
 * but every embed hardcoded DEFAULT_ASSUMPTIONS while the reader's tuned
 * sliders (sessionStorage via useAssumptions) sat unused. Article pages
 * are server components, so MarkdownView (also server-renderable) can't
 * read a browser hook itself — instead its EmbedBlock renders ONE of the
 * thin "Live*" wrappers below in place of the raw embed. Each wrapper:
 *
 *   1. reads useAssumptions() (the reader's tuned values, or
 *      DEFAULT_ASSUMPTIONS before hydration / with nothing saved — the
 *      hook's own server snapshot is empty, so SSR output already matches
 *      this default-first behavior)
 *   2. renders the real, prop-driven, server-safe embed component with
 *      those assumptions
 *
 * All DATA (players, teams, history) still arrives via props from the
 * article page's / editor's prefetch — this file adds interactivity
 * only, never fetches or computes anything itself beyond reading the
 * assumptions hook.
 * ============================================================ */

export function LivePlayerCard({ player }: { player: AnalyticsPlayer }) {
  const [assumptions] = useAssumptions();
  return <PlayerCardEmbed player={player} assumptions={assumptions} />;
}

export function LiveAASVChart({ players }: { players: AnalyticsPlayer[] }) {
  const [assumptions] = useAssumptions();
  return <AASVChartEmbed players={players} assumptions={assumptions} />;
}

export function LiveAASVTable({ players }: { players: AnalyticsPlayer[] }) {
  const [assumptions] = useAssumptions();
  return <AASVTableEmbed players={players} assumptions={assumptions} />;
}

export function LiveTeamCapSheet({ team, players }: { team: string; players: AnalyticsPlayer[] }) {
  const [assumptions] = useAssumptions();
  return <TeamCapSheetEmbed team={team} players={players} assumptions={assumptions} />;
}

export function LiveContractVerdict({ player, allPlayers }: { player: AnalyticsPlayer; allPlayers: AnalyticsPlayer[] }) {
  const [assumptions] = useAssumptions();
  return <ContractVerdictEmbed player={player} allPlayers={allPlayers} assumptions={assumptions} />;
}

export function LiveTeamFlex({ team, allPlayers }: { team: string; allPlayers: AnalyticsPlayer[] }) {
  const [assumptions] = useAssumptions();
  return <TeamFlexEmbed team={team} allPlayers={allPlayers} assumptions={assumptions} />;
}

export function LiveScenarioBand({ player }: { player: AnalyticsPlayer }) {
  const [assumptions] = useAssumptions();
  return <ScenarioBandEmbed player={player} assumptions={assumptions} />;
}

export function LiveTradeAnalysis({ playerA, playerB }: { playerA: AnalyticsPlayer; playerB: AnalyticsPlayer }) {
  const [assumptions] = useAssumptions();
  return <TradeAnalysisEmbed playerA={playerA} playerB={playerB} assumptions={assumptions} />;
}
