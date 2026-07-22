/* ============================================================
 * lib/learn/schema.ts — LessonDoc zod schema (plan §2).
 *
 * Zod is schema authority for the LessonDoc JSONB document. Published docs
 * are immutable; the schema evolves via `schemaVersion` + compat migrators
 * (lib/learn/compat.ts), never by mutating a published doc's shape.
 *
 * Isomorphic — no server/DB imports here.
 * ============================================================ */

import { z } from "zod";

/* ---------------- shared primitives ---------------- */

export const RefSchema = z.object({
  /** 'variable' refs a VariableDef by key; 'response' refs a block's answer. */
  kind: z.enum(["variable", "response"]),
  key: z.string().min(1),
  /** For response refs into multi-part blocks (e.g. an option id). */
  path: z.string().optional(),
});
export type Ref = z.infer<typeof RefSchema>;

const ConditionOpSchema = z.enum(["gte", "lte", "eq", "between"]);

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({
      op: ConditionOpSchema,
      ref: RefSchema,
      value: z.union([z.number(), z.string(), z.boolean()]).optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    }),
    z.object({
      op: z.literal("answered"),
      blockId: z.string(),
      optionId: z.string().optional(),
    }),
    z.object({
      op: z.literal("all"),
      conditions: z.array(ConditionSchema).min(1),
    }),
    z.object({
      op: z.literal("any"),
      conditions: z.array(ConditionSchema).min(1),
    }),
  ]),
);

export interface ConditionBase {
  op: "gte" | "lte" | "eq" | "between";
  ref: Ref;
  value?: number | string | boolean;
  min?: number;
  max?: number;
}
export interface ConditionAnswered {
  op: "answered";
  blockId: string;
  optionId?: string;
}
export interface ConditionAll {
  op: "all";
  conditions: Condition[];
}
export interface ConditionAny {
  op: "any";
  conditions: Condition[];
}
export type Condition = ConditionBase | ConditionAnswered | ConditionAll | ConditionAny;

export const EffectVerbSchema = z.enum([
  "increase_by",
  "decrease_by",
  "increase_pct",
  "decrease_pct",
  "set_to",
  "from_response",
]);
export type EffectVerb = z.infer<typeof EffectVerbSchema>;

export const EffectRuleSchema = z.object({
  variable: z.string().min(1),
  verb: EffectVerbSchema,
  /** Amount for increase_by/decrease_by/increase_pct/decrease_pct/set_to. */
  amount: z.number().optional(),
  /** Multiplier applied to the numeric response for from_response(scale). */
  scale: z.number().optional(),
  /** Optional gating condition — effect only applies if true. */
  when: ConditionSchema.optional(),
});
export type EffectRule = z.infer<typeof EffectRuleSchema>;

/* ---------------- meta / variables / skills ---------------- */

export const VariableDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** Starting value before any effects apply. */
  initial: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.enum(["number", "currency", "percent", "points"]).default("number"),
  /** Whether this variable shows in the player's live HUD strip. Defaults true
   * (matches every doc authored before this field existed). Purely a display
   * toggle — the variable still tracks and scores identically either way. */
  visible: z.boolean().default(true),
});
export type VariableDef = z.infer<typeof VariableDefSchema>;

export const SkillEffectSchema = z.object({
  skillId: z.string().min(1),
  /** Points awarded when this lesson's associated blocks score well. */
  maxPoints: z.number().nonnegative(),
});
export type SkillEffect = z.infer<typeof SkillEffectSchema>;

export const LessonMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  estMinutes: z.number().positive().optional(),
});
export type LessonMeta = z.infer<typeof LessonMetaSchema>;

/* ---------------- blocks ---------------- */

const BlockBaseSchema = {
  id: z.string().min(1),
  visibleIf: ConditionSchema.optional(),
};

/* ---- content blocks ---- */

export const TextBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("text"),
  body: z.string(),
});

export const HeadingBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("heading"),
  text: z.string().min(1),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
});

export const CalloutBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("callout"),
  tone: z.enum(["positive", "warning", "negative", "info"]).default("info"),
  title: z.string().optional(),
  body: z.string(),
});

export const StatBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("stat"),
  label: z.string().min(1),
  /** Literal value, or a variable ref for a live-bound stat. */
  value: z.union([z.number(), z.string(), RefSchema]),
  unit: z.enum(["number", "currency", "percent", "points"]).optional(),
});

export const ComparisonBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("comparison"),
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.union([z.number(), z.string(), RefSchema]),
        note: z.string().optional(),
      }),
    )
    .min(2),
});

export const ImageBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("image"),
  src: z.string().min(1),
  alt: z.string().min(1),
  caption: z.string().optional(),
});

/* ---- media block (general) ---- */

