"use server";

/* ============================================================
 * app/actions/learn-author.ts — Stage 3 Playbook Studio server actions.
 *
 * Native postgres.js only (sqlLearn / withTransaction) — never lib/db.ts's
 * toPostgresSql() for these JSONB-heavy tables. Admin-gated (requireAdmin):
 * this is the authoring surface, distinct from app/actions/learn-play.ts's
 * student-facing actions. Every mutating action revalidates the relevant
 * admin route.
 * ============================================================ */

import { randomUUID, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { sqlLearn, withTransaction } from "@/lib/db-sql";
import { LessonDocSchema, type LessonDoc } from "@/lib/learn/schema";
import { migrateLessonDoc } from "@/lib/learn/compat";
import { validateLessonDoc, type ValidationResult } from "@/lib/learn/validate";
import { regenerateLessonDocIds } from "@/lib/learn/regenerateIds";

export type ActionResult<T> = (T & { ok: true }) | { ok: false; error: string };
export type VoidActionResult = { ok: true } | { ok: false; error: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `x-${randomUUID().slice(0, 6)}`;
}

function minimalLessonDoc(title: string): LessonDoc {
  return {
    schemaVersion: 1,
    meta: { title, estMinutes: 10 },
    variables: [],
    skills: [],
    phases: [
      {
        id: `phase-${randomUUID().slice(0, 8)}`,
        kind: "Briefing",
        title: "Briefing",
        blocks: [
          { id: `block-${randomUUID().slice(0, 8)}`, type: "heading", text: title, level: 2 },
        ],
      },
    ],
    scoring: {
      mode: "points",
      starThresholds: [50, 75, 90],
      xp: { base: 10, perStar: 5, firstCompletionBonus: 10 },
      replayPolicy: { improvedXpPct: 0.25, noImprovementXpFloor: 0 },
      badges: [],
    },
    results: { showVariables: true, showSkillDeltas: true },
  };
}

/* ================= tracks / modules / lessons CRUD ================= */

const TrackInputSchema = z.object({ title: z.string().min(1), description: z.string().optional() });
const ModuleInputSchema = z.object({ trackId: z.string().min(1), title: z.string().min(1), description: z.string().optional() });
const LessonInputSchema = z.object({ moduleId: z.string().min(1), title: z.string().min(1) });

export async function createTrack(input: z.infer<typeof TrackInputSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = TrackInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const id = `track-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  const sortRows = await sqlLearn<{ m: number }[]>`SELECT COALESCE(MAX(sort), -1) AS m FROM learn_tracks`;
  await sqlLearn`
    INSERT INTO learn_tracks (id, slug, title, description, sort, created_at, updated_at)
    VALUES (${id}, ${slugify(parsed.data.title)}, ${parsed.data.title}, ${parsed.data.description ?? null}, ${sortRows[0].m + 1}, ${now}, ${now})
  `;
  revalidatePath("/app/admin/learn");
  return { ok: true, id };
}

export async function updateTrack(id: string, input: z.infer<typeof TrackInputSchema>): Promise<VoidActionResult> {
  await requireAdmin();
  const parsed = TrackInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  await sqlLearn`
    UPDATE learn_tracks SET title = ${parsed.data.title}, description = ${parsed.data.description ?? null}, updated_at = ${Date.now()}
    WHERE id = ${id}
  `;
  revalidatePath("/app/admin/learn");
  return { ok: true };
}

export async function createModule(input: z.infer<typeof ModuleInputSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = ModuleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const id = `module-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  const sortRows = await sqlLearn<{ m: number }[]>`SELECT COALESCE(MAX(sort), -1) AS m FROM learn_modules WHERE track_id = ${parsed.data.trackId}`;
  await sqlLearn`
    INSERT INTO learn_modules (id, track_id, slug, title, description, sort, created_at, updated_at)
    VALUES (${id}, ${parsed.data.trackId}, ${slugify(parsed.data.title)}, ${parsed.data.title}, ${parsed.data.description ?? null}, ${sortRows[0].m + 1}, ${now}, ${now})
  `;
  revalidatePath("/app/admin/learn");
  return { ok: true, id };
}

export async function updateModule(id: string, input: z.infer<typeof ModuleInputSchema>): Promise<VoidActionResult> {
  await requireAdmin();
  const parsed = ModuleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  await sqlLearn`
    UPDATE learn_modules SET title = ${parsed.data.title}, description = ${parsed.data.description ?? null}, updated_at = ${Date.now()}
    WHERE id = ${id}
  `;
  revalidatePath("/app/admin/learn");
  return { ok: true };
}

export async function createLesson(input: z.infer<typeof LessonInputSchema>): Promise<ActionResult<{ id: string }>> {
  const user = await requireAdmin();
  const parsed = LessonInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const id = `lesson-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  const doc = minimalLessonDoc(parsed.data.title);
  const sortRows = await sqlLearn<{ m: number }[]>`SELECT COALESCE(MAX(sort), -1) AS m FROM learn_lessons WHERE module_id = ${parsed.data.moduleId}`;
  await sqlLearn`
    INSERT INTO learn_lessons (id, module_id, slug, title, draft_doc, draft_revision, draft_updated_at, draft_updated_by, sort, created_at, created_by, updated_at)
    VALUES (${id}, ${parsed.data.moduleId}, ${slugify(parsed.data.title)}, ${parsed.data.title}, ${sqlLearn.json(doc as never)}, 1, ${now}, ${user.id}, ${sortRows[0].m + 1}, ${now}, ${user.id}, ${now})
  `;
  revalidatePath("/app/admin/learn");
  return { ok: true, id };
}

export async function reorderLessons(moduleId: string, orderedIds: string[]): Promise<VoidActionResult> {
  await requireAdmin();
  await withTransaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx`UPDATE learn_lessons SET sort = ${i}, updated_at = ${Date.now()} WHERE id = ${orderedIds[i]} AND module_id = ${moduleId}`;
    }
  });
  revalidatePath("/app/admin/learn");
  return { ok: true };
}

export async function archiveLesson(id: string): Promise<VoidActionResult> {
  await requireAdmin();
  await sqlLearn`UPDATE learn_lessons SET lifecycle = 'archived', updated_at = ${Date.now()} WHERE id = ${id}`;
  revalidatePath("/app/admin/learn");
  return { ok: true };
}

/* ================= lesson doc read / save / publish ================= */

export interface LessonDraftBundle {
  id: string;
  title: string;
  moduleId: string;
  doc: LessonDoc;
  draftRevision: number;
  publishedVersionId: string | null;
  publishedVersion: number | null;
}

export async function getLessonDraft(lessonId: string): Promise<ActionResult<LessonDraftBundle>> {
  await requireAdmin();
  const rows = await sqlLearn<{
    id: string;
    title: string;
    module_id: string;
    draft_doc: unknown;
    draft_revision: number;
    published_version_id: string | null;
  }[]>`
    SELECT id, title, module_id, draft_doc, draft_revision, published_version_id
    FROM learn_lessons WHERE id = ${lessonId}
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Lesson not found" };
  let publishedVersion: number | null = null;
  if (row.published_version_id) {
    const v = await sqlLearn<{ version: number }[]>`SELECT version FROM learn_lesson_versions WHERE id = ${row.published_version_id}`;
    publishedVersion = v[0]?.version ?? null;
  }
  const doc = migrateLessonDoc(row.draft_doc);
  return {
    ok: true,
    id: row.id,
    title: row.title,
    moduleId: row.module_id,
    doc,
    draftRevision: row.draft_revision,
    publishedVersionId: row.published_version_id,
    publishedVersion,
  };
}

export type SaveDraftResult =
  | { ok: true; newRevision: number }
  | { ok: false; conflict: true; serverRevision: number; serverUpdatedAt: number | null }
  | { ok: false; conflict?: false; error: string };

export async function saveDraft(lessonId: string, doc: LessonDoc, baseRevision: number): Promise<SaveDraftResult> {
  const user = await requireAdmin();
  const parsed = LessonDocSchema.safeParse(doc);
  if (!parsed.success) return { ok: false, error: `Invalid lesson document: ${parsed.error.message}` };

  const rows = await sqlLearn<{ draft_revision: number; draft_updated_at: number | null }[]>`
    SELECT draft_revision, draft_updated_at FROM learn_lessons WHERE id = ${lessonId}
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Lesson not found" };
  if (row.draft_revision !== baseRevision) {
    return { ok: false, conflict: true, serverRevision: row.draft_revision, serverUpdatedAt: row.draft_updated_at };
  }

  const now = Date.now();
  const newRevision = baseRevision + 1;
  const updated = await sqlLearn<{ draft_revision: number }[]>`
    UPDATE learn_lessons
    SET draft_doc = ${sqlLearn.json(parsed.data as never)}, draft_revision = ${newRevision},
        draft_updated_at = ${now}, draft_updated_by = ${user.id}, title = ${parsed.data.meta.title}, updated_at = ${now}
    WHERE id = ${lessonId} AND draft_revision = ${baseRevision}
    RETURNING draft_revision
  `;
  if (updated.length === 0) {
    // Lost the race between our SELECT and UPDATE — report the fresh conflict.
    const fresh = await sqlLearn<{ draft_revision: number; draft_updated_at: number | null }[]>`
      SELECT draft_revision, draft_updated_at FROM learn_lessons WHERE id = ${lessonId}
    `;
    return { ok: false, conflict: true, serverRevision: fresh[0]?.draft_revision ?? baseRevision, serverUpdatedAt: fresh[0]?.draft_updated_at ?? null };
  }
  revalidatePath(`/app/admin/learn/lesson/${lessonId}`);
  return { ok: true, newRevision };
}

export interface PublishResult {
  ok: true;
  versionId: string;
  version: number;
}
export type PublishActionResult = PublishResult | { ok: false; error: string; validation?: ValidationResult };

export async function publishLesson(lessonId: string, baseRevision: number): Promise<PublishActionResult> {
  const user = await requireAdmin();
  const rows = await sqlLearn<{ draft_doc: unknown; draft_revision: number }[]>`
    SELECT draft_doc, draft_revision FROM learn_lessons WHERE id = ${lessonId}
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Lesson not found" };
  if (row.draft_revision !== baseRevision) {
    return { ok: false, error: "Draft has changed since you last saved — reload before publishing." };
  }

  const doc = migrateLessonDoc(row.draft_doc);
  const parsed = LessonDocSchema.safeParse(doc);
  if (!parsed.success) return { ok: false, error: `Invalid lesson document: ${parsed.error.message}` };

  const validation = validateLessonDoc(parsed.data);
  if (validation.errors.length > 0) {
    return { ok: false, error: "Lesson has blocking validation errors", validation };
  }

  const docHash = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
  const versionId = `lver-${randomUUID().slice(0, 12)}`;
  const now = Date.now();

  await withTransaction(async (tx) => {
    const maxRows = await tx<{ m: number }[]>`SELECT COALESCE(MAX(version), 0) AS m FROM learn_lesson_versions WHERE lesson_id = ${lessonId}`;
    const version = maxRows[0].m + 1;
    await tx`
      INSERT INTO learn_lesson_versions (id, lesson_id, version, doc, doc_hash, published_at, published_by)
      VALUES (${versionId}, ${lessonId}, ${version}, ${tx.json(parsed.data as never)}, ${docHash}, ${now}, ${user.id})
    `;
    await tx`UPDATE learn_lessons SET published_version_id = ${versionId}, updated_at = ${now} WHERE id = ${lessonId}`;
  });

  const versionRow = await sqlLearn<{ version: number }[]>`SELECT version FROM learn_lesson_versions WHERE id = ${versionId}`;
  revalidatePath(`/app/admin/learn/lesson/${lessonId}`);
  revalidatePath("/app/admin/learn");
  return { ok: true, versionId, version: versionRow[0].version };
}

/* ================= duplicate / template ================= */

export async function duplicateLesson(lessonId: string, opts: { title?: string; moduleId?: string } = {}): Promise<ActionResult<{ id: string }>> {
  const user = await requireAdmin();
  const rows = await sqlLearn<{ title: string; module_id: string; draft_doc: unknown }[]>`
    SELECT title, module_id, draft_doc FROM learn_lessons WHERE id = ${lessonId}
  `;
  const row = rows[0];
  if (!row) return { ok: false, error: "Lesson not found" };
  const title = opts.title ?? `${row.title} (Copy)`;
  const doc = regenerateLessonDocIds(migrateLessonDoc(row.draft_doc));
  doc.meta = { ...doc.meta, title };
  const id = `lesson-${randomUUID().slice(0, 12)}`;
  const now = Date.now();
  const moduleId = opts.moduleId ?? row.module_id;
  const sortRows = await sqlLearn<{ m: number }[]>`SELECT COALESCE(MAX(sort), -1) AS m FROM learn_lessons WHERE module_id = ${moduleId}`;
  await sqlLearn`
    INSERT INTO learn_lessons (id, module_id, slug, title, draft_doc, draft_revision, draft_updated_at, draft_updated_by, sort, created_at, created_by, updated_at)
    VALUES (${id}, ${moduleId}, ${slugify(title)}, ${title}, ${sqlLearn.json(doc as never)}, 1, ${now}, ${user.id}, ${sortRows[0].m + 1}, ${now}, ${user.id}, ${now})
  `;
  revalidatePath("/app/admin/learn");
  return { ok: true, id };
}

/** "New from template" and "save as template" both go through duplicateLesson's id-regen path. */
export async function createFromTemplate(templateLessonId: string, moduleId: string, title: string): Promise<ActionResult<{ id: string }>> {
  return duplicateLesson(templateLessonId, { title, moduleId });
}

export async function saveAsTemplate(lessonId: string): Promise<VoidActionResult> {
  await requireAdmin();
  await sqlLearn`UPDATE learn_lessons SET is_template = true, updated_at = ${Date.now()} WHERE id = ${lessonId}`;
  revalidatePath("/app/admin/learn");
  return { ok: true };
}

/* ================= pickers ================= */

export interface CurriculumTree {
  tracks: { id: string; title: string; sort: number }[];
  modules: { id: string; trackId: string; title: string; sort: number }[];
  lessons: {
    id: string;
    moduleId: string;
    title: string;
    sort: number;
    lifecycle: string;
    isTemplate: boolean;
    draftRevision: number;
    draftUpdatedAt: number | null;
    publishedVersionId: string | null;
    publishedVersion: number | null;
    publishedAt: number | null;
  }[];
}

export async function getCurriculumTree(): Promise<ActionResult<CurriculumTree>> {
  await requireAdmin();
  const tracks = await sqlLearn<{ id: string; title: string; sort: number }[]>`
    SELECT id, title, sort FROM learn_tracks ORDER BY sort ASC
  `;
  const modules = await sqlLearn<{ id: string; track_id: string; title: string; sort: number }[]>`
    SELECT id, track_id, title, sort FROM learn_modules ORDER BY sort ASC
  `;
  // Never SELECT `doc` here — meta columns only.
  const lessonRows = await sqlLearn<{
    id: string;
    module_id: string;
    title: string;
    sort: number;
    lifecycle: string;
    is_template: boolean;
    draft_revision: number;
    draft_updated_at: number | null;
    published_version_id: string | null;
  }[]>`
    SELECT id, module_id, title, sort, lifecycle, is_template, draft_revision, draft_updated_at, published_version_id
    FROM learn_lessons ORDER BY sort ASC
  `;
  const versionIds = lessonRows.map((l) => l.published_version_id).filter((x): x is string => Boolean(x));
  const versions = versionIds.length
    ? await sqlLearn<{ id: string; version: number; published_at: number }[]>`
        SELECT id, version, published_at FROM learn_lesson_versions WHERE id = ANY(${versionIds})
      `
    : [];
  const versionById = new Map(versions.map((v) => [v.id, v]));

  return {
    ok: true,
    tracks: tracks.map((t) => ({ id: t.id, title: t.title, sort: t.sort })),
    modules: modules.map((m) => ({ id: m.id, trackId: m.track_id, title: m.title, sort: m.sort })),
    lessons: lessonRows.map((l) => {
      const version = l.published_version_id ? versionById.get(l.published_version_id) : undefined;
      return {
        id: l.id,
        moduleId: l.module_id,
        title: l.title,
        sort: l.sort,
        lifecycle: l.lifecycle,
        isTemplate: l.is_template,
        draftRevision: l.draft_revision,
        draftUpdatedAt: l.draft_updated_at,
        publishedVersionId: l.published_version_id,
        publishedVersion: version?.version ?? null,
        publishedAt: version?.published_at ?? null,
      };
    }),
  };
}

export async function listLessonsForPicker(): Promise<ActionResult<{ lessons: { id: string; title: string }[] }>> {
  await requireAdmin();
  const rows = await sqlLearn<{ id: string; title: string }[]>`
    SELECT id, title FROM learn_lessons WHERE lifecycle = 'active' ORDER BY title ASC
  `;
  return { ok: true, lessons: rows };
}

export async function listBadges(): Promise<ActionResult<{ badges: { id: string; name: string }[] }>> {
  await requireAdmin();
  const rows = await sqlLearn<{ id: string; name: string }[]>`SELECT id, name FROM badges ORDER BY name ASC`;
  return { ok: true, badges: rows };
}

/** Progression attributes (Strategy, Analytics, …), not psychometrics — see
 * plan §5. No dedicated skills management page exists yet (Stage 7), so the
 * Scoring/Skills tab of the builder is also the only place to create one. */
export async function listSkills(): Promise<ActionResult<{ skills: { id: string; label: string }[] }>> {
  await requireAdmin();
  const rows = await sqlLearn<{ id: string; label: string }[]>`SELECT id, label FROM learn_skills ORDER BY sort ASC, label ASC`;
  return { ok: true, skills: rows };
}

export async function createSkill(label: string): Promise<ActionResult<{ id: string; label: string }>> {
  await requireAdmin();
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Skill label is required." };
  const id = `skill-${slugify(trimmed)}`;
  await sqlLearn`
    INSERT INTO learn_skills (id, slug, label)
    VALUES (${id}, ${slugify(trimmed)}, ${trimmed})
    ON CONFLICT (id) DO NOTHING
  `;
  return { ok: true, id, label: trimmed };
}
