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
 *
 * Local/CI only: refuses to run against a non-loopback database host unless
 * ALLOW_REMOTE_DB_SETUP=1, matching scripts/seed-dev.ts's guard.
 * ============================================================ */

import { randomUUID, createHash } from "node:crypto";
import { sqlLearn } from "../lib/db-sql";
import { LessonDocSchema, type LessonDoc } from "../lib/learn/schema";
import { validateLessonDoc } from "../lib/learn/validate";

function assertLocal(): void {
  if (process.env.ALLOW_REMOTE_DB_SETUP === "1") return;
  const raw = (process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "").trim();
  let host = "";
  try {
    host = raw ? new URL(raw).hostname : "";
  } catch {
    /* non-URL DSNs fall through */
  }
  if (!(host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "")) {
    throw new Error(
      `[seed-learn-demo] Refusing to seed non-local host "${host}". Set ALLOW_REMOTE_DB_SETUP=1 if certain.`,
    );
  }
}

const doc: LessonDoc = {
  schemaVersion: 1,
  meta: {
    title: "Rivalry Night: Price the Tickets",
    description: "Set ticket prices for the season's biggest rivalry game and live with the tradeoffs.",
    estMinutes: 10,
  },
  variables: [
    { key: "attendance", label: "Projected Attendance", initial: 8000, min: 0, unit: "number", visible: true },
    { key: "revenue", label: "Ticket Revenue", initial: 0, unit: "currency", visible: true },
    { key: "fanSentiment", label: "Fan Sentiment", initial: 70, min: 0, max: 100, unit: "percent", visible: true },
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

/* ============================================================
 * Stage 6 demo lesson — "Draft Night Analytics" — exercises every block
 * added/completed in the interaction expansion: multi_select, true_false,
 * numeric, short_response, long_text (manual_review), strategy_choice,
 * rank, categorize, drag_drop, match, tradeoff_matrix, forecast, table,
 * chart, timeline. Composed from existing primitives per the plan's "data
 * interactions" note — no bespoke engine:
 *   - "interpret graph" -> chart block followed by a numeric/mc question
 *     referencing the same data.
 *   - "identify trend" -> chart + true_false about the trend direction.
 *   - "adjust variables" -> slider bound to a variable, feeding a stat/
 *     chart shown afterward.
 *   - "compare scenarios" -> tradeoff_matrix (reference table + choice).
 * ============================================================ */
const stage6Doc: LessonDoc = {
  schemaVersion: 1,
  meta: {
    title: "Draft Night Analytics",
    description: "Stage 6 interaction-expansion demo: every new block type in one lesson.",
    estMinutes: 12,
  },
  variables: [{ key: "cap_space", label: "Cap Space", initial: 20, min: 0, unit: "currency", visible: true }],
  skills: [],
  phases: [
    {
      id: "s6-briefing",
      kind: "Briefing",
      title: "Draft Night",
      blocks: [
        { id: "s6-heading", type: "heading", text: "Draft Night Analytics", level: 2 },
        {
          id: "s6-chart",
          type: "chart",
          chartKind: "bar",
          title: "Ticket revenue by quarter ($M)",
          unit: "currency",
          series: [
            { label: "Q1", value: 4 },
            { label: "Q2", value: 6 },
            { label: "Q3", value: 5 },
            { label: "Q4", value: 9 },
          ],
        },
        {
          id: "s6-trend-tf",
          type: "true_false",
          prompt: "True or false: revenue trended upward across the season.",
          correctAnswer: true,
          grading: "correct",
          points: 2,
        },
        {
          id: "s6-table",
          type: "table",
          caption: "Roster cap hits",
          columns: [{ key: "player", label: "Player" }, { key: "cap", label: "Cap Hit ($M)" }],
          rows: [{ player: "Vet Starter", cap: 8 }, { player: "Rookie", cap: 1 }],
        },
        {
          id: "s6-timeline",
          type: "timeline",
          events: [
            { label: "Free agency opens", when: "Day 1" },
            { label: "Draft", when: "Day 3", description: "First round picks locked in." },
          ],
        },
      ],
    },
    {
      id: "s6-learn",
      kind: "Learn",
      title: "Know the Numbers",
      blocks: [
        {
          id: "s6-multi",
          type: "multi_select",
          prompt: "Which of these increase cap space? (select all that apply)",
          options: [
            { id: "a", label: "Restructuring a veteran contract" },
            { id: "b", label: "Signing a max free agent" },
            { id: "c", label: "Releasing an underperforming veteran" },
          ],
          correctOptionIds: ["a", "c"],
          grading: "correct",
          points: 2,
        },
        {
          id: "s6-numeric",
          type: "numeric",
          prompt: "If cap space is $20M and you restructure a $6M deal for $2M in savings, what's the new cap space?",
          correctValue: 22,
          tolerance: 0,
          unit: "$M",
          grading: "correct",
          points: 2,
        },
        {
          id: "s6-short",
          type: "short_response",
          prompt: "What's the term for a contract designed to lower current-year cap hit?",
          acceptedAnswers: ["restructure", "restructuring"],
          caseSensitive: false,
          grading: "correct",
          points: 1,
        },
      ],
    },
    {
      id: "s6-decision",
      kind: "Decision",
      title: "Make the Calls",
      blocks: [
        {
          id: "s6-rank",
          type: "rank",
          prompt: "Rank these draft needs from most to least urgent.",
          items: [
            { id: "line", label: "Offensive line" },
            { id: "corner", label: "Cornerback depth" },
            { id: "kicker", label: "Backup kicker" },
          ],
          correctOrder: ["line", "corner", "kicker"],
          grading: "weighted",
          effects: [],
          bands: [],
          points: 3,
        },
        {
          id: "s6-categorize",
          type: "categorize",
          prompt: "Sort each move into Cap-Positive or Cap-Negative.",
          categories: [{ id: "positive", label: "Cap-Positive" }, { id: "negative", label: "Cap-Negative" }],
          items: [
            { id: "release", label: "Release a veteran", correctCategoryId: "positive" },
            { id: "extend", label: "Extend a star early", correctCategoryId: "negative" },
          ],
          grading: "weighted",
          effects: [],
          bands: [],
          points: 2,
        },
        {
          id: "s6-dragdrop",
          type: "drag_drop",
          prompt: "Place each position group into its unit.",
          categories: [{ id: "offense", label: "Offense" }, { id: "defense", label: "Defense" }],
          items: [
            { id: "qb", label: "Quarterback", correctCategoryId: "offense" },
            { id: "de", label: "Defensive End", correctCategoryId: "defense" },
          ],
          grading: "weighted",
          effects: [],
          bands: [],
          points: 2,
        },
        {
          id: "s6-match",
          type: "match",
          prompt: "Match each term to its definition.",
          pairs: [
            { id: "p1", left: "Dead cap", right: "Cap hit from a player no longer on the roster" },
            { id: "p2", left: "Void year", right: "A contract year added only to spread cap hit" },
          ],
          grading: "weighted",
          effects: [],
          bands: [],
          points: 2,
        },
        {
          id: "s6-slider",
          type: "slider",
          prompt: "How much cap space do you commit to free agency this offseason?",
          min: 0,
          max: 20,
          step: 1,
          unit: "currency",
          grading: "variable_effects",
          effects: [{ variable: "cap_space", verb: "from_response", scale: -1 }],
          bands: [],
          points: 0,
        },
        {
          id: "s6-forecast",
          type: "forecast",
          prompt: "Predict next season's home attendance average (thousands).",
          unit: "number",
          correctValue: 62,
          tolerance: 5,
          grading: "weighted",
          effects: [],
          bands: [],
          points: 3,
        },
        {
          id: "s6-tradeoff",
          type: "tradeoff_matrix",
          prompt: "Compare two free-agent targets and choose one.",
          criteria: [{ id: "cost", label: "Cost ($M)" }, { id: "impact", label: "Projected Win Impact" }],
          options: [
            { id: "targetA", label: "Veteran All-Pro", values: { cost: 18, impact: 9 }, effects: [], points: 3 },
            { id: "targetB", label: "Rising Second-Contract Player", values: { cost: 9, impact: 6 }, effects: [], points: 2 },
          ],
          grading: "weighted",
          effects: [],
          bands: [],
          points: 3,
        },
        {
          id: "s6-strategy",
          type: "strategy_choice",
          prompt: "How do you approach the remaining cap space?",
          options: [
            { id: "spend", label: "Spend it all in free agency", effects: [{ variable: "cap_space", verb: "set_to", amount: 0 }], points: 2 },
            { id: "hold", label: "Hold cap space for in-season moves", effects: [], points: 3 },
          ],
          grading: "weighted",
          effects: [],
          bands: [],
          points: 3,
        },
      ],
    },
    {
      id: "s6-followup",
      kind: "FollowUp",
      title: "Reflect",
      blocks: [
        {
          id: "s6-reflection",
          type: "long_text",
          prompt: "Which decision tonight do you feel least confident about, and why?",
          placeholder: "Type your reflection...",
          reflection: { mode: "manual_review", pointsPossible: 10 },
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
    celebrationCopy: "Draft night is in the books.",
  },
};

async function main() {
  assertLocal();
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
    VALUES (${lessonId}, ${moduleId}, 'rivalry-ticket-pricing', ${parsed.meta.title}, 'active', ${sqlLearn.json(parsed as never)}, 1, ${parsed.meta.estMinutes ?? null}, 0, false, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
  `;

  await sqlLearn`
    INSERT INTO learn_lesson_versions (id, lesson_id, version, doc, doc_hash, published_at, changelog)
    VALUES (${versionId}, ${lessonId}, 1, ${sqlLearn.json(parsed as never)}, ${docHash}, ${now}, 'Stage 2 demo seed — v1')
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

  // ---- Stage 6 second seed lesson ----
  const parsed6 = LessonDocSchema.parse(stage6Doc);
  const validation6 = validateLessonDoc(parsed6);
  if (validation6.errors.length > 0) {
    throw new Error(`[seed-learn-demo] Stage 6 LessonDoc failed validation:\n${validation6.errors.join("\n")}`);
  }
  if (validation6.warnings.length > 0) {
    console.warn(`[seed-learn-demo] Stage 6 validation warnings:\n${validation6.warnings.join("\n")}`);
  }

  const lessonId6 = "lesson-draft-night-analytics";
  const versionId6 = `lv-${randomUUID().slice(0, 12)}`;
  const docJson6 = JSON.stringify(parsed6);
  const docHash6 = createHash("sha256").update(docJson6).digest("hex");

  await sqlLearn`
    INSERT INTO learn_lessons (id, module_id, slug, title, lifecycle, draft_doc, draft_revision, est_minutes, sort, is_template, created_at, updated_at)
    VALUES (${lessonId6}, ${moduleId}, 'draft-night-analytics', ${parsed6.meta.title}, 'active', ${sqlLearn.json(parsed6 as never)}, 1, ${parsed6.meta.estMinutes ?? null}, 1, false, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
  `;

  await sqlLearn`
    INSERT INTO learn_lesson_versions (id, lesson_id, version, doc, doc_hash, published_at, changelog)
    VALUES (${versionId6}, ${lessonId6}, 1, ${sqlLearn.json(parsed6 as never)}, ${docHash6}, ${now}, 'Stage 6 interaction-expansion demo seed — v1')
    ON CONFLICT (lesson_id, version) DO NOTHING
  `;

  await sqlLearn`
    UPDATE learn_lessons SET published_version_id = ${versionId6}
    WHERE id = ${lessonId6} AND published_version_id IS NULL
  `;

  console.log(`[seed-learn-demo] Seeded lesson "${lessonId6}" as published v1 (${versionId6}).`);

  // ---- Stage 7 demo map: 2 franchise-department sections, 4+ nodes ----
  // Ticket Operations (department 1): the two demo lessons plus a
  // checkpoint. Front Office (department 2): one bonus_challenge node
  // gated on stars earned in department 1 — the "locked-by-stars" case —
  // so the CareerMap renders a meaningful locked state out of the box.
  const section1 = "map-section-ticket-ops";
  const section2 = "map-section-front-office";

  await sqlLearn`
    INSERT INTO learn_map_sections (id, track_id, title, subtitle, sort, theme)
    VALUES (${section1}, ${trackId}, 'Ticket Operations', 'Pricing & demand fundamentals', 0, '{"color":"#ff5a36"}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
  await sqlLearn`
    INSERT INTO learn_map_sections (id, track_id, title, subtitle, sort, theme)
    VALUES (${section2}, ${trackId}, 'Front Office', 'Draft strategy & analytics', 1, '{"color":"#2f6fed"}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;

  await sqlLearn`
    INSERT INTO learn_map_nodes (id, section_id, sort, kind, lesson_id, layout, unlock)
    VALUES ('map-node-1', ${section1}, 0, 'lesson', ${lessonId}, '{"branchGroup":"main"}'::jsonb, '{}'::jsonb)
    ON CONFLICT (id) DO NOTHING
  `;
  await sqlLearn`
    INSERT INTO learn_map_nodes (id, section_id, sort, kind, lesson_id, layout, unlock)
    VALUES ('map-node-2', ${section1}, 1, 'checkpoint', null, '{"branchGroup":"main"}'::jsonb, ${sqlLearn.json({ requiresNodes: ["map-node-1"] } as never)})
    ON CONFLICT (id) DO NOTHING
  `;
  await sqlLearn`
    INSERT INTO learn_map_nodes (id, section_id, sort, kind, lesson_id, layout, unlock)
    VALUES ('map-node-3', ${section2}, 0, 'lesson', ${lessonId6}, '{"branchGroup":"main"}'::jsonb, ${sqlLearn.json({ requiresNodes: ["map-node-1"] } as never)})
    ON CONFLICT (id) DO NOTHING
  `;
  // Locked-by-stars bonus node: requires 3 lifetime stars, which a fresh
  // seeded student won't have yet, so this renders locked out of the box.
  await sqlLearn`
    INSERT INTO learn_map_nodes (id, section_id, sort, kind, lesson_id, layout, unlock)
    VALUES ('map-node-4', ${section2}, 1, 'bonus_challenge', null, '{"branchGroup":"bonus"}'::jsonb, ${sqlLearn.json({ minStarsTotal: 3 } as never)})
    ON CONFLICT (id) DO NOTHING
  `;

  console.log(`[seed-learn-demo] Seeded demo map: 2 sections, 4 nodes.`);

  // ---- Stage 9: one custom rule-based badge ----
  // "Pricing Strategist" — lesson_complete on the pricing lesson with
  // minStars 3. source='custom' (not 'system') so the achievement editor
  // treats it as fully editable rather than copy-only.
  await sqlLearn`
    INSERT INTO badges (id, name, description, icon, category, threshold, xp_reward, ordinal, source, rule)
    VALUES (
      'pricing_strategist',
      'Pricing Strategist',
      'Nailed the Ticket Pricing lesson with a perfect 3-star run.',
      '💰',
      'special',
      0,
      40,
      12,
      'custom',
      ${sqlLearn.json({ type: "lesson_complete", lessonId, minStars: 3 } as never)}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  console.log(`[seed-learn-demo] Seeded custom rule badge "pricing_strategist".`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
