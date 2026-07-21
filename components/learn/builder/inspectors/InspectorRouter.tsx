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
    default:
      return <GenericQuestionInspector block={block} onChange={onChange} />;
  }
}
