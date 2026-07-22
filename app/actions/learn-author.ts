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
import type { UnlockPolicy } from "@/lib/learn/unlock";
import { reorderWithinList, moveBetweenLists } from "@/lib/learn/mapOrder";

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

/* ================= career map CRUD (Stage 7 follow-up) ================= */

const ThemeInputSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color swatch").optional(),
});

const MapSectionInputSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  theme: ThemeInputSchema.optional(),
});

const MapSectionUpdateSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  theme: ThemeInputSchema.optional(),
});

/** Mirrors lib/learn/unlock.ts's UnlockPolicy — validated at the authoring
 * boundary so a malformed policy can never reach learn_map_nodes.unlock. */
const UnlockPolicyInputSchema = z.object({
  requiresNodes: z.array(z.string().min(1)).optional(),
  minStarsTotal: z.number().int().min(0).optional(),
  minLevel: z.number().int().min(0).optional(),
  badgeId: z.string().min(1).optional(),
  requiresInstructorRelease: z.boolean().optional(),
  opensAt: z.number().int().optional(),
});

const MAP_NODE_KINDS = ["lesson", "bonus_challenge", "checkpoint", "reward"] as const;

const MapNodeInputSchema = z
  .object({
    sectionId: z.string().min(1),
    kind: z.enum(MAP_NODE_KINDS),
    lessonId: z.string().min(1).optional(),
    branchGroup: z.string().min(1).optional(),
  })
  .refine((v) => (v.kind === "lesson" ? Boolean(v.lessonId) : true), {
    message: "A lesson node needs a lesson selected.",
    path: ["lessonId"],
  });

export interface MapEditorSection {
  id: string;
  trackId: string;
  title: string;
  subtitle: string | null;
  sort: number;
  theme: Record<string, unknown>;
}

export interface MapEditorNode {
  id: string;
  sectionId: string;
  sort: number;
  kind: (typeof MAP_NODE_KINDS)[number];
  lessonId: string | null;
  lessonTitle: string | null;
  layout: Record<string, unknown>;
  unlock: UnlockPolicy;
}

export interface MapEditorData {
  tracks: { id: string; title: string }[];
  sections: MapEditorSection[];
  nodes: MapEditorNode[];
  unplacedLessons: { id: string; title: string }[];
}

/** Everything the map editor page needs, in a handful of batched queries. */
export async function getMapEditorData(): Promise<ActionResult<MapEditorData>> {
  await requireAdmin();

  const tracks = await sqlLearn<{ id: string; title: string }[]>`
    SELECT id, title FROM learn_tracks ORDER BY sort ASC
  `;
  const sectionRows = await sqlLearn<MapEditorSection[]>`
    SELECT id, track_id AS "trackId", title, subtitle, sort, theme
    FROM learn_map_sections ORDER BY sort ASC
  `;
  const nodeRows = await sqlLearn<{
    id: string; section_id: string; sort: number; kind: MapEditorNode["kind"];
    lesson_id: string | null; layout: Record<string, unknown>; unlock: UnlockPolicy;
    lesson_title: string | null;
  }[]>`
    SELECT n.id, n.section_id, n.sort, n.kind, n.lesson_id, n.layout, n.unlock, l.title AS lesson_title
    FROM learn_map_nodes n LEFT JOIN learn_lessons l ON l.id = n.lesson_id
    ORDER BY n.sort ASC
  `;

  // "Unplaced published lessons": lesson has a published version but no
  // learn_map_nodes row references it — surfaced as a tray, never
  // auto-placed (plan §5: no silent auto-placement).
  const unplacedRows = await sqlLearn<{ id: string; title: string }[]>`
    SELECT l.id, l.title FROM learn_lessons l
    WHERE l.published_version_id IS NOT NULL AND l.lifecycle = 'active'
      AND NOT EXISTS (SELECT 1 FROM learn_map_nodes n WHERE n.lesson_id = l.id)
    ORDER BY l.title ASC
  `;

  return {
    ok: true,
    tracks,
    sections: sectionRows.map((s) => ({ ...s, subtitle: s.subtitle ?? null })),
    nodes: nodeRows.map((n) => ({
      id: n.id,
      sectionId: n.section_id,
      sort: n.sort,
      kind: n.kind,
      lessonId: n.lesson_id,
      lessonTitle: n.lesson_title,
      layout: n.layout || {},
      unlock: n.unlock || {},
    })),
    unplacedLessons: unplacedRows,
  };
}

