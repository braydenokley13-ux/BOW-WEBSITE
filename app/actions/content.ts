"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { pointsForDifficulty } from "@/lib/daily-question";
import { consumeRateLimit } from "@/lib/rate-limit";

/* eslint-disable @typescript-eslint/no-explicit-any */

function refresh() {
  revalidatePath("/admin");
}

const nextOrdinal = async (table: string): Promise<number> => {
  const r = (await getDb().prepare(`SELECT COALESCE(MAX(ordinal), 0) AS m FROM ${table}`).get()) as any;
  return (Number(r?.m) || 0) + 1;
};

/* ---------------- Daily Questions (admin) ---------------- */

export interface DailyQuestionInput {
  questionText: string;
  /** "mc" | "math" | "fr" */
  type: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correctAnswer: string;
  explanation: string;
  conceptTag: string;
  difficulty: number;
  /** "101" | "201" */
  track: string;
  /** XP for a correct answer; defaults from difficulty when blank. */
  points?: number;
  active?: boolean;
  activeDate?: string | null;
}

const QTYPES = ["mc", "math", "fr"];
const normType = (t: string): string => (QTYPES.includes(t) ? t : "mc");
const normTrack = (t: string): string => (t === "201" ? "201" : "101");
const normDiff = (d: number): number => ([1, 2, 3].includes(Number(d)) ? Number(d) : 1);
const normKey = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

/** MC needs four choices and an A–D key; math/fr just need an expected answer. */
function validDaily(i: DailyQuestionInput): boolean {
  if (!i.questionText.trim() || !i.explanation.trim() || !i.conceptTag.trim()) return false;
  if (normType(i.type) === "mc") {
    return (
      !!i.choiceA.trim() && !!i.choiceB.trim() && !!i.choiceC.trim() && !!i.choiceD.trim() &&
      ["A", "B", "C", "D"].includes(String(i.correctAnswer).trim().toUpperCase())
    );
  }
  return !!String(i.correctAnswer ?? "").trim();
}

/** Normalize validated input into the DB column values. */
function dailyValues(i: DailyQuestionInput) {
  const type = normType(i.type);
  const difficulty = normDiff(i.difficulty);
  return {
    questionText: i.questionText.trim(),
    type,
    choiceA: (i.choiceA ?? "").trim(),
    choiceB: (i.choiceB ?? "").trim(),
    choiceC: (i.choiceC ?? "").trim(),
    choiceD: (i.choiceD ?? "").trim(),
    correct: type === "mc" ? String(i.correctAnswer).trim().toUpperCase() : String(i.correctAnswer).trim(),
    explanation: i.explanation.trim(),
    conceptTag: i.conceptTag.trim(),
    difficulty,
    track: normTrack(i.track),
    points: i.points && Number(i.points) > 0 ? Number(i.points) : pointsForDifficulty(difficulty),
    active: i.active === false ? 0 : 1,
    activeDate: i.activeDate?.trim() || null,
  };
}

/** Create (id null) or update an existing daily question. */
export async function upsertDailyQuestion(id: string | null, input: DailyQuestionInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!validDaily(input)) return { ok: false };
  const v = dailyValues(input);
  const db = getDb();
  if (id) {
    (await db.prepare(
            "UPDATE daily_questions SET question_text=?, type=?, choice_a=?, choice_b=?, choice_c=?, choice_d=?, correct_answer=?, explanation=?, concept_tag=?, difficulty=?, track=?, points=?, active=?, active_date=? WHERE id=?",
          ).run(v.questionText, v.type, v.choiceA, v.choiceB, v.choiceC, v.choiceD, v.correct, v.explanation, v.conceptTag, v.difficulty, v.track, v.points, v.active, v.activeDate, id));
  } else {
    (await db.prepare(
            "INSERT INTO daily_questions (id, ordinal, question_text, type, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation, concept_tag, difficulty, track, points, active, active_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          ).run(`dq-${randomUUID().slice(0, 8)}`, nextOrdinal("daily_questions"), v.questionText, v.type, v.choiceA, v.choiceB, v.choiceC, v.choiceD, v.correct, v.explanation, v.conceptTag, v.difficulty, v.track, v.points, v.active, v.activeDate));
  }
  refresh();
  return { ok: true };
}

// Back-compat wrappers around upsertDailyQuestion.
export async function createDailyQuestion(input: DailyQuestionInput): Promise<{ ok: boolean }> {
  return (await upsertDailyQuestion(null, input));
}
export async function updateDailyQuestion(id: string, input: DailyQuestionInput): Promise<{ ok: boolean }> {
  return (await upsertDailyQuestion(id, input));
}

/** Bulk show/hide questions by id. */
export async function setDailyQuestionsActive(ids: string[], active: boolean): Promise<{ ok: boolean; updated: number }> {
  await requireRole("admin");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true, updated: 0 };
  const stmt = getDb().prepare("UPDATE daily_questions SET active = ? WHERE id = ?");
  let updated = 0;
  for (const id of ids) updated += Number((await stmt.run(active ? 1 : 0, String(id))).changes) || 0;
  refresh();
  return { ok: true, updated };
}

