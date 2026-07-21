/* ============================================================
 * lib/learn/registry.ts — block registry (plan §3), core definitions.
 *
 * The registry is the single extension point for block types: player
 * rendering, builder palette/inspector, validation, and analytics should
 * all read this instead of scattered switch statements. This file stays
 * server/client-neutral (no React, no "use client") so it can be imported
 * from server actions, the engine, and (later) client components without
 * circular imports. Stage 2 adds `components/learn/player/blockRegistry.tsx`
 * which imports THIS registry's `type`/`schema`/`defaults`/`capabilities`
 * and layers in the actual `Player`/`Inspector` React components — never
 * the other way around.
 * ============================================================ */

import type { z } from "zod";
import type { Block, BlockType } from "./types";
import {
  TextBlockSchema,
  HeadingBlockSchema,
  CalloutBlockSchema,
  StatBlockSchema,
  ComparisonBlockSchema,
  ImageBlockSchema,
  MediaBlockSchema,
  McBlockSchema,
  MultiSelectBlockSchema,
  TrueFalseBlockSchema,
  NumericBlockSchema,
  ShortResponseBlockSchema,
  LongTextBlockSchema,
  StrategyChoiceBlockSchema,
  SliderBlockSchema,
  PriceSetBlockSchema,
  BudgetAllocationBlockSchema,
  ScenarioBlockSchema,
} from "./schema";

export interface BlockCapabilities {
  /** Does this block type collect a student response at all? */
  collectsResponse: boolean;
  /** Can this block type contribute points to the lesson score? */
  canScore: boolean;
  /** Can this block type branch to a different next block? */
  canBranch: boolean;
  /** Can this block type apply EffectRules to lesson variables? */
  changesVariables: boolean;
  /** Can this block be shown/hidden via a `visibleIf` condition? (all can — kept explicit for registry consumers.) */
  supportsConditionalVisibility: boolean;
}

export type BlockCategory = "content" | "media" | "question" | "reflection" | "decision" | "scenario";

/**
 * A single registry entry. `Player`/`Inspector` are typed as unknown/deferred
 * here on purpose — Stage 1 has no React player yet. Stage 2/3 register the
 * actual components in a separate client-only file, keyed by the same
 * `type`, without this file ever importing React.
 */
export interface BlockRegistryEntry {
  type: BlockType;
  version: number;
  label: string;
  category: BlockCategory;
  schema: z.ZodTypeAny;
  defaults: Record<string, unknown>;
  /** Optional block-specific validation beyond validateLessonDoc's generic checks. */
  validate?: (block: Block) => string[];
  /** Short human-readable summary for builder lists / analytics (e.g. "MC: 4 options, 1 point"). */
  summarize: (block: Block) => string;
  capabilities: BlockCapabilities;
  /** Deferred: filled in by components/learn/player/blockRegistry.tsx (Stage 2+). */
  Player?: unknown;
  /** Deferred: filled in by components/learn/builder (Stage 3+). */
  Inspector?: unknown;
}

const CONTENT_CAPS: BlockCapabilities = {
  collectsResponse: false,
  canScore: false,
  canBranch: false,
  changesVariables: false,
  supportsConditionalVisibility: true,
};

const QUESTION_CAPS: BlockCapabilities = {
  collectsResponse: true,
  canScore: true,
  canBranch: false,
  changesVariables: false,
  supportsConditionalVisibility: true,
};

const DECISION_CAPS: BlockCapabilities = {
  collectsResponse: true,
  canScore: true,
  canBranch: true,
  changesVariables: true,
  supportsConditionalVisibility: true,
};

/**
 * Data-only registry, keyed by block type. Import from lib/learn/schema.ts
 * lazily inside each `defaults`/`summarize` to avoid re-exporting the whole
 * zod module surface; the `schema` field below intentionally narrows to
 * `Block` (the discriminated union member) via a type assertion since zod's
 * discriminatedUnion doesn't expose per-member schemas without a lookup.
 */
