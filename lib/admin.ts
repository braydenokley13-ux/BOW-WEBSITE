/* ============================================================
 * Admin dashboard data (Feature 9).
 *
 * One server-side read that assembles the whole /admin view: platform
 * overview counts, cohort management rows, user management rows, a
 * content overview, and platform-health recency lists. All live from
 * SQLite.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { getDb } from "@/lib/db";
import { getSelfModules } from "@/lib/self-paced";
import { getAllPartnerOrgs, getDemoRequests, type PartnerOrg, type DemoRequest } from "@/lib/partners";
import { countDailyAnswersToday } from "@/lib/daily-question";
import { countGlossaryTerms, getGlossaryTerms, type GlossaryTerm } from "@/lib/glossary";
import { getStreakLeaders } from "@/lib/streak";
import {
  getDailyQuestionsAdmin,
  getAllNewsItems,
  getPendingNewsSubmissions,
  getAllTestimonials,
  type DailyQuestionAdminRow,
  type NewsItem,
  type NewsSubmission,
  type Testimonial,
} from "@/lib/content";

export interface AdminOverview {
  totalStudents: number;
  totalInstructors: number;
  totalCohorts: number;
  modulesCompleted: number;
  quizResponses: number;
  scenarioResponses: number;
  simulationsStarted: number;
  simulationsCompleted: number;
  certificatesIssued: number;
  /* ---- New platform surfaces (Features 3, 4, 5) ---- */
  discussionPosts: number;
  weeklyCompletions: number;
  partnerPages: number;
  demoRequests: number;
  /* ---- Daily Question, Streak & Glossary (Features 1, 2, 5) ---- */
  dailyAnswersToday: number;
  glossaryTerms: number;
  streakLeaders: { name: string; current: number }[];
}

export interface AdminCohortRow {
  id: string;
  name: string;
  instructorName: string;
  studentCount: number;
  avgModuleCompletionPct: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdLabel: string;
  lastActiveLabel: string;
  isSelf: boolean;
}

export interface AdminContent {
  scenarioCount: number;
  quizByModule: { ordinal: number; title: string; count: number }[];
  responsesPerScenario: { concept: string; ordinal: number; count: number }[];
  quizResponsesByModule: { ordinal: number; title: string; count: number }[];
}

export interface AdminHealth {
  recentStudents: { name: string; when: string }[];
  recentModules: { name: string; moduleTitle: string; when: string }[];
  recentCertificates: { name: string; when: string }[];
}

/** Editable content lists for the admin Content managers (Feature 8). */
export interface AdminContentMgmt {
  dailyQuestions: DailyQuestionAdminRow[];
  newsItems: NewsItem[];
  newsSubmissions: NewsSubmission[];
  testimonials: Testimonial[];
  glossary: GlossaryTerm[];
}

