/* ============================================================
 * lib/learn/importLegacy.ts — Stage 10 legacy → LessonDoc transformer.
 *
 * Pure transform: lib/lessons.ts `Lesson` -> a DRAFT `LessonDoc` (current
 * schemaVersion). Automated import is NOT "finished migration" — every
 * produced doc is a starting point for interactive redesign in Studio
 * before publish (plan §6 Stage 10). Every doc gets:
 *   - a callout block at the top of Briefing marked
 *     "IMPORTED — NEEDS INTERACTIVE REDESIGN"
 *   - meta.tags including "imported-draft"
 *
 * No DB/server imports here — isomorphic, unit-testable in memory.
 * ============================================================ */

import type { Lesson } from "../lessons";
import type { Block, LessonDoc, Phase } from "./types";

export const IMPORTED_DRAFT_TAG = "imported-draft";

export function metaTags(doc: LessonDoc): string[] {
  return doc.meta.tags ?? [];
}

function withTags(doc: LessonDoc, tags: string[]): LessonDoc {
  return { ...doc, meta: { ...doc.meta, tags } };
}

/** Parse "12 min" -> 12. Falls back to undefined for unparseable/empty strings. */
function parseDurationMinutes(duration: string): number | undefined {
  const match = /(\d+)/.exec(duration);
  if (!match) return undefined;
  return Number(match[1]);
}

let idCounter = 0;
/** Deterministic, collision-free block ids scoped to a single transform call.
 * Reset per lesson via resetIds() so output is stable/reproducible across runs. */
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
function resetIds(): void {
  idCounter = 0;
}

const IMPORT_MARKER_BODY =
  "This lesson was auto-imported from the legacy curriculum (lib/lessons.ts). " +
  "It is a draft starting point only — content, block choices, and grading below " +
  "need interactive redesign in Studio before publish. See docs/learn/stage10-migration.md " +
  "for the redesign checklist.";

function buildBriefing(lesson: Lesson): Phase {
  const blocks: Block[] = [
    {
      id: nextId("brief-imported-marker"),
      type: "callout",
      tone: "warning",
      title: "IMPORTED — NEEDS INTERACTIVE REDESIGN",
      body: IMPORT_MARKER_BODY,
    },
    {
      id: nextId("brief-heading"),
      type: "heading",
      text: lesson.title,
      level: 2,
    },
  ];

  if (lesson.caseNumber) {
    blocks.push({
      id: nextId("brief-case"),
      type: "text",
      body: lesson.caseNumber,
    });
  }

  if (lesson.role || lesson.deadline) {
    blocks.push({
      id: nextId("brief-role"),
      type: "callout",
      tone: "info",
      title: lesson.role || "Your Role",
      body: lesson.deadline || "",
    });
  }

  if (lesson.centralQuestion) {
    blocks.push({
      id: nextId("brief-central-question"),
      type: "heading",
      text: lesson.centralQuestion,
      level: 3,
    });
  }

  for (const paragraph of lesson.situation) {
    blocks.push({
      id: nextId("brief-situation"),
      type: "text",
      body: paragraph,
    });
  }

  if (lesson.overview) {
    blocks.push({
      id: nextId("brief-overview"),
      type: "text",
      body: lesson.overview,
    });
  }

  return { id: nextId("phase-briefing"), kind: "Briefing", title: "Briefing", blocks };
}

function buildLearn(lesson: Lesson): Phase {
  const blocks: Block[] = [];

  for (const ntk of lesson.needToKnow) {
    blocks.push({
      id: nextId("learn-ntk"),
      type: "callout",
      tone: "info",
      title: ntk.term,
      body: ntk.body,
    });
  }

  if (lesson.evidence.length > 0) {
    for (const ev of lesson.evidence) {
      blocks.push({
        id: nextId("learn-evidence"),
        type: "stat",
        label: ev.label,
        value: ev.value,
      });
    }
  }

  if (lesson.learningOutcomes.length > 0) {
    const summary = lesson.learningOutcomes
      .map((o) => `${o.concept}: ${o.use}`)
      .join("\n\n");
    blocks.push({
      id: nextId("learn-outcomes"),
      type: "callout",
      tone: "positive",
      title: "Learning Outcomes",
      body: summary,
    });
  }

  if (blocks.length === 0) {
    // Every phase requires >=1 block (PhaseSchema.blocks.min(1)).
    blocks.push({
      id: nextId("learn-placeholder"),
      type: "text",
      body: lesson.summary || lesson.overview || "(no legacy Learn content — needs authoring)",
    });
  }

  return { id: nextId("phase-learn"), kind: "Learn", title: "Learn", blocks };
}

