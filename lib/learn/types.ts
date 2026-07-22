/* ============================================================
 * lib/learn/types.ts — inferred TypeScript types re-exported from schema.ts.
 *
 * Prefer importing types from here in non-schema code; import the zod
 * schemas themselves from lib/learn/schema.ts.
 * ============================================================ */

export type {
  LessonDoc,
  LessonMeta,
  VariableDef,
  SkillEffect,
  Phase,
  PhaseKind,
  Block,
  BlockType,
  Condition,
  Ref,
  EffectRule,
  EffectVerb,
  Scoring,
  Results,
  MediaCompletion,
} from "./schema";