const MediaCompletionSchema = z.union([
  z.object({ mode: z.literal("none") }),
  z.object({ mode: z.literal("started") }),
  z.object({ mode: z.literal("percent"), threshold: z.number().min(0).max(1) }),
  z.object({ mode: z.literal("finished") }),
]);
export type MediaCompletion = z.infer<typeof MediaCompletionSchema>;

export const MediaBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("media"),
  kind: z.enum(["image", "video", "audio", "podcast"]),
  src: z.string().min(1),
  title: z.string().optional(),
  completion: MediaCompletionSchema,
});

/* ---- question (knowledge) blocks ---- */

const QuestionGradingSchema = z.enum(["correct", "weighted"]);

export const McBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("mc"),
  prompt: z.string().min(1),
  options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  correctOptionId: z.string().min(1),
  grading: QuestionGradingSchema.default("correct"),
  points: z.number().nonnegative().default(1),
  feedback: z.object({ correct: z.string().optional(), incorrect: z.string().optional() }).optional(),
});

export const MultiSelectBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("multi_select"),
  prompt: z.string().min(1),
  options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  correctOptionIds: z.array(z.string().min(1)).min(1),
  grading: QuestionGradingSchema.default("correct"),
  points: z.number().nonnegative().default(1),
});

export const TrueFalseBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("true_false"),
  prompt: z.string().min(1),
  correctAnswer: z.boolean(),
  grading: QuestionGradingSchema.default("correct"),
  points: z.number().nonnegative().default(1),
});

export const NumericBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("numeric"),
  prompt: z.string().min(1),
  correctValue: z.number(),
  tolerance: z.number().nonnegative().default(0),
  unit: z.string().optional(),
  grading: QuestionGradingSchema.default("correct"),
  points: z.number().nonnegative().default(1),
});

export const ShortResponseBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("short_response"),
  prompt: z.string().min(1),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
  caseSensitive: z.boolean().default(false),
  grading: QuestionGradingSchema.default("correct"),
  points: z.number().nonnegative().default(1),
});

/* ---- long-text / reflection block ---- */

const LongTextModeSchema = z.union([
  z.object({ mode: z.literal("completion_only") }),
  z.object({ mode: z.literal("min_words"), minWords: z.number().int().positive() }),
  // pointsPossible is optional/additive (default 0) so older published docs
  // authored before this field existed still validate/migrate cleanly — no
  // schemaVersion bump needed (docs plan §2). It caps what an instructor can
  // award in app/actions/learn-review.ts approveReview.
  z.object({ mode: z.literal("manual_review"), pointsPossible: z.number().nonnegative().default(0) }),
]);

export const LongTextBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("long_text"),
  prompt: z.string().min(1),
  placeholder: z.string().optional(),
  reflection: LongTextModeSchema,
});

/* ---- decision (tradeoff) blocks ---- */

const DecisionGradingSchema = z.enum(["weighted", "variable_effects", "rubric_bands"]);

export const RubricBandSchema = z.object({
  when: ConditionSchema,
  points: z.number(),
  feedback: z.string().optional(),
});

const DecisionCommon = {
  grading: DecisionGradingSchema,
  effects: z.array(EffectRuleSchema).default([]),
  bands: z.array(RubricBandSchema).default([]),
  points: z.number().nonnegative().default(0),
  branch: z.record(z.string(), z.string()).optional(),
};

export const StrategyChoiceBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("strategy_choice"),
  prompt: z.string().min(1),
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        effects: z.array(EffectRuleSchema).default([]),
        points: z.number().optional(),
        feedback: z.string().optional(),
        goTo: z.string().optional(),
      }),
    )
    .min(2),
  ...DecisionCommon,
});

export const SliderBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("slider"),
  prompt: z.string().min(1),
  min: z.number(),
  max: z.number(),
  step: z.number().positive().default(1),
  defaultValue: z.number().optional(),
  unit: z.enum(["number", "currency", "percent"]).default("number"),
  ...DecisionCommon,
});

export const PriceSetBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("price_set"),
  prompt: z.string().min(1),
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  step: z.number().positive().default(1),
  currency: z.string().default("USD"),
  ...DecisionCommon,
});

export const BudgetAllocationBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("budget_allocation"),
  prompt: z.string().min(1),
  totalBudget: z.number().positive(),
  categories: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  ...DecisionCommon,
});

export const RankBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("rank"),
  prompt: z.string().min(1),
  items: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  /** Item ids in the correct order (top to bottom). */
  correctOrder: z.array(z.string().min(1)).min(2),
  ...DecisionCommon,
});

/** Shared by categorize + drag_drop — buckets students drop items into. */
export const CategorizeBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("categorize"),
  prompt: z.string().min(1),
  categories: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  items: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), correctCategoryId: z.string().min(1) })).min(2),
  ...DecisionCommon,
});

export const DragDropBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("drag_drop"),
  prompt: z.string().min(1),
  categories: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  items: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), correctCategoryId: z.string().min(1) })).min(2),
  ...DecisionCommon,
});

