# Stage 10 — Curriculum Migration: Legacy → Draft LessonDocs

Automated import of all 24 `lib/lessons.ts` legacy lessons into draft
`LessonDoc`s is **not** "finished migration" — every lesson still needs
interactive redesign in Studio before publish (plan §6 Stage 10). This memo
documents the transform, what got imported where, the per-lesson checklist
authors must work through, and the live-DB/Studio evidence gathered for this
pass.

## 1. What was built

- **`lib/learn/importLegacy.ts`** — pure transform, `Lesson -> LessonDoc`
  (schemaVersion 1). No DB/server imports; unit-testable in memory.
- **`scripts/import-legacy-lessons.ts`** (`npm run import:legacy-lessons`) —
  thin CLI: creates `learn_tracks` (101, 201) + `learn_modules` (4 per
  track, from `TRACK_META`) if missing, then upserts each of the 24 legacy
  lessons as a `learn_lessons` row with `draft_doc` set and
  `published_version_id` left `NULL`. Idempotent by lesson id/slug:
  - No existing row → **create**.
  - Existing row still tagged `imported-draft` → **skip** (re-run is a
    no-op) unless `--force`, in which case it's **overwritten**.
  - Existing row *not* tagged `imported-draft` (an author has started
    editing it) → **always skipped**, `--force` included. An author's work
    is never clobbered by a re-import.
