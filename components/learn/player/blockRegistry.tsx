"use client";

/* ============================================================
 * components/learn/player/blockRegistry.tsx — client Player binding.
 *
 * Layers React Player components onto lib/learn/registry.ts's BLOCK_REGISTRY
 * WITHOUT that file ever importing React (see its header comment). This is
 * the only direction of import: this file → lib/learn/registry.ts. Never
 * the reverse, or Stage 3's builder (which also reads BLOCK_REGISTRY from a
 * server context) would pull React into places it doesn't belong.
 *
 * Stage 2 registers Players for the 5-7 representative block types named in
 * the plan. Any BlockType without an entry here falls through to
 * UnregisteredBlockFallback in LessonPlayer.tsx's render loop (graceful
 * malformed-doc handling), not a crash.
 * ============================================================ */

import type { ComponentType } from "react";
import type { BlockType } from "@/lib/learn/types";
import type { BlockPlayerProps } from "./types";
import ContentBlock, { isContentBlock } from "./blocks/ContentBlock";
import MediaBlockPlayer from "./blocks/MediaBlock";
import MCQBlock from "./blocks/MCQBlock";
import SliderBlock from "./blocks/SliderBlock";
import BudgetAllocationBlock from "./blocks/BudgetAllocationBlock";
import ScenarioBlock from "./blocks/ScenarioBlock";
import QuestionBlock from "./blocks/QuestionBlock";
import StrategyChoiceBlock from "./blocks/StrategyChoiceBlock";
import RankBlock from "./blocks/RankBlock";
import CategorizeBlock from "./blocks/CategorizeBlock";
import MatchBlock from "./blocks/MatchBlock";
import TradeoffMatrixBlock from "./blocks/TradeoffMatrixBlock";
import ForecastBlock from "./blocks/ForecastBlock";

/** Player components registered for Stage 2's representative block set, plus
 * Stage 6's interaction expansion (rank/categorize/drag_drop/match/
 * tradeoff_matrix/forecast/table/chart/timeline and the previously
 * player-less multi_select/true_false/numeric/short_response/long_text/
 * strategy_choice). */
export const PLAYER_COMPONENTS: Partial<Record<BlockType, ComponentType<BlockPlayerProps<never>>>> = {
  text: ContentBlock as ComponentType<BlockPlayerProps<never>>,
  heading: ContentBlock as ComponentType<BlockPlayerProps<never>>,
  callout: ContentBlock as ComponentType<BlockPlayerProps<never>>,
  stat: ContentBlock as ComponentType<BlockPlayerProps<never>>,
  comparison: ContentBlock as ComponentType<BlockPlayerProps<never>>,
  image: ContentBlock as ComponentType<BlockPlayerProps<never>>,
  table: ContentBlock as ComponentType<BlockPlayerProps<never>>,
  chart: ContentBlock as ComponentType<BlockPlayerProps<never>>,
  timeline: ContentBlock as ComponentType<BlockPlayerProps<never>>,
  media: MediaBlockPlayer as ComponentType<BlockPlayerProps<never>>,
  mc: MCQBlock as ComponentType<BlockPlayerProps<never>>,
  multi_select: QuestionBlock as ComponentType<BlockPlayerProps<never>>,
  true_false: QuestionBlock as ComponentType<BlockPlayerProps<never>>,
  numeric: QuestionBlock as ComponentType<BlockPlayerProps<never>>,
  short_response: QuestionBlock as ComponentType<BlockPlayerProps<never>>,
  long_text: QuestionBlock as ComponentType<BlockPlayerProps<never>>,
  slider: SliderBlock as ComponentType<BlockPlayerProps<never>>,
  price_set: SliderBlock as ComponentType<BlockPlayerProps<never>>,
  budget_allocation: BudgetAllocationBlock as ComponentType<BlockPlayerProps<never>>,
  strategy_choice: StrategyChoiceBlock as ComponentType<BlockPlayerProps<never>>,
  rank: RankBlock as ComponentType<BlockPlayerProps<never>>,
  categorize: CategorizeBlock as ComponentType<BlockPlayerProps<never>>,
  drag_drop: CategorizeBlock as ComponentType<BlockPlayerProps<never>>,
  match: MatchBlock as ComponentType<BlockPlayerProps<never>>,
  tradeoff_matrix: TradeoffMatrixBlock as ComponentType<BlockPlayerProps<never>>,
  forecast: ForecastBlock as ComponentType<BlockPlayerProps<never>>,
  scenario: ScenarioBlock as ComponentType<BlockPlayerProps<never>>,
};

export function getPlayerComponent(type: BlockType): ComponentType<BlockPlayerProps<never>> | undefined {
  return PLAYER_COMPONENTS[type];
}

/** Whether a block type never collects a response — used to auto-advance. */
export function isAutoAdvanceType(type: BlockType): boolean {
  return (
    type === "text" ||
    type === "heading" ||
    type === "callout" ||
    type === "stat" ||
    type === "comparison" ||
    type === "image" ||
    type === "table" ||
    type === "chart" ||
    type === "timeline"
  );
}

export { isContentBlock };
