"use client";

/* ============================================================
 * components/learn/builder/inspectors/InspectorRouter.tsx — maps a selected
 * block's type to its authoring inspector. Stage-2's representative block
 * set (text/heading/callout/stat/comparison/image, media, mc, slider/
 * price_set, budget_allocation, scenario) gets a full purpose-built form;
 * everything else in the schema falls back to GenericQuestionInspector so
 * the builder never dead-ends on an unrecognized type.
 * ============================================================ */

import type { Block, LessonDoc, VariableDef } from "@/lib/learn/types";
import {
  CalloutInspector,
  ComparisonInspector,
  HeadingInspector,
  ImageInspector,
  StatInspector,
  TextInspector,
} from "./ContentInspectors";
import MediaInspector from "./MediaInspector";
import McInspector from "./McInspector";
import SliderPriceInspector from "./SliderPriceInspector";
import BudgetAllocationInspector from "./BudgetAllocationInspector";
import ScenarioInspector from "./ScenarioInspector";
import GenericQuestionInspector from "./GenericQuestionInspector";
import {
  MultiSelectInspector,
  TrueFalseInspector,
  NumericInspector,
  ShortResponseInspector,
  LongTextInspector,
  StrategyChoiceInspector,
} from "./QuestionInspector";
import {
  RankInspector,
  CategorizeInspector,
  MatchInspector,
  TradeoffMatrixInspector,
  ForecastInspector,
  TableInspector,
  ChartInspector,
  TimelineInspector,
} from "./Stage6Inspectors";

export interface InspectorRouterProps {
  block: Block;
  doc: LessonDoc;
  variables: VariableDef[];
  onChange: (patch: Record<string, unknown>) => void;
}

export default function InspectorRouter({ block, doc, variables, onChange }: InspectorRouterProps) {
  switch (block.type) {
    case "text":
      return <TextInspector block={block} onChange={onChange} />;
    case "heading":
      return <HeadingInspector block={block} onChange={onChange} />;
    case "callout":
      return <CalloutInspector block={block} onChange={onChange} />;
    case "stat":
      return <StatInspector block={block} onChange={onChange} />;
    case "comparison":
      return <ComparisonInspector block={block} onChange={onChange} />;
    case "image":
      return <ImageInspector block={block} onChange={onChange} />;
    case "media":
      return <MediaInspector block={block} onChange={onChange} />;
    case "mc":
      return <McInspector block={block} onChange={onChange} />;
    case "slider":
    case "price_set":
      return <SliderPriceInspector block={block} onChange={onChange} variables={variables} />;
    case "budget_allocation":
      return <BudgetAllocationInspector block={block} onChange={onChange} variables={variables} />;
    case "scenario":
      return <ScenarioInspector block={block} onChange={onChange} variables={variables} doc={doc} />;
    case "multi_select":
      return <MultiSelectInspector block={block} onChange={onChange} />;
    case "true_false":
      return <TrueFalseInspector block={block} onChange={onChange} />;
    case "numeric":
      return <NumericInspector block={block} onChange={onChange} />;
    case "short_response":
      return <ShortResponseInspector block={block} onChange={onChange} />;
    case "long_text":
      return <LongTextInspector block={block} onChange={onChange} />;
    case "strategy_choice":
      return <StrategyChoiceInspector block={block} onChange={onChange} />;
    case "rank":
      return <RankInspector block={block} onChange={onChange} />;
    case "categorize":
    case "drag_drop":
      return <CategorizeInspector block={block} onChange={onChange} />;
    case "match":
      return <MatchInspector block={block} onChange={onChange} />;
    case "tradeoff_matrix":
      return <TradeoffMatrixInspector block={block} onChange={onChange} />;
    case "forecast":
      return <ForecastInspector block={block} onChange={onChange} />;
    case "table":
      return <TableInspector block={block} onChange={onChange} />;
    case "chart":
      return <ChartInspector block={block} onChange={onChange} />;
    case "timeline":
      return <TimelineInspector block={block} onChange={onChange} />;
    default:
      return <GenericQuestionInspector block={block} onChange={onChange} />;
  }
}
