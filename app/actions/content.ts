"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";

/* eslint-disable @typescript-eslint/no-explicit-any */

function refresh() {
  revalidatePath("/admin");
}

const nextOrdinal = (table: string): number => {
  const r = getDb().prepare(`SELECT COALESCE(MAX(ordinal), 0) AS m FROM ${table}`).get() as any;
  return (Number(r?.m) || 0) + 1;
};

/* ---------------- Daily Questions (admin) ---------------- */

export interface DailyQuestionInput {
  questionText: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correctAnswer: string;
  explanation: string;
  conceptTag: string;
  difficulty: number;
  activeDate?: string | null;
}

function validDaily(i: DailyQuestionInput): boolean {
  return (
    !!i.questionText.trim() &&
    !!i.choiceA.trim() && !!i.choiceB.trim() && !!i.choiceC.trim() && !!i.choiceD.trim() &&
    ["A", "B", "C", "D"].includes(String(i.correctAnswer).toUpperCase()) &&
    !!i.explanation.trim() && !!i.conceptTag.trim()
  );
}

export async function createDailyQuestion(input: DailyQuestionInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!validDaily(input)) return { ok: false };
  const id = `dq-${randomUUID().slice(0, 8)}`;
  const diff = [1, 2, 3].includes(Number(input.difficulty)) ? Number(input.difficulty) : 1;
  getDb()
    .prepare(
      "INSERT INTO daily_questions (id, ordinal, question_text, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation, concept_tag, difficulty, active_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, nextOrdinal("daily_questions"), input.questionText.trim(), input.choiceA.trim(), input.choiceB.trim(), input.choiceC.trim(), input.choiceD.trim(), String(input.correctAnswer).toUpperCase(), input.explanation.trim(), input.conceptTag.trim(), diff, input.activeDate?.trim() || null);
  refresh();
  return { ok: true };
}

export async function updateDailyQuestion(id: string, input: DailyQuestionInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!validDaily(input)) return { ok: false };
  const diff = [1, 2, 3].includes(Number(input.difficulty)) ? Number(input.difficulty) : 1;
  getDb()
    .prepare(
      "UPDATE daily_questions SET question_text = ?, choice_a = ?, choice_b = ?, choice_c = ?, choice_d = ?, correct_answer = ?, explanation = ?, concept_tag = ?, difficulty = ?, active_date = ? WHERE id = ?",
    )
    .run(input.questionText.trim(), input.choiceA.trim(), input.choiceB.trim(), input.choiceC.trim(), input.choiceD.trim(), String(input.correctAnswer).toUpperCase(), input.explanation.trim(), input.conceptTag.trim(), diff, input.activeDate?.trim() || null, id);
  refresh();
  return { ok: true };
}

/* ---------------- News items (admin) ---------------- */

export interface NewsItemInput {
  headline: string;
  summary: string;
  sourceName?: string;
  sourceUrl?: string;
  conceptTag?: string;
  publishedDate?: string;
}

export async function createNewsItem(input: NewsItemInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!input.headline.trim() || !input.summary.trim()) return { ok: false };
  const id = `nw-${randomUUID().slice(0, 8)}`;
  getDb()
    .prepare(
      "INSERT INTO news_items (id, headline, summary, source_name, source_url, concept_tag, published_date, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
    )
    .run(id, input.headline.trim(), input.summary.trim(), input.sourceName?.trim() || "", input.sourceUrl?.trim() || "", input.conceptTag?.trim() || "", input.publishedDate?.trim() || "", Date.now());
  refresh();
  revalidatePath("/news");
  return { ok: true };
}

