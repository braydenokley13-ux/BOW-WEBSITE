/* ============================================================
 * Editable content (Feature 8) — read layer.
 *
 * Testimonials (homepage), news items + student submissions (/news),
 * and admin-facing list views for the Content tab. Unlike the
 * curriculum reference data, these are admin-editable, so they seed
 * only on a fresh database and are never overwritten on reboot.
 *
 * Server-only.
 * ============================================================ */

import { getDb } from "@/lib/db";

export interface Testimonial {
  id: string;
  quote: string;
  studentName: string;
  schoolName: string;
  trackCompleted: string;
  active: boolean;
  ordinal: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  conceptTag: string;
  publishedDate: string;
  active: boolean;
  createdAt: number;
}

export interface NewsSubmission {
  id: string;
  studentId: string;
  studentName: string;
  headline: string;
  summary: string;
  sourceUrl: string;
  status: string;
  createdAt: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToTestimonial(r: any): Testimonial {
  return {
    id: r.id,
    quote: r.quote,
    studentName: r.student_name,
    schoolName: r.school_name ?? "",
    trackCompleted: r.track_completed ?? "",
    active: !!r.active,
    ordinal: Number(r.ordinal) || 0,
  };
}

/** Active testimonials for the homepage, ordered. */
export async function getActiveTestimonials(): Promise<Testimonial[]> {
  return ((await getDb()
      .prepare("SELECT * FROM testimonials WHERE active = 1 ORDER BY ordinal ASC, created_at ASC")
      .all()) as any[]).map(rowToTestimonial);
}

/** Every testimonial (admin manager). */
export async function getAllTestimonials(): Promise<Testimonial[]> {
  return ((await getDb()
      .prepare("SELECT * FROM testimonials ORDER BY ordinal ASC, created_at ASC")
      .all()) as any[]).map(rowToTestimonial);
}

function rowToNews(r: any): NewsItem {
  return {
    id: r.id,
    headline: r.headline,
    summary: r.summary,
    sourceName: r.source_name ?? "",
    sourceUrl: r.source_url ?? "",
    conceptTag: r.concept_tag ?? "",
    publishedDate: r.published_date ?? "",
    active: !!r.active,
    createdAt: Number(r.created_at) || 0,
  };
}

/** Active news items for the public /news page, newest first. */
export async function getActiveNewsItems(): Promise<NewsItem[]> {
  return ((await getDb()
      .prepare("SELECT * FROM news_items WHERE active = 1 ORDER BY created_at DESC")
      .all()) as any[]).map(rowToNews);
}

/** Every news item (admin manager), newest first. */
export async function getAllNewsItems(): Promise<NewsItem[]> {
  return ((await getDb()
      .prepare("SELECT * FROM news_items ORDER BY created_at DESC")
      .all()) as any[]).map(rowToNews);
}

/** Pending student news submissions (admin manager), newest first. */
export async function getPendingNewsSubmissions(): Promise<NewsSubmission[]> {
  return ((await getDb()
      .prepare(
        "SELECT s.*, u.name AS student_name FROM news_submissions s LEFT JOIN users u ON u.id = s.student_id WHERE s.status = 'pending' ORDER BY s.created_at DESC",
      )
      .all()) as any[]).map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name ?? "Student",
    headline: r.headline,
    summary: r.summary ?? "",
    sourceUrl: r.source_url ?? "",
    status: r.status,
    createdAt: Number(r.created_at) || 0,
  }));
}

/** Daily questions with how many students have answered each (admin manager). */
export interface DailyQuestionAdminRow {
  id: string;
  ordinal: number;
  questionText: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  conceptTag: string;
  difficulty: number;
  type: string;
  track: string;
  points: number;
  active: boolean;
  activeDate: string | null;
  correctAnswer: string;
  explanation: string;
  answeredCount: number;
}

export async function getDailyQuestionsAdmin(): Promise<DailyQuestionAdminRow[]> {
  const rows = (await getDb()
      .prepare(
        `SELECT q.id, q.ordinal, q.question_text, q.choice_a, q.choice_b, q.choice_c, q.choice_d,
              q.concept_tag, q.difficulty, q.type, q.track, q.points, q.active, q.active_date, q.correct_answer, q.explanation,
              (SELECT COUNT(*) FROM daily_responses r WHERE r.question_id = q.id) AS answered
       FROM daily_questions q ORDER BY q.ordinal ASC`,
      )
      .all()) as any[];
  return rows.map((r) => {
    const type = r.type === "math" || r.type === "fr" ? r.type : "mc";
    return {
      id: r.id,
      ordinal: Number(r.ordinal) || 0,
      questionText: r.question_text,
      choiceA: r.choice_a ?? "",
      choiceB: r.choice_b ?? "",
      choiceC: r.choice_c ?? "",
      choiceD: r.choice_d ?? "",
      conceptTag: r.concept_tag,
      difficulty: Number(r.difficulty) || 1,
      type,
      track: r.track === "201" ? "201" : "101",
      points: Number(r.points) || 10,
      active: r.active == null ? true : Number(r.active) === 1,
      activeDate: r.active_date ?? null,
      correctAnswer: type === "mc" ? String(r.correct_answer ?? "").toUpperCase() : String(r.correct_answer ?? ""),
      explanation: r.explanation ?? "",
      answeredCount: Number(r.answered) || 0,
    };
  });
}

/* eslint-enable @typescript-eslint/no-explicit-any */
