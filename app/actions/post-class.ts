"use server";

/* ============================================================
 * Post a Class — permission and revalidation only.
 *
 * The publish transaction lives in lib/post-class.ts. This module checks who
 * is asking and refreshes the surfaces that show the result; it never writes
 * programs, classes or sessions directly.
 * ============================================================ */

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/dal";
import {
  publishClass as publishClassCore,
  type PublishClassInput,
  type PublishClassResult,
} from "@/lib/post-class";
import {
  discardClassDraft,
  loadClassDraft,
  saveClassDraft,
  type ClassDraftPayload,
} from "@/lib/class-draft";
import { listCourseLessons } from "@/lib/curriculum-courses";

export type { PublishClassInput, PublishClassResult } from "@/lib/post-class";

/* ===================================================================== */
/* Drafts                                                                */
/* ===================================================================== */

export async function saveDraft(payload: ClassDraftPayload): Promise<{ ok: boolean; savedAt: number }> {
  const me = await requireStaff();
  await saveClassDraft(me.id, payload);
  return { ok: true, savedAt: Date.now() };
}

export async function discardDraft(): Promise<{ ok: boolean }> {
  const me = await requireStaff();
  await discardClassDraft(me.id);
  revalidatePath("/app");
  return { ok: true };
}

export async function loadDraft(): Promise<ClassDraftPayload | null> {
  const me = await requireStaff();
  return loadClassDraft(me.id);
}

/** Lesson titles in order, so the composer can label each generated session. */
export async function courseLessonTitles(curriculumId: string): Promise<string[]> {
  await requireStaff();
  const lessons = await listCourseLessons(curriculumId);
  return lessons.map((lesson) => lesson.title);
}

/* ===================================================================== */
/* Publish                                                               */
/* ===================================================================== */

export async function publishClass(input: PublishClassInput): Promise<PublishClassResult> {
  const me = await requireStaff();
  const result = await publishClassCore({ id: me.id, name: me.name }, input);
  if (result.ok && result.classId) {
    revalidatePath("/app");
    revalidatePath("/app/programs");
    revalidatePath("/programs");
    revalidatePath(`/app/classes/${result.classId}`);
  }
  return result;
}