export const BLOCK_REGISTRY: Record<BlockType, BlockRegistryEntry> = {
  text: {
    type: "text",
    version: 1,
    label: "Text",
    category: "content",
    schema: TextBlockSchema,
    defaults: { type: "text", body: "" } as Record<string, unknown>,
    summarize: (b) => `Text: ${String((b as { body?: string }).body ?? "").slice(0, 40)}`,
    capabilities: CONTENT_CAPS,
  },
  heading: {
    type: "heading",
    version: 1,
    label: "Heading",
    category: "content",
    schema: HeadingBlockSchema,
    defaults: { type: "heading", text: "", level: 2 } as Record<string, unknown>,
    summarize: (b) => `Heading: ${(b as { text?: string }).text ?? ""}`,
    capabilities: CONTENT_CAPS,
  },
  callout: {
    type: "callout",
    version: 1,
    label: "Callout",
    category: "content",
    schema: CalloutBlockSchema,
    defaults: { type: "callout", tone: "info", body: "" } as Record<string, unknown>,
    summarize: (b) => `Callout (${(b as { tone?: string }).tone}): ${(b as { body?: string }).body?.slice(0, 40) ?? ""}`,
    capabilities: CONTENT_CAPS,
  },
  stat: {
    type: "stat",
    version: 1,
    label: "Stat",
    category: "content",
    schema: StatBlockSchema,
    defaults: { type: "stat", label: "", value: 0 } as Record<string, unknown>,
    summarize: (b) => `Stat: ${(b as { label?: string }).label ?? ""}`,
    capabilities: CONTENT_CAPS,
  },
  comparison: {
    type: "comparison",
    version: 1,
    label: "Comparison",
    category: "content",
    schema: ComparisonBlockSchema,
    defaults: { type: "comparison", items: [] } as Record<string, unknown>,
    summarize: (b) => `Comparison: ${((b as { items?: unknown[] }).items ?? []).length} items`,
    capabilities: CONTENT_CAPS,
  },
  image: {
    type: "image",
    version: 1,
    label: "Image",
    category: "content",
    schema: ImageBlockSchema,
    defaults: { type: "image", src: "", alt: "" } as Record<string, unknown>,
    summarize: (b) => `Image: ${(b as { alt?: string }).alt ?? ""}`,
    capabilities: CONTENT_CAPS,
  },
  media: {
    type: "media",
    version: 1,
    label: "Media",
    category: "media",
    schema: MediaBlockSchema,
    defaults: { type: "media", kind: "video", src: "", completion: { mode: "started" } } as Record<string, unknown>,
    summarize: (b) => `Media (${(b as { kind?: string }).kind ?? ""})`,
    capabilities: { ...CONTENT_CAPS, collectsResponse: true },
  },
  mc: {
    type: "mc",
    version: 1,
    label: "Multiple Choice",
    category: "question",
    schema: McBlockSchema,
    defaults: { type: "mc", prompt: "", options: [], correctOptionId: "", grading: "correct", points: 1 } as Record<string, unknown>,
    summarize: (b) => `MC: ${((b as { options?: unknown[] }).options ?? []).length} options, ${(b as { points?: number }).points ?? 0} pt(s)`,
    capabilities: QUESTION_CAPS,
  },
  multi_select: {
    type: "multi_select",
    version: 1,
    label: "Multi-Select",
    category: "question",
    schema: MultiSelectBlockSchema,
    defaults: { type: "multi_select", prompt: "", options: [], correctOptionIds: [], grading: "correct", points: 1 } as Record<string, unknown>,
    summarize: (b) => `Multi-select: ${((b as { options?: unknown[] }).options ?? []).length} options`,
    capabilities: QUESTION_CAPS,
  },
  true_false: {
    type: "true_false",
    version: 1,
    label: "True / False",
    category: "question",
    schema: TrueFalseBlockSchema,
    defaults: { type: "true_false", prompt: "", correctAnswer: true, grading: "correct", points: 1 } as Record<string, unknown>,
    summarize: (b) => `True/False: ${(b as { prompt?: string }).prompt?.slice(0, 40) ?? ""}`,
    capabilities: QUESTION_CAPS,
  },
  numeric: {
    type: "numeric",
    version: 1,
    label: "Numeric",
    category: "question",
    schema: NumericBlockSchema,
    defaults: { type: "numeric", prompt: "", correctValue: 0, tolerance: 0, grading: "correct", points: 1 } as Record<string, unknown>,
    summarize: (b) => `Numeric: target ${(b as { correctValue?: number }).correctValue ?? 0}`,
    capabilities: QUESTION_CAPS,
  },
  short_response: {
    type: "short_response",
    version: 1,
    label: "Short Response",
    category: "question",
    schema: ShortResponseBlockSchema,
    defaults: { type: "short_response", prompt: "", acceptedAnswers: [], caseSensitive: false, grading: "correct", points: 1 } as Record<string, unknown>,
    summarize: (b) => `Short response: ${((b as { acceptedAnswers?: unknown[] }).acceptedAnswers ?? []).length} accepted answer(s)`,
    capabilities: QUESTION_CAPS,
  },
  long_text: {
    type: "long_text",
    version: 1,
    label: "Reflection",
    category: "reflection",
    schema: LongTextBlockSchema,
    defaults: { type: "long_text", prompt: "", reflection: { mode: "completion_only" } } as Record<string, unknown>,
    summarize: (b) => `Reflection (${(b as { reflection?: { mode?: string } }).reflection?.mode ?? ""})`,
    capabilities: { ...QUESTION_CAPS, canScore: false },
  },
  strategy_choice: {
    type: "strategy_choice",
    version: 1,
    label: "Strategy Choice",
    category: "decision",
    schema: StrategyChoiceBlockSchema,
    defaults: { type: "strategy_choice", prompt: "", options: [], grading: "weighted", effects: [], bands: [], points: 0 } as Record<string, unknown>,
    summarize: (b) => `Strategy choice: ${((b as { options?: unknown[] }).options ?? []).length} option(s)`,
    capabilities: DECISION_CAPS,
  },
  slider: {
    type: "slider",
    version: 1,
    label: "Slider",
    category: "decision",
    schema: SliderBlockSchema,
    defaults: { type: "slider", prompt: "", min: 0, max: 100, step: 1, unit: "number", grading: "variable_effects", effects: [], bands: [], points: 0 } as Record<string, unknown>,
    summarize: (b) => `Slider: ${(b as { min?: number }).min ?? 0}-${(b as { max?: number }).max ?? 0}`,
    capabilities: DECISION_CAPS,
  },
  price_set: {
    type: "price_set",
    version: 1,
    label: "Price Set",
    category: "decision",
    schema: PriceSetBlockSchema,
    defaults: { type: "price_set", prompt: "", min: 0, max: 100, step: 1, currency: "USD", grading: "variable_effects", effects: [], bands: [], points: 0 } as Record<string, unknown>,
    summarize: (b) => `Price set: ${(b as { currency?: string }).currency ?? "USD"}`,
    capabilities: DECISION_CAPS,
  },
  budget_allocation: {
    type: "budget_allocation",
    version: 1,
    label: "Budget Allocation",
    category: "decision",
    schema: BudgetAllocationBlockSchema,
    defaults: { type: "budget_allocation", prompt: "", totalBudget: 100, categories: [], grading: "weighted", effects: [], bands: [], points: 0 } as Record<string, unknown>,
    summarize: (b) => `Budget allocation: ${((b as { categories?: unknown[] }).categories ?? []).length} categories`,
    capabilities: DECISION_CAPS,
  },
  scenario: {
    type: "scenario",
    version: 1,
    label: "Scenario",
    category: "scenario",
    schema: ScenarioBlockSchema,
    defaults: { type: "scenario", narrative: "", choices: [] } as Record<string, unknown>,
    summarize: (b) => `Scenario: ${((b as { choices?: unknown[] }).choices ?? []).length} choice(s)`,
    capabilities: DECISION_CAPS,
  },
};

export function getBlockRegistryEntry(type: BlockType): BlockRegistryEntry {
  return BLOCK_REGISTRY[type];
}

export function listBlockRegistryEntries(): BlockRegistryEntry[] {
  return Object.values(BLOCK_REGISTRY);
}
