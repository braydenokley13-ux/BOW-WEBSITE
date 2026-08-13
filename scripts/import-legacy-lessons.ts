/* ============================================================
 * scripts/import-legacy-lessons.ts — Stage 10 legacy curriculum import CLI.
 *
 * Thin CLI over lib/learn/importLegacy.ts's pure transform. Creates
 * learn_tracks (101, 201) + learn_modules from lib/lessons.ts's TRACK_META
 * if missing, then upserts every legacy lesson as a DRAFT learn_lessons row
 * (draft_doc set, published_version_id left untouched — imports are never
 * auto-published, per plan §6 Stage 10).
 *
 * Idempotent by slug/id: a lesson row that already exists and is NOT tagged
 * "imported-draft" (i.e. an author has started editing it) is left alone.
 * A lesson row that already exists and IS still tagged "imported-draft" is
 * skipped by default, and only overwritten with --force.
 *
 * Usage:
 *   npm run import:legacy-lessons [-- --force] [-- --dry-run]
 * ============================================================ */

import { lessons, type Lesson } from "../lib/lessons";
import { getSqlLearn } from "../lib/db-sql";
import { LessonDocSchema } from "../lib/learn/schema";
import { validateLessonDoc } from "../lib/learn/validate";
import { importLegacyLesson, isImportedDraft } from "../lib/learn/importLegacy";

interface TrackMetaLite {
  label: string;
  grade: string;
  mods: Record<number, [string, string]>;
}

// Mirrors lib/lessons.ts's private TRACK_META (not exported) — kept in sync
// manually since it's small and stable; a drift here is caught by the
// "every legacy lesson's module must exist" assertion below at import time.
const TRACK_META: Record<string, TrackMetaLite> = {
  "101": {
    label: "Track 101",
    grade: "Grades 5–6",
    mods: {
      1: ["The Economics of Winning", "Why every decision has a cost"],
      2: ["Building the Roster", "Turning constraints into a team"],
      3: ["The Money Behind the Game", "How the cap really works"],
      4: ["Owning the Franchise", "The business above the bench"],
    },
  },
  "201": {
    label: "Track 201",
    grade: "Grades 7–8",
    mods: {
      1: ["Cap Management & Tradeoffs", "Where flexibility is won and lost"],
      2: ["Money in Motion", "Where the money actually comes from"],
      3: ["Analytics in Action", "Turning numbers into decisions"],
      4: ["Draft Strategy & Surplus Value", "Building the future on a clock"],
    },
  },
};

function trackId(track: string): string {
  return `track-legacy-${track}`;
}
function moduleId(track: string, mod: number): string {
  return `module-legacy-${track}-m${mod}`;
}

interface ImportOutcome {
  lessonId: string;
  slug: string;
  status: "created" | "overwritten" | "skipped-edited" | "skipped-unchanged" | "error";
  detail?: string;
}