export interface AdminData {
  overview: AdminOverview;
  cohorts: AdminCohortRow[];
  users: AdminUserRow[];
  content: AdminContent;
  contentMgmt: AdminContentMgmt;
  health: AdminHealth;
  instructors: { id: string; name: string }[];
  partners: { orgs: PartnerOrg[]; demoRequests: DemoRequest[] };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const countOf = async (sql: string): Promise<number> => Number(((await getDb().prepare(sql).get()) as any)?.n) || 0;

const fmtDate = (ts: number | null): string =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function relative(ts: number | null): string {
  if (ts == null) return "Never";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return fmtDate(ts);
}

export async function getAdminData(adminId: string): Promise<AdminData> {
  const db = getDb();
  const modules = (await getSelfModules());
  const titleOf = (ordinal: number) => modules.find((m) => m.ordinal === ordinal)?.title ?? `Module ${ordinal}`;

  const overview: AdminOverview = {
    totalStudents: (await countOf("SELECT COUNT(*) AS n FROM users WHERE role = 'student' AND status != 'invited'")),
    totalInstructors: (await countOf("SELECT COUNT(*) AS n FROM users WHERE role = 'instructor'")),
    totalCohorts: (await countOf("SELECT COUNT(*) AS n FROM cohorts")),
    modulesCompleted: (await countOf("SELECT COUNT(*) AS n FROM self_progress WHERE completed = 1")),
    quizResponses: (await countOf("SELECT COUNT(*) AS n FROM quiz_responses")),
    scenarioResponses: (await countOf("SELECT COUNT(*) AS n FROM scenario_responses")),
    simulationsStarted: (await countOf("SELECT COUNT(*) AS n FROM simulations")),
    simulationsCompleted: (await countOf("SELECT COUNT(*) AS n FROM simulations WHERE completed = 1")),
    certificatesIssued: (await countOf("SELECT COUNT(*) AS n FROM certificates")),
    discussionPosts: (await countOf("SELECT COUNT(*) AS n FROM discussion_posts")),
    weeklyCompletions: (await countOf("SELECT COUNT(*) AS n FROM weekly_completions")),
    partnerPages: (await countOf("SELECT COUNT(*) AS n FROM partner_orgs")),
    demoRequests: (await countOf("SELECT COUNT(*) AS n FROM demo_requests")),
    dailyAnswersToday: (await countDailyAnswersToday()),
    glossaryTerms: (await countGlossaryTerms()),
    streakLeaders: (await getStreakLeaders(3)).map((s) => ({ name: s.name, current: s.current })),
  };

  // Cohort management: student count + avg module completion rate.
  const cohortRows = (await db.prepare("SELECT c.id, c.name, u.name AS instructor FROM cohorts c LEFT JOIN users u ON u.id = c.instructor_id ORDER BY c.name ASC").all()) as any[];
  const totalModules = Math.max(1, modules.length);
  const cohorts: AdminCohortRow[] = (await Promise.all(cohortRows.map(async (c) => {
      const studentCount = Number(
        ((await db.prepare("SELECT COUNT(*) AS n FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.cohort_id = ? AND e.enroll = 'active' AND u.role = 'student'").get(c.id)) as any)?.n,
      ) || 0;
      const completed = Number(
        ((await db.prepare(
                  "SELECT COUNT(*) AS n FROM self_progress sp WHERE sp.completed = 1 AND sp.student_id IN (SELECT e.user_id FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.cohort_id = ? AND e.enroll = 'active' AND u.role = 'student')",
                ).get(c.id)) as any)?.n,
      ) || 0;
      return {
        id: c.id,
        name: c.name,
        instructorName: c.instructor ?? "Unassigned",
        studentCount,
        avgModuleCompletionPct: studentCount > 0 ? Math.round((completed / (studentCount * totalModules)) * 100) : 0,
      };
    })));

  // User management.
  const users: AdminUserRow[] = ((await db.prepare("SELECT id, name, email, role, created_at, last_active_at FROM users ORDER BY role ASC, name ASC").all()) as any[]).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdLabel: fmtDate(u.created_at != null ? Number(u.created_at) : null),
    lastActiveLabel: relative(u.last_active_at != null ? Number(u.last_active_at) : null),
    isSelf: u.id === adminId,
  }));

  // Content overview.
  const quizByModule = ((await db.prepare("SELECT module_unlock AS ordinal, COUNT(*) AS n FROM quiz_questions GROUP BY module_unlock ORDER BY module_unlock ASC").all()) as any[]).map((r) => ({
    ordinal: Number(r.ordinal),
    title: titleOf(Number(r.ordinal)),
    count: Number(r.n),
  }));
  const quizResponsesByModule = ((await db.prepare(
      "SELECT q.module_unlock AS ordinal, COUNT(r.id) AS n FROM quiz_responses r JOIN quiz_questions q ON q.id = r.question_id GROUP BY q.module_unlock ORDER BY q.module_unlock ASC",
    ).all()) as any[]).map((r) => ({ ordinal: Number(r.ordinal), title: titleOf(Number(r.ordinal)), count: Number(r.n) }));
  const responsesPerScenario = ((await db.prepare(
      "SELECT s.concept, s.ordinal, COUNT(r.id) AS n FROM daily_scenarios s LEFT JOIN scenario_responses r ON r.scenario_id = s.id GROUP BY s.id ORDER BY s.ordinal ASC",
    ).all()) as any[]).map((r) => ({ concept: r.concept, ordinal: Number(r.ordinal), count: Number(r.n) }));

  const content: AdminContent = {
    scenarioCount: (await countOf("SELECT COUNT(*) AS n FROM daily_scenarios")),
    quizByModule,
    responsesPerScenario,
    quizResponsesByModule,
  };

  // Platform health: recency lists.
  const recentStudents = ((await db.prepare("SELECT name, last_active_at FROM users WHERE role = 'student' AND last_active_at IS NOT NULL ORDER BY last_active_at DESC LIMIT 5").all()) as any[]).map((r) => ({
    name: r.name,
    when: relative(Number(r.last_active_at)),
  }));
  const recentModules = ((await db.prepare(
      "SELECT u.name AS name, sm.title AS title, sp.completed_at AS at FROM self_progress sp JOIN users u ON u.id = sp.student_id JOIN self_modules sm ON sm.id = sp.module_id WHERE sp.completed = 1 AND sp.completed_at IS NOT NULL ORDER BY sp.completed_at DESC LIMIT 5",
    ).all()) as any[]).map((r) => ({ name: r.name, moduleTitle: r.title, when: relative(Number(r.at)) }));
  const recentCertificates = ((await db.prepare(
      "SELECT u.name AS name, c.issued_at AS at FROM certificates c JOIN users u ON u.id = c.student_id ORDER BY c.issued_at DESC LIMIT 5",
    ).all()) as any[]).map((r) => ({ name: r.name, when: relative(Number(r.at)) }));

  const instructors = ((await db.prepare("SELECT id, name FROM users WHERE role = 'instructor' ORDER BY name ASC").all()) as any[]).map((r) => ({ id: r.id, name: r.name }));

  const contentMgmt: AdminContentMgmt = {
    dailyQuestions: (await getDailyQuestionsAdmin()),
    newsItems: (await getAllNewsItems()),
    newsSubmissions: (await getPendingNewsSubmissions()),
    testimonials: (await getAllTestimonials()),
    glossary: (await getGlossaryTerms()),
  };

  return {
    overview,
    cohorts,
    users,
    content,
    contentMgmt,
    health: { recentStudents, recentModules, recentCertificates },
    instructors,
    partners: { orgs: (await getAllPartnerOrgs()), demoRequests: (await getDemoRequests()) },
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