export const MatchBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("match"),
  prompt: z.string().min(1),
  pairs: z
    .array(z.object({ id: z.string().min(1), left: z.string().min(1), right: z.string().min(1) }))
    .min(2),
  ...DecisionCommon,
});

export const TradeoffMatrixBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("tradeoff_matrix"),
  prompt: z.string().min(1),
  criteria: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(2),
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        /** Reference values shown to the student for each criterion (informational, not graded). */
        values: z.record(z.string(), z.number()),
        effects: z.array(EffectRuleSchema).default([]),
        points: z.number().optional(),
        feedback: z.string().optional(),
        goTo: z.string().optional(),
      }),
    )
    .min(2),
  ...DecisionCommon,
});

export const ForecastBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("forecast"),
  prompt: z.string().min(1),
  unit: z.enum(["number", "currency", "percent"]).default("number"),
  correctValue: z.number(),
  tolerance: z.number().nonnegative(),
  ...DecisionCommon,
});

/* ---- content: table / chart / timeline ---- */

export const TableBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("table"),
  caption: z.string().optional(),
  columns: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })).min(1),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).min(1),
});

export const ChartBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("chart"),
  chartKind: z.enum(["bar", "line"]).default("bar"),
  title: z.string().optional(),
  unit: z.enum(["number", "currency", "percent"]).default("number"),
  /** Static data points, or a variable ref per point for live-bound series. */
  series: z.array(z.object({ label: z.string().min(1), value: z.union([z.number(), RefSchema]) })).min(1),
});

export const TimelineBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("timeline"),
  events: z.array(z.object({ label: z.string().min(1), when: z.string().min(1), description: z.string().optional() })).min(1),
});

/* ---- scenario block ---- */

export const ScenarioChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  effects: z.array(EffectRuleSchema).default([]),
  points: z.number().optional(),
  feedback: z.string().optional(),
  goTo: z.string().optional(),
});

export const ScenarioBlockSchema = z.object({
  ...BlockBaseSchema,
  type: z.literal("scenario"),
  narrative: z.string().min(1),
  choices: z.array(ScenarioChoiceSchema).min(2),
});

/* ---- discriminated union ---- */

export const BlockSchema = z.discriminatedUnion("type", [
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
  RankBlockSchema,
  CategorizeBlockSchema,
  DragDropBlockSchema,
  MatchBlockSchema,
  TradeoffMatrixBlockSchema,
  ForecastBlockSchema,
  TableBlockSchema,
  ChartBlockSchema,
  TimelineBlockSchema,
  ScenarioBlockSchema,
]);
export type Block = z.infer<typeof BlockSchema>;
export type BlockType = Block["type"];

/* ---------------- phases ---------------- */

export const PhaseKindSchema = z.enum([
  "Briefing",
  "Learn",
  "Decision",
  "Consequence",
  "FollowUp",
  "Challenge",
]);
export type PhaseKind = z.infer<typeof PhaseKindSchema>;

export const PhaseSchema = z.object({
  id: z.string().min(1),
  kind: PhaseKindSchema,
  title: z.string().min(1),
  blocks: z.array(BlockSchema).min(1),
});
export type Phase = z.infer<typeof PhaseSchema>;

/* ---------------- scoring / results ---------------- */

export const ScoringSchema = z.object({
  mode: z.literal("points"),
  starThresholds: z.tuple([z.number(), z.number(), z.number()]),
  xp: z.object({
    base: z.number().nonnegative(),
    perStar: z.number().nonnegative(),
    firstCompletionBonus: z.number().nonnegative(),
  }),
  replayPolicy: z
    .object({
      improvedXpPct: z.number().min(0).max(1).default(0.25),
      noImprovementXpFloor: z.number().nonnegative().default(0),
    })
    .default({ improvedXpPct: 0.25, noImprovementXpFloor: 0 }),
  badges: z.array(z.string()).default([]),
});
export type Scoring = z.infer<typeof ScoringSchema>;

export const ResultsSchema = z.object({
  showVariables: z.boolean().default(true),
  showSkillDeltas: z.boolean().default(true),
  celebrationCopy: z.string().optional(),
  /** Lesson id to promote as "next lesson" on the results screen. Optional —
   * absent means no CTA is shown (author hasn't set a suggested next step). */
  ctaNextLessonId: z.string().optional(),
});
export type Results = z.infer<typeof ResultsSchema>;

/* ---------------- top-level LessonDoc ---------------- */

export const LessonDocSchema = z.object({
  schemaVersion: z.literal(1),
  meta: LessonMetaSchema,
  variables: z.array(VariableDefSchema).default([]),
  skills: z.array(SkillEffectSchema).default([]),
  phases: z.array(PhaseSchema).min(1),
  scoring: ScoringSchema,
  results: ResultsSchema,
});
export type LessonDoc = z.infer<typeof LessonDocSchema>;
