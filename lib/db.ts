/* ============================================================
 * Database — Supabase Postgres through its pooled connection URL.
 *
 * The app intentionally keeps the small prepare/get/all/run surface that the
 * original SQLite code used.  The terminal methods are asynchronous because
 * Supabase is a network database.  Server-only.
 * ============================================================ */

import postgres, { type Sql } from "postgres";
import { AsyncLocalStorage } from "node:async_hooks";
import type {
  User,
  Organization,
  Cohort,
  Enrollment,
  Invitation,
  Inquiry,
  Activity,
  LessonProgressDetail,
  SessionNote,
  AppData,
} from "@/lib/account";

export type QueryRow = Record<string, unknown>;
export type RunResult = { changes: number; lastInsertRowid: number | bigint };
type TransactionContext = {
  client: Sql | null;
  ready: Promise<Sql>;
  release: (() => void) | null;
  unlock: (() => void) | null;
  done: boolean;
};
const transactionContext = new AsyncLocalStorage<TransactionContext | undefined>();

function connectionUrl(): string {
  const value = (process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "").trim();
  if (!value) {
    throw new Error(
      "[bow] Missing POSTGRES_URL. Connect Supabase in Vercel, then run `vercel env pull .env.local`.",
    );
  }
  return value;
}

function replaceQuestionMarks(source: string): string {
  let output = "";
  let index = 0;
  let quote: "'" | '"' | "`" | null = null;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      output += char;
      if (char === quote) {
        if (source[i + 1] === quote) output += source[++i];
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      output += char;
    } else if (char === "?") {
      output += `$${++index}`;
    } else {
      output += char;
    }
  }
  return output;
}

