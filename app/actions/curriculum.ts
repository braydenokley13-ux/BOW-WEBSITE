"use server";

/* ============================================================
 * Curricula CRUD — admin-only. Classes reference a curriculum via
 * classes.curriculum_id (NOT NULL).
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateCurriculumInput {
  title: string;
  description?: string;
  ageRange?: string;
}

export async function createCurriculum(input: CreateCurriculumInput): Promise<ActionResult & { id?: string }> {
  await requireAdmin();
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > 200) return { ok: false, error: "Title is too long." };
  const description = (input.description ?? "").trim().slice(0, 2000);
  const ageRange = (input.ageRange ?? "").trim().slice(0, 60);

  const id = `pfx-${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO curricula (id, title, description, age_range, published, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
    )
    .run(id, title.slice(0, 200), description || null, ageRange || null, now, now);

  revalidatePath("/app/curriculum");
  return { ok: true, id };
}

export interface UpdateCurriculumPatch {
  title?: string;
  description?: string;
  ageRange?: string;
  published?: boolean;
}

export async function updateCurriculum(id: string, patch: UpdateCurriculumPatch): Promise<ActionResult> {
  await requireAdmin();
  const db = getDb();
  const row = db.prepare("SELECT * FROM curricula WHERE id = ?").get(id) as { id: string } | undefined;
  if (!row) return { ok: false, error: "Not found." };

  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) return { ok: false, error: "Title can't be empty." };
    sets.push("title = ?");
    vals.push(title.slice(0, 200));
  }
  if (patch.description !== undefined) {
    sets.push("description = ?");
    vals.push(patch.description.trim().slice(0, 2000) || null);
  }
  if (patch.ageRange !== undefined) {
    sets.push("age_range = ?");
    vals.push(patch.ageRange.trim().slice(0, 60) || null);
  }
  if (patch.published !== undefined) {
    sets.push("published = ?");
    vals.push(patch.published ? 1 : 0);
  }
  if (sets.length === 0) return { ok: true };

  sets.push("updated_at = ?");
  vals.push(Date.now());
  vals.push(id);
  db.prepare(`UPDATE curricula SET ${sets.join(", ")} WHERE id = ?`).run(...(vals as []));

  revalidatePath("/app/curriculum");
  revalidatePath(`/app/curriculum/${id}`);
  return { ok: true };
}
