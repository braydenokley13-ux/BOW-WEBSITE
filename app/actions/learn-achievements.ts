"use server";

/* ============================================================
 * app/actions/learn-achievements.ts — Stage 9 achievement editor server
 * actions.
 *
 * Native postgres.js only (sqlLearn) — same JSONB-heavy-table rule as
 * app/actions/learn-author.ts. Admin-gated (requireAdmin) throughout.
 *
 * `badges.rule` is validated with the SAME zod schema
 * (lib/learn/achievements.ts's AchievementRuleSchema) the award engine
 * parses at completeAttempt time — a rule that fails here can never be
 * saved, so a saved rule can never be malformed when the engine reads it
 * back. lessonId/moduleId/trackId values in a saved rule are real ids
 * picked from the human-title dropdowns below (listXForPicker), never
 * hand-typed, so the rule always names something that exists.
 *
 * System badges (source='system', the original lib/badges.ts catalog,
 * seeded by migration 005) are copy-editable (name/description/icon/
 * lockedHint) but their category/threshold/xpReward/rule are load-bearing
 * for the legacy condition-based engine in lib/badges.ts and are never
 * touched here — updateAchievementBadge silently ignores those fields for
 * a system badge rather than erroring, so the UI can share one form.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/dal";
import { sqlLearn } from "@/lib/db-sql";
import { AchievementRuleSchema, type AchievementRule } from "@/lib/learn/achievements";

export type ActionResult<T> = (T & { ok: true }) | { ok: false; error: string };
export type VoidActionResult = { ok: true } | { ok: false; error: string };

/* ---------------- list ---------------- */