/** Translate the small set of SQLite expressions still present in legacy SQL. */
export function toPostgresSql(source: string): string {
  let sql = source.trim().replace(/;\s*$/, "");
  const ignoreConflict = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
  sql = sql
    .replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO")
    .replace(/^BEGIN\s+IMMEDIATE$/i, "BEGIN")
    .replace(/\bunixepoch\('now'\)\s*\*\s*1000\b/gi, "floor(extract(epoch from now()) * 1000)")
    .replace(/\bdatetime\('now'\)\b/gi, "to_char(now() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS')")
    .replace(/date\(([^,()]+)\s*\/\s*1000\s*,\s*'unixepoch'\)/gi, "to_char(to_timestamp($1 / 1000), 'YYYY-MM-DD')")
    .replace(/json_extract\(([A-Za-z0-9_.]+),\s*'\$\.([^']+)'\)/gi, "($1::jsonb ->> '$2')")
    .replace(/\binstr\s*\(/gi, "strpos(")
    .replace(/group_concat\(DISTINCT\s+([A-Za-z0-9_.]+)\)/gi, "string_agg(DISTINCT $1, ',')")
    .replace(/lower\(hex\(randomblob\(16\)\)\)/gi, "replace(gen_random_uuid()::text, '-', '')")
    .replace(/\browid\b/gi, "created_at")
    .replace(/\s+COLLATE\s+NOCASE\b/gi, "")
    .replace(/\bIS\s+NOT\s+\?/gi, "IS DISTINCT FROM ?")
    .replace(/\bIS\s+\?/gi, "IS NOT DISTINCT FROM ?");
  if (ignoreConflict) {
    const returning = sql.match(/\s+RETURNING\s+/i);
    if (returning?.index !== undefined) {
      sql = `${sql.slice(0, returning.index)} ON CONFLICT DO NOTHING${sql.slice(returning.index)}`;
    } else {
      sql += " ON CONFLICT DO NOTHING";
    }
  }
  return replaceQuestionMarks(sql);
}

export class PostgresStatement {
  constructor(private readonly db: PostgresDatabase, private readonly source: string) {}

  private execute(parameters: unknown[]) {
    return this.db.query(toPostgresSql(this.source), parameters);
  }

  async all(...parameters: unknown[]): Promise<QueryRow[]> {
    return [...(await this.execute(parameters))] as QueryRow[];
  }

  async get(...parameters: unknown[]): Promise<QueryRow | undefined> {
    return (await this.execute(parameters))[0] as QueryRow | undefined;
  }

  async run(...parameters: unknown[]): Promise<RunResult> {
    const result = await this.execute(parameters);
    return { changes: result.count ?? 0, lastInsertRowid: 0 };
  }
}

export class PostgresDatabase {
  private queryQueue = Promise.resolve();

  constructor(private readonly client: Sql) {}

  private async acquireQueryLock(): Promise<() => void> {
    const previous = this.queryQueue;
    let unlock!: () => void;
    this.queryQueue = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    await previous;
    return unlock;
  }

  prepare(source: string): PostgresStatement {
    return new PostgresStatement(this, source);
  }

  async query(source: string, parameters: unknown[] = []) {
    const active = transactionContext.getStore();
    if (active && !active.done) {
      const client = active.client ?? (await active.ready);
      return client.unsafe(source, parameters as never[]);
    }

    // Supabase's transaction pooler is most reliable when a single app
    // socket receives one query at a time. Queue here instead of letting the
    // driver accumulate overlapping promises that can strand a response.
    const unlock = await this.acquireQueryLock();
    try {
      return await this.client.unsafe(source, parameters as never[]);
    } finally {
      unlock();
    }
  }

  async exec(source: string): Promise<void> {
    const command = toPostgresSql(source);
    const active = transactionContext.getStore();
    if (/^BEGIN$/i.test(command) && (!active || active.done)) {
      const context: TransactionContext = {
        client: null,
        release: null,
        unlock: null,
        done: false,
        ready: Promise.resolve(null as unknown as Sql),
      };

      // Enter the context synchronously, before the first await. Async-local
      // changes made after awaiting reserve() stay inside this method and are
      // invisible to the action that called `await db.exec("BEGIN")`. That
      // made its later COMMIT miss the reserved client and permanently leaked
      // one pool connection per action.
      transactionContext.enterWith(context);
      context.ready = (async () => {
        try {
          context.unlock = await this.acquireQueryLock();
          const reserved = await this.client.reserve();
          context.client = reserved;
          context.release = () => reserved.release();
          await reserved.unsafe("BEGIN");
          return reserved;
        } catch (error) {
          context.done = true;
          context.release?.();
          context.unlock?.();
          throw error;
        }
      })();

      await context.ready;
      return;
    }
    if (/^(COMMIT|ROLLBACK)$/i.test(command) && active && !active.done) {
      const client = active.client ?? (await active.ready);
      try {
        await client.unsafe(command);
      } finally {
        // Mark the shared context object finished BEFORE releasing: enterWith()
        // inside this frame does not reliably propagate back to the caller's
        // async context, so a caller issuing further queries could otherwise
        // still route to the released connection and hang forever.
        active.done = true;
        active.release?.();
        active.unlock?.();
        transactionContext.enterWith(undefined);
      }
      return;
    }
    await this.query(command);
  }

  get isTransaction(): boolean {
    const active = transactionContext.getStore();
    return Boolean(active && !active.done);
  }

}

const globalForDb = globalThis as unknown as { __bowPostgres?: PostgresDatabase };

export function getDb(): PostgresDatabase {
  if (!globalForDb.__bowPostgres) {
    const client = postgres(connectionUrl(), {
      prepare: false,
      // Supavisor already multiplexes connections. One ordered local socket
      // avoids response stalls when concurrent Server Components initialize
      // several pooler connections at the same time.
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
    });
    globalForDb.__bowPostgres = new PostgresDatabase(client);
  }
  return globalForDb.__bowPostgres;
}

/* ---------------- row -> domain mappers ---------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToUser(r: any): User {
  return {
    id: r.id, name: r.name, first: r.first, email: r.email, role: r.role,
    orgId: r.org_id, grade: r.grade ?? undefined, status: r.status, last: r.last, signin: r.signin,
    lastActiveAt: r.last_active_at ?? null, createdAt: r.created_at ?? null,
    onboardingCompleted: !!r.onboarding_completed, passwordChangeRequired: !!r.password_change_required,
  };
}

export function rowToOrg(r: any): Organization {
  return { id: r.id, name: r.name, type: r.type, location: r.location, status: r.status };
}

export function rowToCohort(r: any): Cohort {
  return {
    id: r.id, name: r.name, orgId: r.org_id, track: r.track, instructorId: r.instructor_id,
    currentLessonId: r.current_lesson_id, status: r.status, format: r.format, schedule: r.schedule,
    start: r.start, end: r.end_date, cap: r.cap, nextSession: r.next_session,
  };
}

export function rowToEnrollment(r: any): Enrollment {
  return {
    userId: r.user_id, cohortId: r.cohort_id, enroll: r.enroll, lessonStatus: r.lesson_status,
    last: r.last, attLast: r.att_last, unlockedLessonId: r.unlocked_lesson_id ?? null,
  };
}

export function rowToInvitation(r: any): Invitation {
  return {
    id: r.id, email: r.email, role: r.role, orgId: r.org_id, cohortId: r.cohort_id,
    created: r.created, expires: r.expires, status: r.status,
    expiresAt: typeof r.expires_at === "number" ? r.expires_at : undefined,
  };
}

export function rowToInquiry(r: any): Inquiry {
  return {
    id: r.id, organizationId: r.organization_id ?? null, name: r.name, email: r.email,
    type: r.type, orgName: r.org_name, date: r.date, status: r.status, summary: r.summary,
  };
}

export function rowToActivity(r: any): Activity {
  return { id: r.id, icon: r.icon, text: r.text, when: r.when_label, role: r.role };
}

export function rowToNote(r: any): SessionNote {
  return {
    id: r.id, cohortId: r.cohort_id, authorId: r.author_id,
    authorName: r.author_name ?? "BOW", scope: r.scope, text: r.text, when: r.created_at,
  };
}

export function rowToPerson(r: any): import("@/lib/hiring").Person {
  return { id: r.id, name: r.name, email: r.email, phone: r.phone ?? "", userId: r.user_id ?? null, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function rowToInstructor(r: any): import("@/lib/hiring").Instructor {
  return {
    id: r.id, personId: r.person_id, stage: r.stage, source: r.source ?? null, ownerUserId: r.owner_user_id ?? null,
    answers: r.answers ?? "{}", interviewAt: r.interview_at ?? null, interviewTimeZone: r.interview_timezone ?? null,
    interviewNotes: r.interview_notes ?? null, founderDecision: r.founder_decision ?? null,
    decidedBy: r.decided_by ?? null, decidedAt: r.decided_at ?? null,
    onboardingStatus: r.onboarding_status, trainingStatus: r.training_status, eligibilityStatus: r.eligibility_status,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToCurriculum(r: any): import("@/lib/hiring").Curriculum {
  return { id: r.id, title: r.title, description: r.description ?? null, ageRange: r.age_range ?? null, published: !!r.published, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function rowToTrainingModule(r: any): import("@/lib/hiring").TrainingModule {
  return {
    id: r.id, title: r.title, category: r.category, required: !!r.required, contentType: r.content_type,
    content: r.content ?? null, ordinal: r.ordinal, active: !!r.active, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToTrainingSession(r: any): import("@/lib/hiring").TrainingSession {
  return {
    id: r.id, title: r.title, scheduledAt: r.scheduled_at, timeZone: r.timezone ?? null,
    location: r.location ?? null, meetingLink: r.meeting_link ?? null,
    facilitatorUserId: r.facilitator_user_id ?? null, required: !!r.required,
    facilitatorNotes: r.facilitator_notes ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToClass(r: any): import("@/lib/hiring").Class {
  return {
    id: r.id, title: r.title, curriculumId: r.curriculum_id, partnerOrgId: r.partner_org_id ?? null, location: r.location ?? null,
    onlineFormat: r.online_format ?? null, startDate: r.start_date ?? null, endDate: r.end_date ?? null, recurrence: r.recurrence ?? null,
    scheduleDay: typeof r.schedule_day === "number" ? r.schedule_day : null,
    scheduleStartTime: r.schedule_start_time ?? null, scheduleEndTime: r.schedule_end_time ?? null,
    scheduleTimezone: r.schedule_timezone ?? null, ageRange: r.age_range ?? null, capacity: r.capacity ?? null,
    minimumEnrollment: Number(r.minimum_enrollment) || 1, leadInstructorId: r.lead_instructor_id ?? null,
    programId: r.program_id ?? null, locationId: r.location_id ?? null, status: r.status,
    internalNotes: r.internal_notes ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToStudent(r: any): import("@/lib/hiring").Student {
  return {
    id: r.id, name: r.name, age: r.age ?? null, grade: r.grade ?? null, email: r.email ?? null,
    guardianPersonId: r.guardian_person_id ?? null, emergencyNotes: r.emergency_notes ?? null,
    enrollmentStatus: r.enrollment_status, formStatus: r.form_status, communicationNotes: r.communication_notes ?? null,
    userId: r.user_id ?? null, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function rowToTask(r: any): import("@/lib/hiring").Task {
  return {
    id: r.id, title: r.title, kind: r.kind ?? "task", ownerUserId: r.owner_user_id ?? null,
    dueAt: r.due_at ?? null, dueOn: r.due_on ?? null, status: r.status, entityType: r.entity_type ?? null,
    entityId: r.entity_id ?? null, handoffToFounder: !!r.handoff_to_founder,
    completedAt: r.completed_at ?? null, completionNote: r.completion_note ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Read the full LMS dataset from Supabase as a typed snapshot. */
export async function readAppData(): Promise<AppData> {
  const db = getDb();
  // These tables are small. Reading them in order prevents the app shell from
  // opening eleven queries while a route starts its own work, which can flood
  // the five-connection Supabase pool during the post-sign-in render.
  const attendanceRows = await db.prepare("SELECT * FROM attendance").all();
  const progressRows = await db.prepare("SELECT * FROM lesson_progress").all();
  const cohortRows = await db.prepare("SELECT * FROM cohorts").all();
  const enrollmentRows = await db.prepare("SELECT * FROM enrollments").all();
  const noteRows = await db.prepare(
    "SELECT n.*, u.name AS author_name FROM session_notes n LEFT JOIN users u ON u.id = n.author_id ORDER BY n.created_ts DESC",
  ).all();
  const deletionRows = await db.prepare("SELECT id FROM users WHERE deletion_requested = 1").all();
  const users = await db.prepare("SELECT * FROM users").all();
  const organizations = await db.prepare("SELECT * FROM organizations").all();
  const invitations = await db.prepare("SELECT * FROM invitations ORDER BY created DESC").all();
  const inquiries = await db.prepare("SELECT * FROM inquiries").all();
  const activity = await db.prepare("SELECT * FROM activity").all();
  const attendance: Record<string, Record<string, string>> = {};
  for (const a of attendanceRows as any[]) (attendance[a.cohort_id] ??= {})[a.user_id] = a.state;
  const progress: Record<string, Record<string, LessonProgressDetail>> = {};
  for (const p of progressRows as any[]) {
    (progress[p.user_id] ??= {})[p.lesson_id] = {
      status: p.status, simulationDone: !!p.simulation_done, reflection: p.reflection ?? "",
      challengeDone: !!p.challenge_done, podcastProgress: typeof p.podcast_progress === "number" ? p.podcast_progress : 0,
      startedAt: p.started_at ?? null, completedAt: p.completed_at ?? null,
    };
  }
  const cohorts = (cohortRows as any[]).map(rowToCohort);
  const cohortCurrent = Object.fromEntries(cohorts.map((cohort) => [cohort.id, cohort.currentLessonId]));
  const enrollments = (enrollmentRows as any[]).map((row) => {
    const enrollment = rowToEnrollment(row);
    if (enrollment.enroll === "invited" || enrollment.enroll === "inactive") enrollment.lessonStatus = "none";
    else enrollment.lessonStatus = progress[enrollment.userId]?.[cohortCurrent[enrollment.cohortId] ?? ""]?.status ?? "not-started";
    return enrollment;
  });
  return {
    users: (users as any[]).map(rowToUser), organizations: (organizations as any[]).map(rowToOrg), cohorts, enrollments,
    invitations: (invitations as any[]).map(rowToInvitation), inquiries: (inquiries as any[]).map(rowToInquiry),
    activity: (activity as any[]).map(rowToActivity), attendance: attendance as AppData["attendance"], progress,
    notes: (noteRows as any[]).map(rowToNote), deletionRequests: (deletionRows as any[]).map((row) => row.id as string),
  };
}