/** Bulk delete questions (and their responses) by id. */
export async function deleteDailyQuestions(ids: string[]): Promise<{ ok: boolean; deleted: number }> {
  await requireRole("admin");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true, deleted: 0 };
  const db = getDb();
  const delResp = db.prepare("DELETE FROM daily_responses WHERE question_id = ?");
  const del = db.prepare("DELETE FROM daily_questions WHERE id = ?");
  let deleted = 0;
  for (const id of ids) {
    (await delResp.run(String(id)));
    deleted += Number((await del.run(String(id))).changes) || 0;
  }
  refresh();
  return { ok: true, deleted };
}

export interface BulkImportResult {
  ok: boolean;
  inserted: number;
  skipped: number;
  errors: number;
  message: string;
}

/** Difficulty as a number from either an int or a tier string ("rookie"/"pro"/"executive"). */
function parseDifficulty(d: any): number {
  if (typeof d === "number") return normDiff(d);
  const s = String(d ?? "").toLowerCase();
  if (s === "executive" || s === "3") return 3;
  if (s === "pro" || s === "2") return 2;
  return 1;
}

/** Coerce a loose JSON object into a DailyQuestionInput (accepts common aliases). */
function coerceImport(raw: any): DailyQuestionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const opts = Array.isArray(raw.options) ? raw.options.map((o: any) => String(o ?? "")) : [];
  return {
    questionText: String(raw.questionText ?? raw.question_text ?? raw.question ?? ""),
    type: String(raw.type ?? "mc"),
    choiceA: String(raw.choiceA ?? raw.choice_a ?? opts[0] ?? ""),
    choiceB: String(raw.choiceB ?? raw.choice_b ?? opts[1] ?? ""),
    choiceC: String(raw.choiceC ?? raw.choice_c ?? opts[2] ?? ""),
    choiceD: String(raw.choiceD ?? raw.choice_d ?? opts[3] ?? ""),
    correctAnswer: String(raw.correctAnswer ?? raw.correct_answer ?? ""),
    explanation: String(raw.explanation ?? ""),
    conceptTag: String(raw.conceptTag ?? raw.concept_tag ?? ""),
    difficulty: parseDifficulty(raw.difficulty),
    track: String(raw.track ?? "101"),
    points: raw.points != null ? Number(raw.points) : undefined,
    active: raw.active === false ? false : true,
    activeDate: raw.activeDate ?? raw.active_date ?? null,
  };
}

/**
 * Bulk-insert a JSON array of question objects. Skips duplicates (by normalized
 * question text, against the DB and within the batch) and invalid rows; returns
 * a summary. Malformed (non-array) input is reported, never thrown.
 */