export interface AchievementBadgeRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  source: "system" | "custom";
  active: boolean;
  lockedHint: string | null;
  rarity: string | null;
  rule: AchievementRule | null;
  /** True if `rule` jsonb failed to parse against the current schema (surfaced so an admin can fix/disable it, never silently dropped in the list view). */
  ruleInvalid: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToAchievementBadge(r: any): AchievementBadgeRow {
  let rule: AchievementRule | null = null;
  let ruleInvalid = false;
  if (r.rule != null) {
    const parsed = AchievementRuleSchema.safeParse(r.rule);
    if (parsed.success) rule = parsed.data;
    else ruleInvalid = true;
  }
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    icon: r.icon ?? "🏅",
    category: r.category ?? "special",
    xpReward: Number(r.xp_reward) || 0,
    source: r.source === "custom" ? "custom" : "system",
    active: Number(r.active ?? 1) !== 0,
    lockedHint: r.locked_hint ?? null,
    rarity: r.rarity ?? null,
    rule,
    ruleInvalid,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Every badge (system + custom), for the achievement editor's list view. */
export async function listAchievementBadges(): Promise<ActionResult<{ badges: AchievementBadgeRow[] }>> {
  await requireAdmin();
  const rows = await sqlLearn<Record<string, unknown>[]>`
    SELECT id, name, description, icon, category, xp_reward, source, active, locked_hint, rarity, rule
    FROM badges ORDER BY source ASC, ordinal ASC, name ASC
  `;
  return { ok: true, badges: rows.map(rowToAchievementBadge) };
}

/* ---------------- rule-target pickers (human titles, never hand-typed ids) ---------------- */

export async function listLessonsForRulePicker(): Promise<ActionResult<{ lessons: { id: string; title: string }[] }>> {
  await requireAdmin();
  const rows = await sqlLearn<{ id: string; title: string }[]>`
    SELECT id, title FROM learn_lessons WHERE lifecycle = 'active' ORDER BY title ASC
  `;
  return { ok: true, lessons: rows };
}

export async function listModulesForRulePicker(): Promise<ActionResult<{ modules: { id: string; title: string }[] }>> {
  await requireAdmin();
  const rows = await sqlLearn<{ id: string; title: string }[]>`
    SELECT id, title FROM learn_modules ORDER BY title ASC
  `;
  return { ok: true, modules: rows };
}

export async function listTracksForRulePicker(): Promise<ActionResult<{ tracks: { id: string; title: string }[] }>> {
  await requireAdmin();
  const rows = await sqlLearn<{ id: string; title: string }[]>`
    SELECT id, title FROM learn_tracks ORDER BY title ASC
  `;
  return { ok: true, tracks: rows };
}

export async function listVariablesForRulePicker(): Promise<ActionResult<{ variables: { key: string; label: string; lessonTitle: string }[] }>> {
  await requireAdmin();
  // learn_lesson_versions.doc is the immutable published doc; draft_doc on
  // learn_lessons covers unpublished lessons too so a variable can be wired
  // into a rule while its lesson is still in progress. Both are jsonb —
  // native sqlLearn only, per this module's header.
  const rows = await sqlLearn<{ title: string; doc: unknown }[]>`
    SELECT title, COALESCE(draft_doc, '{}'::jsonb) AS doc FROM learn_lessons WHERE lifecycle = 'active'
  `;
  const variables: { key: string; label: string; lessonTitle: string }[] = [];
  for (const row of rows) {
    const doc = row.doc as { variables?: { key: string; label: string }[] } | null;
    for (const v of doc?.variables ?? []) {
      if (v?.key) variables.push({ key: v.key, label: v.label ?? v.key, lessonTitle: row.title });
    }
  }
  return { ok: true, variables };
}

/* ---------------- create / update / disable ---------------- */

function slugId(prefix: string, name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${prefix}-${slug || randomUUID().slice(0, 8)}-${randomUUID().slice(0, 4)}`;
}

const AchievementBadgeInputSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().default(""),
  icon: z.string().min(1).max(8),
  lockedHint: z.string().max(200).optional().default(""),
  rarity: z.enum(["common", "rare", "legendary"]).optional(),
  xpReward: z.number().int().min(0).max(1000),
  rule: AchievementRuleSchema,
});
export type AchievementBadgeInput = z.infer<typeof AchievementBadgeInputSchema>;

export async function createAchievementBadge(input: AchievementBadgeInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = AchievementBadgeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid badge." };
  const d = parsed.data;
  const id = slugId("badge", d.name);
  const ordinalRows = await sqlLearn<{ m: number }[]>`SELECT COALESCE(MAX(ordinal), -1) AS m FROM badges`;
  await sqlLearn`
    INSERT INTO badges (id, name, description, icon, category, threshold, xp_reward, ordinal, source, rule, locked_hint, rarity, active)
    VALUES (${id}, ${d.name}, ${d.description}, ${d.icon}, 'special', 0, ${d.xpReward}, ${ordinalRows[0].m + 1}, 'custom', ${sqlLearn.json(d.rule as never)}, ${d.lockedHint}, ${d.rarity ?? null}, 1)
  `;
  revalidatePath("/app/admin/learn/achievements");
  return { ok: true, id };
}

export async function updateAchievementBadge(id: string, input: AchievementBadgeInput): Promise<VoidActionResult> {
  await requireAdmin();
  const parsed = AchievementBadgeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid badge." };
  const d = parsed.data;

  const existingRows = await sqlLearn<{ source: string }[]>`SELECT source FROM badges WHERE id = ${id}`;
  const existing = existingRows[0];
  if (!existing) return { ok: false, error: "Badge not found." };

  if (existing.source === "system") {
    // Copy-only for system badges — category/threshold/xpReward/rule stay
    // as the legacy lib/badges.ts condition engine expects them.
    await sqlLearn`
      UPDATE badges SET name = ${d.name}, description = ${d.description}, icon = ${d.icon}, locked_hint = ${d.lockedHint}
      WHERE id = ${id}
    `;
  } else {
    await sqlLearn`
      UPDATE badges SET
        name = ${d.name}, description = ${d.description}, icon = ${d.icon},
        locked_hint = ${d.lockedHint}, rarity = ${d.rarity ?? null},
        xp_reward = ${d.xpReward}, rule = ${sqlLearn.json(d.rule as never)}
      WHERE id = ${id}
    `;
  }
  revalidatePath("/app/admin/learn/achievements");
  return { ok: true };
}

/** Enable/disable a custom badge (never a system one — those are permanent). Disabling stops future awards (the completeAttempt query filters `rule IS NOT NULL`, so flip the rule check there too) without deleting history: already-earned student_badges rows are untouched and still render on a student's cabinet. */
export async function setAchievementBadgeActive(id: string, active: boolean): Promise<VoidActionResult> {
  await requireAdmin();
  const existingRows = await sqlLearn<{ source: string }[]>`SELECT source FROM badges WHERE id = ${id}`;
  const existing = existingRows[0];
  if (!existing) return { ok: false, error: "Badge not found." };
  if (existing.source === "system") return { ok: false, error: "System badges can't be disabled." };
  await sqlLearn`UPDATE badges SET active = ${active ? 1 : 0} WHERE id = ${id}`;
  revalidatePath("/app/admin/learn/achievements");
  return { ok: true };
}