/** Published lessons pickable for a new map node (any lifecycle-active
 * lesson with a published version — placing the same lesson twice is
 * allowed, e.g. a lesson reachable from two department paths). */
export async function listPublishedLessonsForMapPicker(): Promise<ActionResult<{ lessons: { id: string; title: string }[] }>> {
  await requireAdmin();
  const rows = await sqlLearn<{ id: string; title: string }[]>`
    SELECT id, title FROM learn_lessons
    WHERE published_version_id IS NOT NULL AND lifecycle = 'active'
    ORDER BY title ASC
  `;
  return { ok: true, lessons: rows };
}

export async function createMapSection(input: z.infer<typeof MapSectionInputSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = MapSectionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const id = `map-section-${randomUUID().slice(0, 10)}`;
  const sortRows = await sqlLearn<{ m: number }[]>`
    SELECT COALESCE(MAX(sort), -1) AS m FROM learn_map_sections WHERE track_id = ${parsed.data.trackId}
  `;
  await sqlLearn`
    INSERT INTO learn_map_sections (id, track_id, title, subtitle, sort, theme)
    VALUES (${id}, ${parsed.data.trackId}, ${parsed.data.title}, ${parsed.data.subtitle ?? null}, ${sortRows[0].m + 1}, ${sqlLearn.json((parsed.data.theme ?? {}) as never)})
  `;
  revalidatePath("/app/admin/learn/map");
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function updateMapSection(id: string, input: z.infer<typeof MapSectionUpdateSchema>): Promise<VoidActionResult> {
  await requireAdmin();
  const parsed = MapSectionUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  await sqlLearn`
    UPDATE learn_map_sections
    SET title = ${parsed.data.title}, subtitle = ${parsed.data.subtitle ?? null},
        theme = COALESCE(${parsed.data.theme ? sqlLearn.json(parsed.data.theme as never) : null}, theme)
    WHERE id = ${id}
  `;
  revalidatePath("/app/admin/learn/map");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Deletes a section and every node in it (learn_map_nodes FK is ON DELETE
 * CASCADE) — the caller's UI must confirm before calling this. */
export async function deleteMapSection(id: string): Promise<VoidActionResult> {
  await requireAdmin();
  await sqlLearn`DELETE FROM learn_map_sections WHERE id = ${id}`;
  revalidatePath("/app/admin/learn/map");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function reorderMapSections(trackId: string, orderedIds: string[]): Promise<VoidActionResult> {
  await requireAdmin();
  await withTransaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await tx`UPDATE learn_map_sections SET sort = ${i} WHERE id = ${orderedIds[i]} AND track_id = ${trackId}`;
    }
  });
  revalidatePath("/app/admin/learn/map");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createMapNode(input: z.infer<typeof MapNodeInputSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = MapNodeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  const id = `map-node-${randomUUID().slice(0, 10)}`;
  const sortRows = await sqlLearn<{ m: number }[]>`
    SELECT COALESCE(MAX(sort), -1) AS m FROM learn_map_nodes WHERE section_id = ${parsed.data.sectionId}
  `;
  const layout = parsed.data.branchGroup ? { branchGroup: parsed.data.branchGroup } : {};
  await sqlLearn`
    INSERT INTO learn_map_nodes (id, section_id, sort, kind, lesson_id, layout, unlock)
    VALUES (${id}, ${parsed.data.sectionId}, ${sortRows[0].m + 1}, ${parsed.data.kind}, ${parsed.data.lessonId ?? null}, ${sqlLearn.json(layout as never)}, '{}'::jsonb)
  `;
  revalidatePath("/app/admin/learn/map");
  revalidatePath("/dashboard");
  return { ok: true, id };
}

export async function deleteMapNode(id: string): Promise<VoidActionResult> {
  await requireAdmin();
  await sqlLearn`DELETE FROM learn_map_nodes WHERE id = ${id}`;
  revalidatePath("/app/admin/learn/map");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateMapNodeUnlock(id: string, unlock: z.infer<typeof UnlockPolicyInputSchema>): Promise<VoidActionResult> {
  await requireAdmin();
  const parsed = UnlockPolicyInputSchema.safeParse(unlock);
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  await sqlLearn`UPDATE learn_map_nodes SET unlock = ${sqlLearn.json(parsed.data as never)} WHERE id = ${id}`;
  revalidatePath("/app/admin/learn/map");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateMapNodeBranchGroup(id: string, branchGroup: string): Promise<VoidActionResult> {
  await requireAdmin();
  const trimmed = branchGroup.trim();
  const rows = await sqlLearn<{ layout: Record<string, unknown> }[]>`SELECT layout FROM learn_map_nodes WHERE id = ${id}`;
  if (!rows[0]) return { ok: false, error: "Node not found" };
  const nextLayout = { ...rows[0].layout, branchGroup: trimmed || "main" };
  await sqlLearn`UPDATE learn_map_nodes SET layout = ${sqlLearn.json(nextLayout as never)} WHERE id = ${id}`;
  revalidatePath("/app/admin/learn/map");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Moves a node to `toSectionId` at position `toIndex` and resequences sort
 * for both the origin and destination sections — single action covers both
 * within-section reorder (toSectionId === current section) and
 * cross-section drag (plan: "drag-reorder within/between sections").
 */
export async function moveMapNode(nodeId: string, toSectionId: string, toIndex: number): Promise<VoidActionResult> {
  await requireAdmin();
  const rows = await sqlLearn<{ section_id: string }[]>`SELECT section_id FROM learn_map_nodes WHERE id = ${nodeId}`;
  const fromSectionId = rows[0]?.section_id;
  if (!fromSectionId) return { ok: false, error: "Node not found" };

  await withTransaction(async (tx) => {
    const fromNodes = await tx<{ id: string }[]>`
      SELECT id FROM learn_map_nodes WHERE section_id = ${fromSectionId} AND id != ${nodeId} ORDER BY sort ASC
    `;
    if (fromSectionId === toSectionId) {
      const ids = reorderWithinList(fromNodes.map((n) => n.id), nodeId, toIndex);
      for (let i = 0; i < ids.length; i += 1) {
        await tx`UPDATE learn_map_nodes SET sort = ${i} WHERE id = ${ids[i]}`;
      }
    } else {
      const toNodes = await tx<{ id: string }[]>`
        SELECT id FROM learn_map_nodes WHERE section_id = ${toSectionId} ORDER BY sort ASC
      `;
      const { fromIds, toIds } = moveBetweenLists(fromNodes.map((n) => n.id), toNodes.map((n) => n.id), nodeId, toIndex);
      for (let i = 0; i < fromIds.length; i += 1) {
        await tx`UPDATE learn_map_nodes SET sort = ${i} WHERE id = ${fromIds[i]}`;
      }
      for (let i = 0; i < toIds.length; i += 1) {
        await tx`UPDATE learn_map_nodes SET section_id = ${toSectionId}, sort = ${i} WHERE id = ${toIds[i]}`;
      }
    }
  });

  revalidatePath("/app/admin/learn/map");
  revalidatePath("/dashboard");
  return { ok: true };
}
