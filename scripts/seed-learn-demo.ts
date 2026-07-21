/* ============================================================
 * scripts/seed-learn-demo.ts — Stage 2 demo lesson seed.
 *
 * Seeds one track/module/lesson (published v1) exercising every Stage-2
 * block: content blocks (heading/text/callout), a media (podcast) block, an
 * MCQ, a price slider with variable effects + rubric bands, a budget
 * allocation, and a scenario
 * branch at the end of Decision (so both branches still pass through the
 * Learn/Decision content instead of skipping it) that resolves in the
 * Consequence phase via visibleIf-gated callouts, plus a Challenge MCQ.
 * Theme: rivalry-game ticket pricing.
 *
 * Runnable via `npm run seed:learn-demo` when POSTGRES_URL is set. No live
 * DB in this container — this script is correct by construction and
 * validated locally against zod + validateLessonDoc before any DB write, so
 * a bad doc fails loudly before touching the database either way.
 * ============================================================ */

import { randomUUID, createHash } from "node:crypto";
import { sqlLearn } from "../lib/db-sql";
import { LessonDocSchema, type LessonDoc } from "../lib/learn/schema";
import { validateLessonDoc } from "../lib/learn/validate";

const doc: LessonDoc = {
  schemaVersion: 1,
  meta: {
    title: "Rivalry Night: Price the Tickets",
    description: "Set ticket prices for the season's biggest rivalry game and live with the tradeoffs.",
    estMinutes: 10,
  },
  variables: [
    { key: "attendance", label: "Projected Attendance", initial: 8000, min: 0, unit: "number" },
    { key: "revenue", label: "Ticket Revenue", initial: 0, unit: "currency" },
    { key: "fanSentiment", label: "Fan Sentiment", initial: 70, min: 0, max: 100, unit: "percent" },
  ],
  // skillId matches learn_skills.id (the FK target), not its slug — see the
  // learn_skills insert below (id: 'skill-pricing-strategy').
  skills: [{ skillId: "skill-pricing-strategy", maxPoints: 20 }],
  phases: [
    {
      id: "phase-briefing",
      kind: "Briefing",
      title: "The Rivalry Game",
      blocks: [
        {
          id: "brief-heading",
          type: "heading",
          text: "Rivalry Night",
          level: 2,
        },
        {
          id: "brief-text",
          type: "text",
          body:
            "It's rivalry week. Ticket demand is running hot, but last year's price hike cost you fan goodwill. The front office wants a pricing plan before Friday's on-sale.",
        },
        {
          id: "brief-media",
          type: "media",
          kind: "podcast",
          src: "https://example.com/audio/rivalry-briefing.mp3",
          title: "GM Briefing: Rivalry Week",
          completion: { mode: "started" },
        },
      ],
    },
    {
      id: "phase-learn",
      kind: "Learn",
      title: "Elasticity, Fast",
      blocks: [
        {
          id: "learn-heading",
          type: "heading",
          text: "Elasticity in one screen",
          level: 2,
        },
        {
          id: "learn-text",
          type: "text",
          body:
            "Ticket demand is elastic near the top of the market: push price up too far and attendance falls faster than revenue rises. Rivalry games shift the curve right — fans tolerate a higher price — but the curve still bends.",
        },
        {
          id: "learn-callout",
          type: "callout",
          tone: "info",
          title: "Rule of thumb",
          body: "A price hike only helps if the attendance drop it causes is smaller, in percentage terms, than the price increase.",
        },
        {
          id: "learn-mc",
          type: "mc",
          prompt: "A rivalry game shifts the demand curve. What does that mean for pricing?",
          options: [
            { id: "a", label: "Fans tolerate a higher price before attendance drops" },
            { id: "b", label: "Price no longer affects attendance at all" },
            { id: "c", label: "The team should always charge the league maximum" },
            { id: "d", label: "Demand becomes perfectly inelastic" },
          ],
          correctOptionId: "a",
          grading: "correct",
          points: 10,
          feedback: {
            correct: "Right — the curve shifts, it doesn't disappear.",
            incorrect: "Not quite — the curve shifts right, but it still bends eventually.",
          },
        },
      ],
    },
    {
      id: "phase-decision",
      kind: "Decision",
      title: "Set the Price",
      blocks: [
        {
          id: "decision-price",
          type: "price_set",
          prompt: "Set the average ticket price for rivalry night.",
          min: 20,
          max: 80,
          step: 5,
          currency: "USD",
          grading: "rubric_bands",
          points: 15,
          effects: [
            {
              variable: "revenue",
              verb: "from_response",
              scale: 8000,
            },
            {
              variable: "attendance",
              verb: "decrease_pct",
              amount: 20,
              when: { op: "gte", ref: { kind: "response", key: "decision-price" }, value: 55 },
            },
          ],
          bands: [
            {
              when: { op: "gte", ref: { kind: "response", key: "decision-price" }, value: 60 },
              points: 6,
              feedback: "Premium pricing — you'll bank more per seat, but expect empty sections.",
            },
            {
              when: { op: "between", ref: { kind: "response", key: "decision-price" }, min: 35, max: 55 },
              points: 15,
              feedback: "The sweet spot — strong revenue without pricing out the regulars.",
            },
            {
              when: { op: "lte", ref: { kind: "response", key: "decision-price" }, value: 30 },
              points: 8,
              feedback: "You'll sell every seat, but you left money on the table.",
            },
          ],
        },
        {
          id: "decision-budget",
          type: "budget_allocation",
          prompt: "Allocate this week's $10,000 marketing budget across channels.",
          totalBudget: 10000,
          grading: "weighted",
          points: 15,
          bands: [],
          categories: [
            { id: "social", label: "Social / Digital" },
            { id: "email", label: "Season Ticket Email" },
            { id: "local-media", label: "Local Media Buy" },
          ],
          effects: [{ variable: "fanSentiment", verb: "from_response", scale: 0.0005 }],
        },
        {
          id: "decision-scenario",
          type: "scenario",
          narrative: "Ownership wants your final call on tone: how does the organization talk about this price publicly?",
          choices: [
            {
              id: "aggressive",
              label: "Lean into it — “this is what the rivalry is worth”",
              points: 5,
              effects: [{ variable: "fanSentiment", verb: "decrease_by", amount: 5 }],
              feedback: "You're betting the rivalry sells itself, even at a premium.",
              goTo: "conseq-aggressive",
            },
            {
              id: "steady",
              label: "Frame it as investment in the fan experience",
              points: 5,
              effects: [{ variable: "fanSentiment", verb: "increase_by", amount: 5 }],
              feedback: "You're trading some upside for a fanbase that keeps showing up.",
              goTo: "conseq-steady",
            },
          ],
        },
      ],
    },
    {
      id: "phase-consequence",
      kind: "Consequence",
      title: "How It Played Out",
      blocks: [
        {
          id: "conseq-aggressive",
          type: "callout",
          tone: "warning",
          title: "Aggressive pricing",
          body: "Revenue per seat is up, but the fan forums are loud about it. Watch sentiment heading into the next homestand.",
          visibleIf: { op: "answered", blockId: "decision-scenario", optionId: "aggressive" },
        },
        {
          id: "conseq-steady",
          type: "callout",
          tone: "positive",
          title: "Steady pricing",
          body: "You left some revenue on the table, but the building will be loud — and season-ticket renewals should hold.",
          visibleIf: { op: "answered", blockId: "decision-scenario", optionId: "steady" },
        },
      ],
    },
    {
      id: "phase-followup",
      kind: "FollowUp",
      title: "Debrief",
      blocks: [
        {
          id: "followup-text",
          type: "text",
          body: "Every pricing call trades revenue against goodwill. There's no universally correct price — only the one that fits this fanbase, this rivalry, this season.",
        },
      ],
    },
    {
      id: "phase-challenge",
      kind: "Challenge",
      title: "One More Look",
      blocks: [
        {
          id: "challenge-mc",
          type: "mc",
          prompt: "If fan sentiment matters more than one night's revenue, which approach fits best?",
          options: [
            { id: "a", label: "Steady pricing that protects renewals" },
            { id: "b", label: "Maximum price every game, every season" },
            { id: "c", label: "Ignore sentiment — it doesn't affect revenue" },
          ],
          correctOptionId: "a",
          grading: "correct",
          points: 10,
        },
      ],
    },
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
    celebrationCopy: "Rivalry night is priced. Every number on this board came from a decision you made.",
  },
};