export async function setNewsItemActive(id: string, active: boolean): Promise<{ ok: boolean }> {
  await requireRole("admin");
  getDb().prepare("UPDATE news_items SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  refresh();
  revalidatePath("/news");
  return { ok: true };
}

/** Approve a student submission: copy it into news_items and mark it approved. */
export async function approveNewsSubmission(submissionId: string): Promise<{ ok: boolean }> {
  await requireRole("admin");
  const db = getDb();
  const s = db.prepare("SELECT * FROM news_submissions WHERE id = ? AND status = 'pending'").get(submissionId) as any;
  if (!s) return { ok: false };
  db.prepare(
    "INSERT INTO news_items (id, headline, summary, source_name, source_url, concept_tag, published_date, active, created_at) VALUES (?, ?, ?, '', ?, '', '', 1, ?)",
  ).run(`nw-${randomUUID().slice(0, 8)}`, s.headline, s.summary ?? "", s.source_url ?? "", Date.now());
  db.prepare("UPDATE news_submissions SET status = 'approved' WHERE id = ?").run(submissionId);
  refresh();
  revalidatePath("/news");
  return { ok: true };
}

export async function rejectNewsSubmission(submissionId: string): Promise<{ ok: boolean }> {
  await requireRole("admin");
  getDb().prepare("UPDATE news_submissions SET status = 'rejected' WHERE id = ? AND status = 'pending'").run(submissionId);
  refresh();
  return { ok: true };
}

/* ---------------- News submission (student) ---------------- */

export interface NewsSubmissionInput {
  headline: string;
  summary: string;
  sourceUrl?: string;
}

export async function submitNewsStory(input: NewsSubmissionInput): Promise<{ ok: boolean }> {
  const me = await requireRole("student");
  if (!input.headline.trim()) return { ok: false };
  getDb()
    .prepare(
      "INSERT INTO news_submissions (id, student_id, headline, summary, source_url, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
    )
    .run(`ns-${randomUUID().slice(0, 8)}`, me.id, input.headline.trim(), input.summary?.trim() || "", input.sourceUrl?.trim() || "", Date.now());
  revalidatePath("/news");
  return { ok: true };
}

/* ---------------- Testimonials (admin) ---------------- */

export interface TestimonialInput {
  quote: string;
  studentName: string;
  schoolName?: string;
  trackCompleted?: string;
  active?: boolean;
}

export async function createTestimonial(input: TestimonialInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!input.quote.trim() || !input.studentName.trim()) return { ok: false };
  const id = `tm-${randomUUID().slice(0, 8)}`;
  getDb()
    .prepare(
      "INSERT INTO testimonials (id, quote, student_name, school_name, track_completed, active, ordinal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, input.quote.trim(), input.studentName.trim(), input.schoolName?.trim() || "", input.trackCompleted?.trim() || "", input.active === false ? 0 : 1, nextOrdinal("testimonials"), Date.now());
  refresh();
  revalidatePath("/");
  return { ok: true };
}

export async function updateTestimonial(id: string, input: TestimonialInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!input.quote.trim() || !input.studentName.trim()) return { ok: false };
  getDb()
    .prepare(
      "UPDATE testimonials SET quote = ?, student_name = ?, school_name = ?, track_completed = ?, active = ? WHERE id = ?",
    )
    .run(input.quote.trim(), input.studentName.trim(), input.schoolName?.trim() || "", input.trackCompleted?.trim() || "", input.active === false ? 0 : 1, id);
  refresh();
  revalidatePath("/");
  return { ok: true };
}

/* ---------------- Glossary (admin) ---------------- */

export interface GlossaryInput {
  term: string;
  definition: string;
  moduleName: string;
  track: string;
  realWorldExample: string;
  category: string;
}

const GLOSSARY_CATEGORIES = ["cap_mechanics", "economics", "analytics", "business"];

function validGlossary(i: GlossaryInput): boolean {
  return !!i.term.trim() && !!i.definition.trim() && GLOSSARY_CATEGORIES.includes(i.category);
}

export async function createGlossaryTerm(input: GlossaryInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!validGlossary(input)) return { ok: false };
  const id = `gl-${randomUUID().slice(0, 8)}`;
  getDb()
    .prepare(
      "INSERT INTO glossary_terms (id, ordinal, term, definition, module_name, track, real_world_example, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, nextOrdinal("glossary_terms"), input.term.trim(), input.definition.trim(), input.moduleName.trim(), input.track.trim() || "101", input.realWorldExample.trim(), input.category);
  refresh();
  revalidatePath("/glossary");
  return { ok: true };
}

export async function updateGlossaryTerm(id: string, input: GlossaryInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!validGlossary(input)) return { ok: false };
  getDb()
    .prepare(
      "UPDATE glossary_terms SET term = ?, definition = ?, module_name = ?, track = ?, real_world_example = ?, category = ? WHERE id = ?",
    )
    .run(input.term.trim(), input.definition.trim(), input.moduleName.trim(), input.track.trim() || "101", input.realWorldExample.trim(), input.category, id);
  refresh();
  revalidatePath("/glossary");
  return { ok: true };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