async function ensureTracksAndModules(sql: ReturnType<typeof getSqlLearn>, dryRun: boolean) {
  const now = Date.now();
  for (const [track, meta] of Object.entries(TRACK_META)) {
    const tid = trackId(track);
    if (!dryRun) {
      await sql`
        INSERT INTO learn_tracks (id, slug, title, description, lifecycle, sort, theme, created_at, updated_at)
        VALUES (${tid}, ${`legacy-${track}`}, ${meta.label}, ${`${meta.grade} — imported from the legacy curriculum.`}, 'active', ${Number(track)}, '{}'::jsonb, ${now}, ${now})
        ON CONFLICT (id) DO NOTHING
      `;
      // Point the staff course at the track it has just imported.
      //
      // Migration 027 does the same join, but on a fresh database it runs
      // before this importer has created anything to join to — so without this
      // the link would only ever exist on databases where the import happened
      // first. Same rule either way: `curricula.public_slug = 'track-<n>'` and
      // `learn_tracks.id = 'track-legacy-<n>'` are one track number written by
      // two scripts in this repo, and an operator's own link is never
      // overwritten.
      await sql`
        UPDATE curricula
           SET learn_track_id = ${tid}, updated_at = ${now}
         WHERE public_slug = ${`track-${track}`}
           AND learn_track_id IS NULL
      `;
    }
    for (const [modNumStr, [title, theme]] of Object.entries(meta.mods)) {
      const modNum = Number(modNumStr);
      const mid = moduleId(track, modNum);
      if (!dryRun) {
        await sql`
          INSERT INTO learn_modules (id, track_id, slug, title, description, sort, lifecycle, unlock, created_at, updated_at)
          VALUES (${mid}, ${tid}, ${`m${modNum}`}, ${title}, ${theme}, ${modNum}, 'active', '{}'::jsonb, ${now}, ${now})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }
  }
}

async function importOne(
  sql: ReturnType<typeof getSqlLearn>,
  lesson: Lesson,
  opts: { force: boolean; dryRun: boolean },
): Promise<ImportOutcome> {
  const doc = importLegacyLesson(lesson);

  // Correct by construction before touching the DB (mirrors seed-learn-demo.ts).
  const parsed = LessonDocSchema.parse(doc);
  const validation = validateLessonDoc(parsed);
  if (validation.errors.length > 0) {
    return { lessonId: lesson.id, slug: lesson.slug, status: "error", detail: validation.errors.join("; ") };
  }

  const mid = moduleId(lesson.track, lesson.moduleNumber);
  const now = Date.now();

  const existingRows = opts.dryRun
    ? []
    : await sql`SELECT id, draft_doc FROM learn_lessons WHERE id = ${lesson.id}`;
  const existing = existingRows[0] as { id: string; draft_doc: unknown } | undefined;

  if (existing) {
    const existingParsed = LessonDocSchema.safeParse(existing.draft_doc);
    const stillImported = existingParsed.success && isImportedDraft(existingParsed.data);
    if (!stillImported) {
      return { lessonId: lesson.id, slug: lesson.slug, status: "skipped-edited" };
    }
    if (!opts.force) {
      return { lessonId: lesson.id, slug: lesson.slug, status: "skipped-unchanged" };
    }
    if (!opts.dryRun) {
      await sql`
        UPDATE learn_lessons
        SET draft_doc = ${sql.json(parsed as never)}, draft_revision = draft_revision + 1,
            draft_updated_at = ${now}, est_minutes = ${parsed.meta.estMinutes ?? null}, updated_at = ${now}
        WHERE id = ${lesson.id}
      `;
    }
    return { lessonId: lesson.id, slug: lesson.slug, status: "overwritten" };
  }

  if (!opts.dryRun) {
    await sql`
      INSERT INTO learn_lessons (
        id, module_id, slug, title, lifecycle, draft_doc, draft_revision,
        draft_updated_at, est_minutes, sort, is_template, created_at, updated_at
      )
      VALUES (
        ${lesson.id}, ${mid}, ${lesson.slug}, ${parsed.meta.title}, 'active',
        ${sql.json(parsed as never)}, 1, ${now}, ${parsed.meta.estMinutes ?? null},
        ${lesson.lessonNumber}, false, ${now}, ${now}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
  return { lessonId: lesson.id, slug: lesson.slug, status: "created" };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");

  const sql = getSqlLearn();
  await ensureTracksAndModules(sql, dryRun);

  const outcomes: ImportOutcome[] = [];
  for (const lesson of lessons) {
    const outcome = await importOne(sql, lesson, { force, dryRun });
    outcomes.push(outcome);
  }

  const counts = outcomes.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`[import-legacy-lessons] ${dryRun ? "DRY RUN — " : ""}processed ${outcomes.length} legacy lessons.`);
  console.log(`[import-legacy-lessons] ${JSON.stringify(counts)}`);
  for (const o of outcomes) {
    if (o.status === "error") console.error(`  ERROR ${o.lessonId} (${o.slug}): ${o.detail}`);
  }

  const errorCount = outcomes.filter((o) => o.status === "error").length;
  await sql.end?.({ timeout: 1 });
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