async function main() {
  // Validate before touching the DB — correct by construction.
  const parsed = LessonDocSchema.parse(doc);
  const validation = validateLessonDoc(parsed);
  if (validation.errors.length > 0) {
    throw new Error(`[seed-learn-demo] LessonDoc failed validation:\n${validation.errors.join("\n")}`);
  }
  if (validation.warnings.length > 0) {
    console.warn(`[seed-learn-demo] Validation warnings:\n${validation.warnings.join("\n")}`);
  }

  const now = Date.now();
  const trackId = "track-rivalry-demo";
  const moduleId = "module-rivalry-demo";
  const lessonId = "lesson-rivalry-ticket-pricing";
  const versionId = `lv-${randomUUID().slice(0, 12)}`;
  const docJson = JSON.stringify(parsed);
  const docHash = createHash("sha256").update(docJson).digest("hex");

  await sqlLearn`
    INSERT INTO learn_tracks (id, slug, title, description, lifecycle, sort, theme, created_at, updated_at)
    VALUES (${trackId}, 'rivalry-demo', 'Front Office Fundamentals (Demo)', 'Stage 2 thin-player demo track.', 'active', 0, '{}'::jsonb, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
  `;

  await sqlLearn`
    INSERT INTO learn_modules (id, track_id, slug, title, description, sort, lifecycle, unlock, created_at, updated_at)
    VALUES (${moduleId}, ${trackId}, 'ticket-pricing', 'Ticket Pricing', 'Pricing decisions under real tradeoffs.', 0, 'active', '{}'::jsonb, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
  `;

  await sqlLearn`
    INSERT INTO learn_lessons (id, module_id, slug, title, lifecycle, draft_doc, draft_revision, est_minutes, sort, is_template, created_at, updated_at)
    VALUES (${lessonId}, ${moduleId}, 'rivalry-ticket-pricing', ${parsed.meta.title}, 'active', ${docJson}::jsonb, 1, ${parsed.meta.estMinutes ?? null}, 0, false, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
  `;

  await sqlLearn`
    INSERT INTO learn_lesson_versions (id, lesson_id, version, doc, doc_hash, published_at, changelog)
    VALUES (${versionId}, ${lessonId}, 1, ${docJson}::jsonb, ${docHash}, ${now}, 'Stage 2 demo seed — v1')
    ON CONFLICT (lesson_id, version) DO NOTHING
  `;

  // Only set published_version_id if this lesson doesn't already have one
  // (idempotent re-run should not overwrite a later published version).
  await sqlLearn`
    UPDATE learn_lessons SET published_version_id = ${versionId}
    WHERE id = ${lessonId} AND published_version_id IS NULL
  `;

  await sqlLearn`
    INSERT INTO learn_skills (id, slug, label, icon, sort, description)
    VALUES ('skill-pricing-strategy', 'pricing-strategy', 'Pricing Strategy', null, 0, 'Balancing revenue against fan goodwill.')
    ON CONFLICT (id) DO NOTHING
  `;

  console.log(`[seed-learn-demo] Seeded lesson "${lessonId}" as published v1 (${versionId}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