export async function bulkImportQuestions(questions: unknown): Promise<BulkImportResult> {
  await requireRole("admin");
  if (!Array.isArray(questions)) {
    return { ok: false, inserted: 0, skipped: 0, errors: 0, message: "Expected a JSON array of question objects." };
  }
  const db = getDb();
  const existing = new Set(
    ((await db.prepare("SELECT question_text FROM daily_questions").all()) as any[]).map((r) => normKey(String(r.question_text))),
  );
  const insert = db.prepare(
    "INSERT INTO daily_questions (id, ordinal, question_text, type, choice_a, choice_b, choice_c, choice_d, correct_answer, explanation, concept_tag, difficulty, track, points, active, active_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  let inserted = 0, skipped = 0, errors = 0;
  let ordinal = (await nextOrdinal("daily_questions"));
  for (const raw of questions) {
    const input = coerceImport(raw);
    if (!input || !validDaily(input)) { errors++; continue; }
    const key = normKey(input.questionText);
    if (existing.has(key)) { skipped++; continue; }
    const v = dailyValues(input);
    (await insert.run(`dq-${randomUUID().slice(0, 8)}`, ordinal++, v.questionText, v.type, v.choiceA, v.choiceB, v.choiceC, v.choiceD, v.correct, v.explanation, v.conceptTag, v.difficulty, v.track, v.points, v.active, v.activeDate));
    existing.add(key);
    inserted++;
  }
  refresh();
  return { ok: true, inserted, skipped, errors, message: `${inserted} inserted, ${skipped} skipped${errors ? `, ${errors} invalid` : ""}.` };
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
  (await getDb()
        .prepare(
          "INSERT INTO news_items (id, headline, summary, source_name, source_url, concept_tag, published_date, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
        )
        .run(id, input.headline.trim(), input.summary.trim(), input.sourceName?.trim() || "", input.sourceUrl?.trim() || "", input.conceptTag?.trim() || "", input.publishedDate?.trim() || "", Date.now()));
  refresh();
  revalidatePath("/news");
  return { ok: true };
}

export async function setNewsItemActive(id: string, active: boolean): Promise<{ ok: boolean }> {
  await requireRole("admin");
  (await getDb().prepare("UPDATE news_items SET active = ? WHERE id = ?").run(active ? 1 : 0, id));
  refresh();
  revalidatePath("/news");
  return { ok: true };
}

/** Approve a student submission: copy it into news_items and mark it approved. */
export async function approveNewsSubmission(submissionId: string): Promise<{ ok: boolean }> {
  await requireRole("admin");
  const db = getDb();
  const s = (await db.prepare("SELECT * FROM news_submissions WHERE id = ? AND status = 'pending'").get(submissionId)) as any;
  if (!s) return { ok: false };
  (await db.prepare(
        "INSERT INTO news_items (id, headline, summary, source_name, source_url, concept_tag, published_date, active, created_at) VALUES (?, ?, ?, '', ?, '', '', 1, ?)",
      ).run(`nw-${randomUUID().slice(0, 8)}`, s.headline, s.summary ?? "", s.source_url ?? "", Date.now()));
  (await db.prepare("UPDATE news_submissions SET status = 'approved' WHERE id = ?").run(submissionId));
  refresh();
  revalidatePath("/news");
  return { ok: true };
}

export async function rejectNewsSubmission(submissionId: string): Promise<{ ok: boolean }> {
  await requireRole("admin");
  (await getDb().prepare("UPDATE news_submissions SET status = 'rejected' WHERE id = ? AND status = 'pending'").run(submissionId));
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
  const headline = input.headline.trim();
  const summary = input.summary?.trim() || "";
  const sourceUrl = input.sourceUrl?.trim() || "";
  if (!headline || headline.length > 200 || summary.length > 2000 || sourceUrl.length > 2000) return { ok: false };
  if (sourceUrl && !/^https?:\/\/[^\s]+$/i.test(sourceUrl)) return { ok: false };
  const limit = (await consumeRateLimit("news-submission-user", me.id, {
      limit: 20,
      windowMs: 24 * 60 * 60 * 1000,
      blockMs: 24 * 60 * 60 * 1000,
    }));
  if (!limit.allowed) return { ok: false };
  (await getDb()
        .prepare(
          "INSERT INTO news_submissions (id, student_id, headline, summary, source_url, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
        )
        .run(`ns-${randomUUID().slice(0, 8)}`, me.id, headline, summary, sourceUrl, Date.now()));
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
  (await getDb()
        .prepare(
          "INSERT INTO testimonials (id, quote, student_name, school_name, track_completed, active, ordinal, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(id, input.quote.trim(), input.studentName.trim(), input.schoolName?.trim() || "", input.trackCompleted?.trim() || "", input.active === false ? 0 : 1, nextOrdinal("testimonials"), Date.now()));
  refresh();
  revalidatePath("/");
  return { ok: true };
}

export async function updateTestimonial(id: string, input: TestimonialInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!input.quote.trim() || !input.studentName.trim()) return { ok: false };
  (await getDb()
        .prepare(
          "UPDATE testimonials SET quote = ?, student_name = ?, school_name = ?, track_completed = ?, active = ? WHERE id = ?",
        )
        .run(input.quote.trim(), input.studentName.trim(), input.schoolName?.trim() || "", input.trackCompleted?.trim() || "", input.active === false ? 0 : 1, id));
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
  (await getDb()
        .prepare(
          "INSERT INTO glossary_terms (id, ordinal, term, definition, module_name, track, real_world_example, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(id, nextOrdinal("glossary_terms"), input.term.trim(), input.definition.trim(), input.moduleName.trim(), input.track.trim() || "101", input.realWorldExample.trim(), input.category));
  refresh();
  revalidatePath("/glossary");
  return { ok: true };
}

export async function updateGlossaryTerm(id: string, input: GlossaryInput): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (!validGlossary(input)) return { ok: false };
  (await getDb()
        .prepare(
          "UPDATE glossary_terms SET term = ?, definition = ?, module_name = ?, track = ?, real_world_example = ?, category = ? WHERE id = ?",
        )
        .run(input.term.trim(), input.definition.trim(), input.moduleName.trim(), input.track.trim() || "101", input.realWorldExample.trim(), input.category, id));
  refresh();
  revalidatePath("/glossary");
  return { ok: true };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