- **Schema change**: added an optional, additive `LessonMeta.tags: string[]`
  field (no `schemaVersion` bump — same pattern as
  `LongTextBlockSchema`'s `manual_review.pointsPossible`). Carries the
  legacy `concepts[]` plus the `"imported-draft"` marker tag.
- **Validation fix**: `validateLessonDoc`'s points-possible accounting
  didn't count `long_text` blocks in `manual_review` mode at all, so a
  lesson whose only scoreable content was a manual-review reflection failed
  the "zero total possible points" check. Fixed to count
  `reflection.pointsPossible` for that mode — this is a general bugfix
  (matches the field's documented purpose in `app/actions/learn-review.ts`
  `approveReview`), not import-specific.
- **`tests/learn/import-legacy.test.ts`** — 6 tests, transforming all 24
  real lessons in memory: schema-parse + `validateLessonDoc` (zero hard
  errors, warnings OK) for every one, block-id uniqueness, two block-mapping
  spot checks, and pure idempotency/force-logic checks. Full suite:
  **143 tests green** (was 137).

## 2. Field mapping (legacy `Lesson` → `LessonDoc`)

| Legacy field | Target |
|---|---|
| `title`, `caseNumber` | `meta.title` (also mirrored as Briefing heading/text) |
| `summary` / `overview` | `meta.description` |
| `duration` (e.g. `"12 min"`) | `meta.estMinutes` (parsed integer) |
| `concepts[]` | `meta.tags` |
| — (always) | `meta.tags` += `"imported-draft"`; Briefing gets a leading `callout` block titled **"IMPORTED — NEEDS INTERACTIVE REDESIGN"** |
| `role`, `deadline` | Briefing `callout` (title = role, body = deadline) |
| `centralQuestion` | Briefing `heading` (level 3) |
| `situation[]` | Briefing `text` blocks, one per paragraph |
| `needToKnow[]` (`term`/`body`) | Learn `callout` blocks, one per term |
| `evidence[]` (`label`/`value`) | Learn `stat` blocks |
| `learningOutcomes[]` | one Learn `callout` ("Learning Outcomes") summarizing concept/use pairs |
| `stakeholders[]` | Decision `text` blocks (name + interest/concern/conflict) |
| `decisionPrompt` / `centralQuestion` + `decisionOptions[]` (≥2) | one Decision `strategy_choice` block, `grading: "weighted"`, every option worth **1 point** (flagged — see §3) |
| *(no decisionOptions)* | Decision falls back to one `long_text` block, `reflection.mode: "manual_review"`, `pointsPossible: 10`, prompt flagged `[NEEDS REDESIGN]` |
| `discussionQuestions[]` | FollowUp `long_text` blocks, `reflection.mode: "completion_only"` |
| `podcastUrl` (when set) | FollowUp `media` block, `kind: "podcast"`, `completion: { mode: "percent", threshold: 0.8 }` |
| — (always) | one Challenge `long_text` placeholder referencing `concepts[]`, `reflection.mode: "completion_only"`, marked `[NEEDS REDESIGN: legacy import placeholder]` |
| `relatedLessons[]` | **not imported** — no equivalent field on `LessonDoc`; left for authors (cross-lesson references aren't yet a Studio concept) |

## 3. Per-lesson redesign checklist (what Brayden must do before publishing each of the remaining 23)

1. **Delete the "IMPORTED — NEEDS INTERACTIVE REDESIGN" callout** once the
   lesson has been reworked.
2. **Rebuild the Decision phase's grading.** Every imported
   `strategy_choice` option is worth an equal 1 point by default — the
   importer never invents a "correct" answer. Decide the real weighting
   (or switch to `rubric_bands`/`variable_effects` where a numeric decision
   like `price_set`/`slider` fits better than a fixed option list).
3. **For the 4 lessons with no legacy `decisionOptions`** (a `long_text`
   manual_review placeholder stands in today), design a real decision
   block — the placeholder exists only so the doc has a nonzero scoring
   budget.
4. **Add variables + effects.** None are imported (legacy data has no
   variable model) — decide what state the lesson should track (budget,
   sentiment, etc.) and wire `strategy_choice`/`slider` effects to it, the
   way stage4's "Price of a Seat" rebuild did.
5. **Replace the Challenge-phase placeholder** with a real challenge block
   (or a curated MC/scenario) — today it's always a generic `long_text`
   stub.
6. **Consider adding a Consequence phase.** The importer never generates
   one; legacy lessons had no explicit consequence content to map, but
   Studio's branching (`goTo`/`visibleIf`) works best with one, as stage4/6
   demonstrated.
7. **Attach skills + badges** if the lesson should contribute to skill
   growth or a custom achievement — none are imported.
8. **Re-run `validateLessonDoc`** in Studio (via the validation panel) and
   resolve any warnings before publish; hard errors are already guaranteed
   absent by the importer + this stage's test suite.

## 4. Live import run (evidence)

Local Postgres 16, `postgres://pguser@localhost:55432/bow` (pre-existing
cluster from earlier stages, migrations 001–007 already applied,
`admin@bow.test` / `Admin!2345` seeded).

```
$ npm run import:legacy-lessons
[import-legacy-lessons] processed 24 legacy lessons.
[import-legacy-lessons] {"created":24}

$ npm run import:legacy-lessons        # idempotency re-run
[import-legacy-lessons] processed 24 legacy lessons.
[import-legacy-lessons] {"skipped-unchanged":24}
```

SQL counts after the run:

```sql
SELECT count(*) FROM learn_tracks WHERE id LIKE 'track-legacy-%';    -- 2
SELECT count(*) FROM learn_modules WHERE id LIKE 'module-legacy-%';  -- 8
SELECT count(*) FROM learn_lessons WHERE id ~ '^t(101|201)-m';       -- 24
SELECT count(*) FROM learn_lessons WHERE id ~ '^t(101|201)-m'
  AND published_version_id IS NULL;                                  -- 24 (all drafts, pre-smoke-test)
```

All 24 lessons created, zero import errors, zero schema-parse failures —
matches the 24/24 in-memory test result.

## 5. Studio spot-check (Playwright, Chromium, real login as `admin@bow.test`)

Opened two imported drafts directly in Playbook Studio:

- `t101-m1-l1` ("Scarcity in the Standings") — Briefing renders the
  redesign-needed callout, heading, case-number text, role callout, central
  question, and situation paragraphs; Learn/Decision/FollowUp/Challenge tabs
  present; validation panel shows a **"1 Issue"** pill (a warning, not a
  crash — publish is not blocked by warnings, only hard errors).
- `t201-m2-l3` ("Save the Franchise") — same pattern; renders cleanly with
  its own imported content, no crashes, no console errors.

Both drafts open, all blocks render, and the inspector panel is reachable
(clicking a block shows its editable fields) — the builder's block registry
handles every block type the importer emits (`callout`, `heading`, `text`,
`stat`, `strategy_choice`, `long_text`, `media`) without special-casing.

## 6. Publish smoke test

Per the plan's "interactive redesign before publish" rule, only **one**
imported lesson was published as a smoke test, through the real UI, with no
content changes beyond what the importer already produced (its
`validateLessonDoc` result was already zero hard errors, one warning):

- `t101-m1-l1` ("Scarcity in the Standings") → clicked **Publish** in
  Studio → confirmation dialog accepted → toolbar now reads **"Published
  V1"**.
- DB confirms: `learn_lessons.published_version_id = 'lver-25a33396-08c'`,
  a matching `learn_lesson_versions` row at `version = 1`.
- The remaining **23 imported lessons stay unpublished drafts**, exactly as
  the plan requires — awaiting Brayden's interactive redesign pass, lesson
  by lesson, using the checklist in §3.

## 7. Map placement

Per the plan ("no silent auto-placement"), the importer never touches
`learn_map_sections`/`learn_map_nodes`. Confirmed in the Career Map editor
(`/app/admin/learn/map`): the "Add Node" lesson picker is driven by
`listPublishedLessonsForMapPicker`, which only lists **published** lessons
— so all 23 still-draft imported lessons are structurally invisible to the
map editor (they can't be placed even by accident) until an author redesigns
and publishes them. The one lesson published in §6 becomes eligible for
placement going forward, but was **not** auto-placed — placement remains a
deliberate, separate author action.

## 8. Evidence artifacts (not committed — throwaway, scratchpad)

Screenshots captured during the live Playwright pass (session scratchpad,
matching the stage4/6/9 convention of not committing throwaway
proof-drivers):

- `00-signin.png`, `10-lesson-t101-m1-l1.png`, `11-lesson-t201-m2-l3.png`,
  `20-map-editor.png`, `13b-final.png` (post-publish "Published V1" state).

## 9. Deferred / not in scope for this stage

- Redesigning any of the 23 remaining draft lessons' content — that's the
  point of the checklist in §3, done lesson-by-lesson by Brayden in Studio.
- `relatedLessons[]` cross-references — no `LessonDoc` equivalent exists
  yet.
- Placing the one published lesson on the Career Map — a deliberate,
  separate author decision, intentionally not automated.