function buildDecision(lesson: Lesson): Phase {
  const blocks: Block[] = [];

  for (const s of lesson.stakeholders) {
    const body = [s.interest, s.concern, s.conflict].filter(Boolean).join(" ");
    blocks.push({
      id: nextId("decision-stakeholder"),
      type: "text",
      body: `${s.name}: ${body}`,
    });
  }

  if (lesson.decisionOptions.length >= 2) {
    blocks.push({
      id: nextId("decision-strategy"),
      type: "strategy_choice",
      prompt: lesson.decisionPrompt || lesson.centralQuestion || "What do you decide?",
      // Flagged for author review: legacy data has no "correct" answer, so
      // every option is scored equally by default — an author must revisit
      // this weighting (or switch grading modes) before publish.
      options: lesson.decisionOptions.map((opt, i) => ({
        id: `option-${i + 1}`,
        label: opt.label,
        effects: [],
        points: 1,
        feedback: opt.detail
          ? `${opt.detail} [NEEDS REVIEW: legacy import — all options scored equally]`
          : "[NEEDS REVIEW: legacy import — all options scored equally]",
      })),
      grading: "weighted",
      effects: [],
      bands: [],
      // Every legacy option is worth 1 point (all options equal by default —
      // flagged above for author review); the block's own points-possible
      // must equal the max a student can score, i.e. one option's worth.
      points: 1,
    });
  } else {
    // No legacy decision options to import — leave an explicit placeholder
    // so the phase still has content and the gap is obvious to the author.
    // manual_review (not completion_only) so the doc still has a nonzero
    // scoring budget pending the author's real decision block — flagged for
    // review, not an invented "correct" answer.
    blocks.push({
      id: nextId("decision-placeholder"),
      type: "long_text",
      prompt:
        (lesson.decisionPrompt || lesson.centralQuestion || "What would you decide, and why?") +
        " [NEEDS REDESIGN: legacy import had no decision options — replace with a real decision block]",
      reflection: { mode: "manual_review", pointsPossible: 10 },
    });
  }

  return { id: nextId("phase-decision"), kind: "Decision", title: "Decision", blocks };
}

function buildFollowUp(lesson: Lesson): Phase {
  const blocks: Block[] = lesson.discussionQuestions.map((q) => ({
    id: nextId("followup-question"),
    type: "long_text" as const,
    prompt: q,
    reflection: { mode: "completion_only" as const },
  }));

  if (lesson.podcastUrl) {
    blocks.push({
      id: nextId("followup-media"),
      type: "media",
      kind: "podcast",
      src: lesson.podcastUrl,
      title: lesson.podcastTitle ?? lesson.podcastEpisode ?? "Related episode",
      completion: { mode: "percent", threshold: 0.8 },
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      id: nextId("followup-placeholder"),
      type: "text",
      body: "(no legacy discussion questions — needs authoring)",
    });
  }

  return { id: nextId("phase-followup"), kind: "FollowUp", title: "Follow-Up", blocks };
}

function buildChallenge(lesson: Lesson): Phase {
  const blocks: Block[] = [
    {
      id: nextId("challenge-placeholder"),
      type: "long_text",
      prompt: `Real-world challenge: apply "${lesson.concepts.join(", ") || lesson.title}" to a decision outside this case. [NEEDS REDESIGN: legacy import placeholder]`,
      reflection: { mode: "completion_only" },
    },
  ];
  return { id: nextId("phase-challenge"), kind: "Challenge", title: "Challenge", blocks };
}

/** Transform one legacy Lesson into a draft LessonDoc (schemaVersion: current). */
export function importLegacyLesson(lesson: Lesson): LessonDoc {
  resetIds();

  const tags = [...lesson.concepts, IMPORTED_DRAFT_TAG];
  const estMinutes = parseDurationMinutes(lesson.duration);

  const doc: LessonDoc = {
    schemaVersion: 1,
    meta: {
      title: lesson.title,
      description: lesson.summary || lesson.overview || undefined,
      estMinutes,
    },
    variables: [],
    skills: [],
    phases: [
      buildBriefing(lesson),
      buildLearn(lesson),
      buildDecision(lesson),
      buildFollowUp(lesson),
      buildChallenge(lesson),
    ],
    scoring: {
      mode: "points",
      starThresholds: [50, 70, 90],
      xp: { base: 100, perStar: 20, firstCompletionBonus: 50 },
      replayPolicy: { improvedXpPct: 0.25, noImprovementXpFloor: 0 },
      badges: [],
    },
    results: {
      showVariables: true,
      showSkillDeltas: true,
    },
  };

  return withTags(doc, tags);
}

/** True if a doc is still a pristine machine-imported draft (never author-edited). */
export function isImportedDraft(doc: LessonDoc): boolean {
  return metaTags(doc).includes(IMPORTED_DRAFT_TAG);
}
