/* ============================================================
 * Account / LMS data layer.
 *
 * The arrays below are the SEED for the real backend: on first
 * boot `lib/db.ts` loads them into a SQLite database, which then
 * becomes the system of record. The screens keep importing the
 * types and seed structure from here, while live status, auth, and
 * new records flow through the database (see lib/db.ts, lib/dal.ts,
 * and the server actions in app/actions/). Curriculum is NOT
 * duplicated — cohorts reference lesson ids from lib/lessons.
 * ============================================================ */

import { lessons, getLessonById, type Lesson } from "@/lib/lessons";

export type Role = "student" | "instructor" | "admin";
export type UserStatus = "active" | "invited" | "suspended";

export interface User {
  id: string;
  name: string;
  first: string;
  email: string;
  role: Role;
  orgId: string;
  grade?: string;
  status: UserStatus;
  last: string;
  signin: string;
  /** Real epoch-ms timestamp of the user's last authenticated activity (null = never signed in). */
  lastActiveAt?: number | null;
}

export interface Organization {
  id: string;
  name: string;
  type: "School" | "Camp" | "Youth Organization" | "BOW";
  location: string;
  status: string;
}

export interface Cohort {
  id: string;
  name: string;
  orgId: string;
  track: string;
  instructorId: string | null;
  currentLessonId: string | null;
  status: "active" | "enrolling" | "completed" | "draft";
  format: string;
  schedule: string;
  start: string;
  end: string;
  cap: number;
  nextSession: string;
}

export type LessonProgress = "in-progress" | "completed" | "not-started" | "none" | "waiting";
export type AttendanceState = "present" | "absent" | "late" | "excused" | "none";

export type EnrollState = "active" | "invited" | "suspended" | "inactive";

export interface Enrollment {
  userId: string;
  cohortId: string;
  enroll: EnrollState;
  lessonStatus: LessonProgress;
  last: string;
  attLast: AttendanceState;
  /**
   * Furthest lesson this student has unlocked on their own via the self-paced
   * path (Proposal 1). `null` falls back to the cohort's current lesson — so a
   * student is never gated behind their own frontier OR the instructor's.
   */
  unlockedLessonId?: string | null;
}

/** Per-student, per-lesson progress detail (source of truth in the DB). */
export interface LessonProgressDetail {
  status: "not-started" | "in-progress" | "completed";
  simulationDone: boolean;
  reflection: string;
  challengeDone: boolean;
  /** Fraction (0–1) of the lesson's podcast episode the student has played. */
  podcastProgress: number;
  startedAt: string | null;
  completedAt: string | null;
}

/* ---------------- Self-paced unlock (Proposal 1) ---------------- */

/** Minimum words a reflection must contain to count toward auto-unlock. */
export const MIN_REFLECTION_WORDS = 75;
/** Fraction of the podcast episode that must be played to count toward auto-unlock. */
export const PODCAST_UNLOCK_THRESHOLD = 0.8;

/** Count whitespace-delimited words in a reflection. */
export const reflectionWordCount = (text: string): number =>
  text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

/** The three self-paced conditions for a lesson's progress detail. */
export interface UnlockChecklist {
  simulationDone: boolean;
  reflectionMet: boolean;
  podcastMet: boolean;
  reflectionWords: number;
  allMet: boolean;
}

export const unlockChecklist = (p: LessonProgressDetail | null): UnlockChecklist => {
  const reflectionWords = reflectionWordCount(p?.reflection ?? "");
  const simulationDone = !!p?.simulationDone;
  const reflectionMet = reflectionWords >= MIN_REFLECTION_WORDS;
  const podcastMet = (p?.podcastProgress ?? 0) >= PODCAST_UNLOCK_THRESHOLD;
  return {
    simulationDone,
    reflectionMet,
    podcastMet,
    reflectionWords,
    allMet: simulationDone && reflectionMet && podcastMet,
  };
};

/** An instructor/admin note attached to a cohort. */
export interface SessionNote {
  id: string;
  cohortId: string;
  authorId: string;
  authorName: string;
  scope: string;
  text: string;
  when: string;
}

export type InvitationStatus = "pending" | "expired" | "accepted" | "revoked";

export interface Invitation {
  id: string;
  email: string;
  role: "student" | "instructor";
  orgId: string;
  cohortId: string | null;
  created: string;
  expires: string;
  status: InvitationStatus;
}

export type InquiryStatus = "new" | "reviewing" | "contacted" | "closed" | "spam";

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  type: string;
  orgName: string;
  date: string;
  status: InquiryStatus;
  summary: string;
}

export interface Activity {
  id: string;
  icon: string;
  text: string;
  when: string;
  role: Role;
}

export const users: User[] = [
  { id: "u-admin", name: "Dana Whitfield", first: "Dana", email: "dana@bowsportscapital.org", role: "admin", orgId: "org-bow", status: "active", last: "12 min ago", signin: "Email + password" },
  { id: "u-coach", name: "Marcus Reyes", first: "Marcus", email: "marcus.reyes@lincolnhs.edu", role: "instructor", orgId: "org-school", status: "active", last: "1 h ago", signin: "Email + password" },
  { id: "u-coach2", name: "Priya Anand", first: "Priya", email: "priya@eastsideyouth.org", role: "instructor", orgId: "org-youth", status: "invited", last: "—", signin: "—" },
  { id: "u-s1", name: "Jalen Brooks", first: "Jalen", email: "jalen.b@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9", status: "active", last: "2 h ago", signin: "Email + password" },
  { id: "u-s2", name: "Maya Chen", first: "Maya", email: "maya.c@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9", status: "active", last: "Yesterday", signin: "Email + password" },
  { id: "u-s3", name: "Diego Santos", first: "Diego", email: "diego.s@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9", status: "active", last: "3 days ago", signin: "Email + password" },
  { id: "u-s4", name: "Aisha Okafor", first: "Aisha", email: "aisha.o@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9", status: "invited", last: "—", signin: "—" },
  { id: "u-s5", name: "Tyler Nguyen", first: "Tyler", email: "tyler.n@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9", status: "active", last: "5 days ago", signin: "Email + password" },
  { id: "u-s6", name: "Sofia Ramirez", first: "Sofia", email: "sofia.r@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9", status: "suspended", last: "2 weeks ago", signin: "Email + password" },
  { id: "u-s7", name: "Liam Park", first: "Liam", email: "liam.p@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9", status: "active", last: "4 h ago", signin: "Email + password" },
  { id: "u-s8", name: "Nia Coleman", first: "Nia", email: "nia.c@lincolnhs.edu", role: "student", orgId: "org-school", grade: "Grades 6–9", status: "invited", last: "—", signin: "—" },
  { id: "u-s9", name: "Andre Wilson", first: "Andre", email: "andre.w@eastsideyouth.org", role: "student", orgId: "org-youth", grade: "Grades 8–10", status: "active", last: "Today", signin: "Email + password" },
  { id: "u-s10", name: "Grace Liu", first: "Grace", email: "grace.l@eastsideyouth.org", role: "student", orgId: "org-youth", grade: "Grades 8–10", status: "active", last: "Yesterday", signin: "Email + password" },
  { id: "u-s11", name: "Marcus Johnson", first: "Marcus", email: "marcus.j@eastsideyouth.org", role: "student", orgId: "org-youth", grade: "Grades 8–10", status: "active", last: "2 days ago", signin: "Email + password" },
  { id: "u-s12", name: "Elena Vasquez", first: "Elena", email: "elena.v@eastsideyouth.org", role: "student", orgId: "org-youth", grade: "Grades 8–10", status: "active", last: "Today", signin: "Email + password" },
];

export const organizations: Organization[] = [
  { id: "org-school", name: "Lincoln High School", type: "School", location: "Columbus, OH", status: "active" },
  { id: "org-camp", name: "Summit Sports Camp", type: "Camp", location: "Asheville, NC", status: "active" },
  { id: "org-youth", name: "Eastside Youth Alliance", type: "Youth Organization", location: "Oakland, CA", status: "active" },
  { id: "org-bow", name: "BOW Sports Capital", type: "BOW", location: "Remote", status: "active" },
];

export const cohorts: Cohort[] = [
  { id: "coh-1", name: "Lincoln Fall — Track 101", orgId: "org-school", track: "101", instructorId: "u-coach", currentLessonId: "t101-m2-l1", status: "active", format: "In person · Classroom", schedule: "Tue & Thu · 3:30–4:30 PM", start: "Sep 9, 2025", end: "Dec 18, 2025", cap: 16, nextSession: "Thu, Jun 19 · 3:30 PM" },
  { id: "coh-2", name: "Eastside — Track 201", orgId: "org-youth", track: "201", instructorId: "u-coach", currentLessonId: "t201-m1-l2", status: "active", format: "Online · Live", schedule: "Wed · 5:00–6:00 PM", start: "Sep 17, 2025", end: "Dec 17, 2025", cap: 12, nextSession: "Wed, Jun 25 · 5:00 PM" },
  { id: "coh-3", name: "Summit Spring — Track 101", orgId: "org-camp", track: "101", instructorId: null, currentLessonId: null, status: "enrolling", format: "In person · Camp block", schedule: "Daily · 10:00–11:30 AM", start: "Jul 7, 2026", end: "Jul 18, 2026", cap: 20, nextSession: "Starts Jul 7" },
  { id: "coh-4", name: "Lincoln Spring — Track 101", orgId: "org-school", track: "101", instructorId: "u-coach", currentLessonId: "t101-m4-l3", status: "completed", format: "In person · Classroom", schedule: "Mon & Wed · 3:30 PM", start: "Jan 13, 2025", end: "May 7, 2025", cap: 16, nextSession: "—" },
  { id: "coh-5", name: "Summit Pilot — Track 101", orgId: "org-camp", track: "101", instructorId: null, currentLessonId: null, status: "draft", format: "—", schedule: "—", start: "—", end: "—", cap: 20, nextSession: "—" },
];

export const enrollments: Enrollment[] = [
  { userId: "u-s1", cohortId: "coh-1", enroll: "active", lessonStatus: "in-progress", last: "2 h ago", attLast: "present" },
  { userId: "u-s2", cohortId: "coh-1", enroll: "active", lessonStatus: "completed", last: "Yesterday", attLast: "present" },
  { userId: "u-s3", cohortId: "coh-1", enroll: "active", lessonStatus: "not-started", last: "3 days ago", attLast: "present" },
  { userId: "u-s4", cohortId: "coh-1", enroll: "invited", lessonStatus: "none", last: "—", attLast: "none" },
  { userId: "u-s5", cohortId: "coh-1", enroll: "active", lessonStatus: "in-progress", last: "5 days ago", attLast: "absent" },
  { userId: "u-s6", cohortId: "coh-1", enroll: "suspended", lessonStatus: "in-progress", last: "2 weeks ago", attLast: "excused" },
  { userId: "u-s7", cohortId: "coh-1", enroll: "active", lessonStatus: "in-progress", last: "4 h ago", attLast: "late" },
  { userId: "u-s8", cohortId: "coh-1", enroll: "invited", lessonStatus: "none", last: "—", attLast: "none" },
  { userId: "u-s9", cohortId: "coh-2", enroll: "active", lessonStatus: "completed", last: "Today", attLast: "present" },
  { userId: "u-s10", cohortId: "coh-2", enroll: "active", lessonStatus: "in-progress", last: "Yesterday", attLast: "present" },
  { userId: "u-s11", cohortId: "coh-2", enroll: "active", lessonStatus: "not-started", last: "2 days ago", attLast: "late" },
  { userId: "u-s12", cohortId: "coh-2", enroll: "active", lessonStatus: "completed", last: "Today", attLast: "present" },
];

export const invitations: Invitation[] = [
  { id: "inv-1", email: "aisha.o@lincolnhs.edu", role: "student", orgId: "org-school", cohortId: "coh-1", created: "Jun 10, 2026", expires: "Jun 24, 2026", status: "pending" },
  { id: "inv-2", email: "nia.c@lincolnhs.edu", role: "student", orgId: "org-school", cohortId: "coh-1", created: "Jun 10, 2026", expires: "Jun 24, 2026", status: "pending" },
  { id: "inv-3", email: "priya@eastsideyouth.org", role: "instructor", orgId: "org-youth", cohortId: "coh-2", created: "Jun 6, 2026", expires: "Jun 20, 2026", status: "pending" },
  { id: "inv-4", email: "coach.diaz@summitcamp.com", role: "instructor", orgId: "org-camp", cohortId: null, created: "May 28, 2026", expires: "Jun 11, 2026", status: "expired" },
  { id: "inv-5", email: "jalen.b@lincolnhs.edu", role: "student", orgId: "org-school", cohortId: "coh-1", created: "Sep 2, 2025", expires: "Sep 16, 2025", status: "accepted" },
  { id: "inv-6", email: "old.address@lincolnhs.edu", role: "student", orgId: "org-school", cohortId: "coh-1", created: "May 30, 2026", expires: "Jun 13, 2026", status: "revoked" },
];

export const inquiries: Inquiry[] = [
  { id: "iq-1", name: "Karen Mills", email: "kmills@westviewschools.org", type: "School", orgName: "Westview School District", date: "Jun 16, 2026", status: "new", summary: "Interested in a semester Track 101 program across two middle schools." },
  { id: "iq-2", name: "Robert Tran", email: "rtran@summitcamp.com", type: "Camp", orgName: "Summit Sports Camp", date: "Jun 14, 2026", status: "reviewing", summary: "Wants a two-week camp workshop block this July for ~20 campers." },
  { id: "iq-3", name: "Denise Howard", email: "denise.howard@gmail.com", type: "Family", orgName: "—", date: "Jun 12, 2026", status: "contacted", summary: "Parent asking when online Track 101 opens for individual students." },
  { id: "iq-4", name: "Coach Bill Pratt", email: "bpratt@eastsideyouth.org", type: "Youth Organization", orgName: "Eastside Youth Alliance", date: "Jun 5, 2026", status: "closed", summary: "Confirmed Track 201 cohort — now active as Eastside cohort." },
  { id: "iq-5", name: "crypto deals", email: "noreply@spam-domain.biz", type: "Other", orgName: "—", date: "Jun 3, 2026", status: "spam", summary: "Unsolicited promotional message." },
];

export const activity: Activity[] = [
  { id: "a1", icon: "advance", text: "Marcus Reyes advanced Lincoln Fall to “You’re the GM”", when: "2 h ago", role: "instructor" },
  { id: "a2", icon: "complete", text: "Maya Chen completed “Opportunity Cost, in Trades”", when: "Yesterday", role: "student" },
  { id: "a3", icon: "join", text: "Andre Wilson joined Eastside — Track 201", when: "2 days ago", role: "student" },
  { id: "a4", icon: "invite", text: "You invited 2 students to Lincoln Fall — Track 101", when: "8 days ago", role: "admin" },
  { id: "a5", icon: "inquiry", text: "New school inquiry from Westview School District", when: "Jun 16", role: "admin" },
];

/* ---------------- lookups ---------------- */
export const getUser = (id: string | null): User | null => users.find((u) => u.id === id) ?? null;
export const getOrg = (id: string | null): Organization | null => organizations.find((o) => o.id === id) ?? null;
export const getCohort = (id: string | null): Cohort | null => cohorts.find((c) => c.id === id) ?? null;
export const trackLessons = (track: string): Lesson[] => lessons.filter((l) => l.track === track);
export const cohortRoster = (cohortId: string): (Enrollment & { user: User })[] =>
  enrollments
    .filter((e) => e.cohortId === cohortId)
    .map((e) => ({ ...e, user: getUser(e.userId) }))
    .filter((e): e is Enrollment & { user: User } => e.user !== null);
export const cohortsForInstructor = (uid: string): Cohort[] => cohorts.filter((c) => c.instructorId === uid);
export const cohortLesson = (c: Cohort): Lesson | null => (c.currentLessonId ? getLessonById(c.currentLessonId) ?? null : null);

/* default signed-in user per role (prototype) */
export const defaultUserForRole = (role: Role): string =>
  role === "admin" ? "u-admin" : role === "instructor" ? "u-coach" : "u-s1";

export const roleHomePath = (role: Role): string =>
  role === "admin" ? "/app/admin" : role === "instructor" ? "/app/instructor" : "/app/student";

export const roleLabel = (role: Role | null): string =>
  role === "admin" ? "BOW Administration" : role === "instructor" ? "Instructor" : role === "student" ? "Student" : "Not signed in";

export const roleAccent = (role: Role | null): string =>
  role === "admin" ? "var(--bow-orange)" : role === "instructor" ? "var(--bow-positive)" : "var(--bow-blue)";

export const initials = (name: string): string =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("");

export const lessonProgressLabel = (s: LessonProgress): string =>
  ({ "in-progress": "In Progress", completed: "Completed", "not-started": "Not Started", none: "No Access", waiting: "Waiting for Session" })[s] ?? "Not Started";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Convert a prototype "last seen" string ("2 h ago", "3 days ago", "—") into an
 * approximate epoch-ms timestamp relative to `now`, so the seed has real
 * timestamps the instructor monitoring view can compute a 7-day flag from.
 * Returns null for users who have never signed in.
 */
export const parseLastSeen = (last: string, now: number = Date.now()): number | null => {
  const s = last.trim().toLowerCase();
  if (!s || s === "—") return null;
  if (s === "today" || s === "just now") return now - 30 * 60 * 1000;
  if (s === "yesterday") return now - DAY_MS;
  const m = s.match(/^(\d+)\s*(min|h|hour|hours|day|days|week|weeks|month|months)\b/);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    if (unit.startsWith("min")) return now - n * 60 * 1000;
    if (unit === "h" || unit.startsWith("hour")) return now - n * 60 * 60 * 1000;
    if (unit.startsWith("day")) return now - n * DAY_MS;
    if (unit.startsWith("week")) return now - n * 7 * DAY_MS;
    if (unit.startsWith("month")) return now - n * 30 * DAY_MS;
  }
  return null;
};

/** Days since a last-active timestamp, or null when never active. */
export const daysSince = (ts: number | null | undefined, now: number = Date.now()): number | null =>
  ts == null ? null : Math.floor((now - ts) / DAY_MS);

/** A student is flagged when they haven't been active for 7+ days (or never). */
export const INACTIVE_FLAG_DAYS = 7;
export const isInactive = (ts: number | null | undefined, now: number = Date.now()): boolean => {
  const d = daysSince(ts, now);
  return d === null || d >= INACTIVE_FLAG_DAYS;
};

/* ============================================================
 * BOW Daily Feed (Proposal 3) — standalone, no cohort required.
 * ============================================================ */

/** A single Daily Feed story card. */
export interface FeedStory {
  id: string;
  /** Display order in the feed. */
  ordinal: number;
  /** Sport-business headline. */
  headline: string;
  /** Two-sentence paragraph framing the event against a BOW concept. */
  framing: string;
  /** Decision prompt, always in the "You're the GM — what do you do?" voice. */
  prompt: string;
  /** The BOW concept the story illustrates. */
  concept: string;
  /** What actually happened in the real world. */
  outcome: string;
  /** One-sentence explanation tying the outcome to the concept. */
  explanation: string;
}

/**
 * Exactly four Daily Feed stories, seeded on first boot (see lib/db.ts).
 * Each maps a real sport-business event to a BOW economics concept.
 */
export const feedStories: FeedStory[] = [
  {
    id: "feed-brown-surplus",
    ordinal: 1,
    headline: "Boston Hands Jaylen Brown the Richest Deal in NBA History",
    framing:
      "In 2023 the Celtics signed Jaylen Brown to a five-year supermax worth roughly $304 million — the largest contract the league had ever seen. Surplus value asks a blunt question: is a player producing more on the floor than the salary you're paying him, or are you paying for the name on the jersey?",
    prompt: "You're the GM — do you pay an All-Star the absolute max to keep your core together, or let him test the market and protect your flexibility?",
    concept: "Surplus value",
    outcome:
      "Boston paid him. A year later the Celtics won the 2024 title and Brown was named Finals MVP — the supermax bet returned a championship.",
    explanation:
      "Surplus value isn't only about the price tag; a max salary can still be a bargain when the production it buys wins you a title.",
  },
  {
    id: "feed-athletics-oppcost",
    ordinal: 2,
    headline: "The A's Leave Oakland for a Minor-League Park in Sacramento",
    framing:
      "After more than fifty years in Oakland, the Athletics opened the 2025 season in a Triple-A ballpark in West Sacramento while chasing a future in Las Vegas. Opportunity cost is what you give up to get something else — and every relocation trades one city's loss against another's gain.",
    prompt: "You're the GM — do you abandon a loyal but shrinking market for a temporary home and a bigger long-term payday, or stay and fight for a new stadium where you are?",
    concept: "Opportunity cost",
    outcome:
      "The A's moved. Oakland lost its last major pro franchise, while Sacramento gained an MLB tenant and a national spotlight it had never held.",
    explanation:
      "The real cost of the move wasn't the rent in Sacramento — it was the decades of fan equity Oakland gave up for a shot at Las Vegas.",
  },
  {
    id: "feed-sundayticket-inefficiency",
    ordinal: 3,
    headline: "A Jury Says the NFL's Sunday Ticket Broke Antitrust Law",
    framing:
      "In 2024 a federal jury found the NFL illegally restricted how out-of-market games were sold, bundling them into one pricey Sunday Ticket package. A market inefficiency appears when a seller with enough power charges far above what a competitive market would allow.",
    prompt: "You're the GM — make that the league office: do you keep forcing every game into one expensive package, or let teams and networks sell games separately at competitive prices?",
    concept: "Market inefficiency",
    outcome:
      "The jury sided with consumers and awarded roughly $4.7 billion — but weeks later the judge threw the verdict out, leaving the league's bundle intact for now.",
    explanation:
      "By forcing every out-of-market fan into a single package, the league captured value a competitive market would have handed back to consumers.",
  },
  {
    id: "feed-giannis-luxurytax",
    ordinal: 4,
    headline: "Giannis Signs a Supermax to Stay in Milwaukee",
    framing:
      "Antetokounmpo's extension locked a generational star into a small-market roster at the very top of the pay scale. The luxury tax penalizes teams whose payroll climbs past a league threshold — so keeping a superstar quietly raises the price of everyone around him.",
    prompt: "You're the GM — do you commit supermax money to your franchise player and pay an escalating tax bill, or trade him at peak value to stay under the line?",
    concept: "Luxury tax",
    outcome:
      "Milwaukee paid the man and the tax, operating deep into luxury-tax territory and tighter apron rules to keep its title window open.",
    explanation:
      "Re-signing one star doesn't just cost his salary — the luxury tax multiplies every dollar above the threshold, shrinking the room to build around him.",
  },
];

/** Number of feed decisions a visitor must complete before the Track 101 preview unlocks. */
export const FEED_DECISIONS_TO_UNLOCK = 4;

/** A minimal Daily Feed visitor — no cohort, instructor, or school. */
export interface FeedUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
  decisionsCompleted: number;
  simCompleted: boolean;
  certificateId: string | null;
}

/* ============================================================
 * Backend wiring
 * ============================================================ */

/**
 * Development password assigned to every seeded account that has
 * "active" or "suspended" status. Seeded "invited" users have no
 * password until they accept their invitation. Real deployments
 * should rotate these out — they exist so the prototype's seed
 * accounts can actually sign in. Override with the SEED_PASSWORD env var.
 */
export const SEED_PASSWORD = process.env.SEED_PASSWORD || "bowdemo123";

/** Map of seed user email -> account they can sign in with (active/suspended only). */
export const signInHint = (): { email: string; password: string }[] =>
  users
    .filter((u) => u.status !== "invited")
    .map((u) => ({ email: u.email, password: SEED_PASSWORD }));

/**
 * A full snapshot of the LMS dataset, loaded from the database on
 * the server and handed to the client app shell. This is the shape
 * the screens read from at request time.
 */
export interface AppData {
  users: User[];
  organizations: Organization[];
  cohorts: Cohort[];
  enrollments: Enrollment[];
  invitations: Invitation[];
  inquiries: Inquiry[];
  activity: Activity[];
  attendance: Record<string, Record<string, AttendanceState>>;
  /** progress[userId][lessonId] -> detail */
  progress: Record<string, Record<string, LessonProgressDetail>>;
  notes: SessionNote[];
  /** ids of users who have requested account deletion */
  deletionRequests: string[];
}

/** Build the in-memory seed snapshot (used as the DB seed source). */
export const seedAppData = (): AppData => ({
  users,
  organizations,
  cohorts,
  enrollments,
  invitations,
  inquiries,
  activity,
  attendance: {},
  progress: {},
  notes: [],
  deletionRequests: [],
});

/* ============================================================
 * Self-Paced Track 101 (async student experience).
 *
 * A student who finds BOW through press or social can sign up at
 * /join with just a name, email, and password, get the `student`
 * role, and be placed in the default async cohort below — no
 * instructor code and no live cohort required. Track 101 runs as four
 * modules that unlock in order: module 1 is open on signup, and each
 * next module unlocks once the student marks the prior one complete
 * AND writes a reflection of at least SELF_MIN_REFLECTION_WORDS words.
 * Seeded on first boot (see lib/db.ts); progress is the system of
 * record in the `self_progress` table, read through lib/self-paced.ts.
 * ============================================================ */

/** Org the self-paced cohort belongs to (BOW runs it directly). */
export const SELF_PACED_ORG_ID = "org-bow";
/** The default async cohort every /join signup is placed in. */
export const SELF_PACED_COHORT_ID = "coh-self";
export const SELF_PACED_COHORT_NAME = "BOW Self-Paced";
/** Lessons counted for the instructor attendance rate — one per module. */
export const SELF_PACED_SESSIONS = 4;
/** Minimum words a module reflection needs to unlock the next module. */
export const SELF_MIN_REFLECTION_WORDS = 50;

/** One of the four self-paced Track 101 modules (reference data). */
export interface SelfModule {
  id: string;
  /** Display + unlock order, 1..4. */
  ordinal: number;
  title: string;
  summary: string;
  concept: string;
  centralQuestion: string;
}

/**
 * The four Track 101 modules. Titles match the four Econ Quiz module
 * names so completing a module unlocks that module's quiz questions
 * (Feature 3). Seeded on first boot and the source of truth for the
 * self-paced unlock sequence.
 */
export const selfModules: SelfModule[] = [
  {
    id: "sm-1",
    ordinal: 1,
    title: "What Is Economics?",
    summary: "Scarcity, choices, and the cost of every decision a front office makes.",
    concept: "Scarcity & Opportunity Cost",
    centralQuestion: "Every team wants everything. Which one thing do you fund first?",
  },
  {
    id: "sm-2",
    ordinal: 2,
    title: "How Markets Work",
    summary: "Why prices move, what competition does, and how supply meets demand.",
    concept: "Supply, Demand & Competition",
    centralQuestion: "Why does the same seat cost more some nights than others?",
  },
  {
    id: "sm-3",
    ordinal: 3,
    title: "The Big Picture Economy",
    summary: "GDP, inflation, and the policy levers that move a whole economy.",
    concept: "Growth, Inflation & Policy",
    centralQuestion: "When the whole economy shifts, what happens to the league?",
  },
  {
    id: "sm-4",
    ordinal: 4,
    title: "Applied Economics",
    summary: "Putting it together — real trade-offs in the business of sport and life.",
    concept: "Decisions in the Real World",
    centralQuestion: "One budget, real trade-offs. What do you actually choose?",
  },
];

/** Per-student, per-module progress (source of truth in `self_progress`). */
export interface SelfModuleProgress {
  completed: boolean;
  reflection: string;
  reflectionWords: number;
  instructorUnlocked: boolean;
  completedAt: number | null;
}

/** A module as the student dashboard renders it (derived, serializable). */
export interface SelfModuleView {
  module: SelfModule;
  unlocked: boolean;
  completed: boolean;
  reflection: string;
  reflectionWords: number;
  reflectionMet: boolean;
  instructorUnlocked: boolean;
  /** Plain-English reason the module is still locked, or null when open. */
  lockedReason: string | null;
}

/** An instructor's per-student note (stored in `session_notes`, student-scoped). */
export interface StudentNote {
  id: string;
  studentId: string;
  authorId: string;
  authorName: string;
  note: string;
  createdAt: number;
  createdLabel: string;
}

/** One student row in the instructor roster (fully serializable for the client). */
export interface SelfRosterEntry {
  studentId: string;
  name: string;
  first: string;
  email: string;
  /** Furthest unlocked module (1..6). */
  currentModuleOrdinal: number;
  currentModuleTitle: string;
  completedCount: number;
  totalModules: number;
  reflectionCount: number;
  lastActiveLabel: string;
  lastActiveAt: number | null;
  attendancePresent: number;
  attendanceTotal: number;
  notes: StudentNote[];
  modules: SelfModuleView[];
  /** Present/absent per session, length SELF_PACED_SESSIONS. */
  attendance: boolean[];
}

/** Ordered lessons for a track (module then lesson number). */
export const orderedTrackLessons = (track: string): Lesson[] =>
  [...trackLessons(track)].sort(
    (a, b) => a.moduleNumber - b.moduleNumber || a.lessonNumber - b.lessonNumber,
  );

/** The lesson after `lessonId` in a track, or null if last/unknown. */
export const nextLessonInTrack = (track: string, lessonId: string | null): Lesson | null => {
  const ordered = orderedTrackLessons(track);
  const idx = ordered.findIndex((l) => l.id === lessonId);
  if (idx === -1) return null;
  return ordered[idx + 1] ?? null;
};

/* ============================================================
 * BOW Daily Sports Scenarios (Feature 2).
 *
 * Eight open-ended sports scenarios. One is "active" per week, rotated
 * by week number, and it is always available on the student dashboard
 * regardless of module progress. The explanation is revealed only AFTER
 * the student submits a response; responses persist per student per
 * scenario in `scenario_responses`. Seeded on first boot (see lib/db.ts).
 * ============================================================ */

export interface DailyScenario {
  id: string;
  /** Rotation order, 1..N. */
  ordinal: number;
  /** The economics concept the scenario illustrates. */
  concept: string;
  /** The open-ended prompt shown to the student. */
  scenario: string;
  /** Revealed only after the student submits a response. */
  explanation: string;
}

/** Milliseconds in one week. */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Index (0-based) of the active scenario for the current week. Rotates by
 * week number so a different scenario surfaces each week, looping forever.
 */
export const activeScenarioIndex = (count: number, now: number = Date.now()): number =>
  count <= 0 ? 0 : Math.floor(now / WEEK_MS) % count;

/** The eight BOW Daily scenarios, seeded on first boot. */
export const dailyScenarios: DailyScenario[] = [
  {
    id: "scn-1",
    ordinal: 1,
    concept: "Opportunity Cost",
    scenario:
      "The Lakers have $8M left to spend. They can sign a backup point guard or a backup center — but not both. The point guard helps with passing. The center fills a bigger need. What do you pick and why?",
    explanation:
      "When you pick one thing, you give up another. That thing you gave up is called the opportunity cost. Every GM decision is really just a trade-off — what are you willing to give up?",
  },
  {
    id: "scn-2",
    ordinal: 2,
    concept: "Supply and Demand",
    scenario:
      "Your arena has 20,000 seats. Last year at $120 a ticket you sold every seat. This year you charged $160 and 4,000 seats are empty every night. What went wrong?",
    explanation:
      "When something gets more expensive, fewer people buy it. That's the law of demand. You raised the price past the point where enough fans were willing to pay. The sweet spot where supply and demand meet is called equilibrium.",
  },
  {
    id: "scn-3",
    ordinal: 3,
    concept: "Incentives",
    scenario:
      "Your star player has one year left on his deal and is playing the best basketball of his life. Your other teammate has five years guaranteed and is barely trying. Why?",
    explanation:
      "People respond to incentives — reasons to work hard or not. The player with one year left is playing for his next contract. The player with five guaranteed years doesn't have the same pressure. Good contracts try to keep players motivated the whole way through.",
  },
  {
    id: "scn-4",
    ordinal: 4,
    concept: "Scarcity",
    scenario:
      "There are only 30 GM jobs in the entire NBA. Thousands of people want one. Because of that, teams can be really picky about who they hire. What does this tell you about getting a job in sports?",
    explanation:
      "Scarcity means there isn't enough of something for everyone who wants it. Because GM jobs are so rare, the competition is intense. The people who get them usually spent years proving they could make good decisions under pressure.",
  },
  {
    id: "scn-5",
    ordinal: 5,
    concept: "Monopoly",
    scenario:
      "Your city has one NBA team. The nearest other team is four hours away. Your team charges 40% more for tickets than the average team in the league. Why can they do that?",
    explanation:
      "When there's only one seller of something and buyers have no other option, that's called a monopoly. Your city's team knows you can't just go watch a different local NBA game. So they can charge more. Competition is what keeps prices fair.",
  },
  {
    id: "scn-6",
    ordinal: 6,
    concept: "Inflation",
    scenario:
      "In 2010 the average NBA player made $5M a year. In 2025 the average is $10M. Does that mean players today are twice as good?",
    explanation:
      "Not exactly. Over time, prices for everything go up — that's called inflation. A dollar in 2010 bought more than a dollar today. So some of that salary increase is just inflation, not players getting better. Economists compare salaries across years by adjusting for inflation.",
  },
  {
    id: "scn-7",
    ordinal: 7,
    concept: "Multiplier Effect",
    scenario:
      "A new basketball arena gets built downtown. Thousands of construction workers get hired. On game nights, restaurants nearby are packed, parking lots fill up, and hotels sell out. How does one building affect so many businesses?",
    explanation:
      "This is called the multiplier effect. When money gets spent in one place, it ripples through the whole local economy. The construction worker spends his paycheck at a local restaurant. That restaurant hires more staff. Each dollar spent creates more than one dollar of economic activity.",
  },
  {
    id: "scn-8",
    ordinal: 8,
    concept: "Fiscal Policy",
    scenario:
      "A city offers an NFL team $500 million in taxpayer money to help build a new stadium. Supporters say it'll create jobs and grow the local economy. Critics say that money should go to schools and roads instead. Who's right?",
    explanation:
      "This is one of the most debated questions in sports economics. Governments spending money to boost the economy is called fiscal policy. Most economic studies actually show that stadiums don't generate as much economic benefit as teams claim. But the debate is real — reasonable people disagree.",
  },
];

/** A scenario as the dashboard renders it. Explanation/response present only when answered. */
export interface DailyScenarioView {
  id: string;
  ordinal: number;
  concept: string;
  scenario: string;
  answered: boolean;
  response: string | null;
  /** Revealed only after submission. */
  explanation: string | null;
  submittedAt: number | null;
}

/* ============================================================
 * Econ Quiz Bank (Feature 3).
 *
 * Plain-language economics questions (no sports framing) gated by
 * module: completing a module unlocks that module's questions. A mix of
 * multiple choice (auto-checked) and free response (self-checked against
 * a model answer). Seeded on first boot (see lib/db.ts).
 * ============================================================ */

export type QuizQuestionType = "mc" | "fr";

export interface QuizQuestion {
  id: string;
  /** Which module (1..4) must be completed to unlock this question. */
  moduleUnlock: number;
  type: QuizQuestionType;
  question: string;
  /** MC only — null for free response. */
  choiceA: string | null;
  choiceB: string | null;
  choiceC: string | null;
  choiceD: string | null;
  /** MC only — the correct choice letter ("A".."D"); null for free response. */
  correctAnswer: string | null;
  /** MC: why the answer is right. FR: a strong model answer to self-check against. */
  explanation: string;
}

/** 24 seed questions — six per module (4 multiple choice + 2 free response). */
export const quizQuestions: QuizQuestion[] = [
  /* ---- Module 1 — What Is Economics? ---- */
  {
    id: "q-m1-mc1",
    moduleUnlock: 1,
    type: "mc",
    question:
      "You have $10 and you can buy a pizza slice or a smoothie but not both. You pick the pizza. What is the opportunity cost?",
    choiceA: "The $10 you spent",
    choiceB: "The smoothie you didn't get",
    choiceC: "The store you bought from",
    choiceD: "Nothing, you got what you wanted",
    correctAnswer: "B",
    explanation:
      "Opportunity cost is what you give up when you make a choice. You chose pizza, so the smoothie is what you gave up. Every choice has an opportunity cost.",
  },
  {
    id: "q-m1-mc2",
    moduleUnlock: 1,
    type: "mc",
    question: "There are only 10 front-row concert tickets and 500 people want them. What word describes this situation?",
    choiceA: "Inflation",
    choiceB: "Scarcity",
    choiceC: "Profit",
    choiceD: "Supply",
    correctAnswer: "B",
    explanation:
      "Scarcity means there isn't enough of something for everyone who wants it. Because the tickets are scarce, people will compete for them — by paying more, waiting in line, or entering a lottery.",
  },
  {
    id: "q-m1-mc3",
    moduleUnlock: 1,
    type: "mc",
    question: "When the price of something goes up, most people buy:",
    choiceA: "More of it",
    choiceB: "Less of it",
    choiceC: "The same amount",
    choiceD: "Twice as much",
    correctAnswer: "B",
    explanation:
      "This is the law of demand. Higher prices mean fewer people are willing or able to buy. Think about it — if your school lunch suddenly cost $20, a lot of kids would bring food from home instead.",
  },
  {
    id: "q-m1-mc4",
    moduleUnlock: 1,
    type: "mc",
    question:
      "A lemonade stand sells out every day at $1 a cup. The owner raises the price to $3. Now half the cups are left over at the end of the day. What happened?",
    choiceA: "Supply went down",
    choiceB: "Demand went up",
    choiceC: "The price went above what most customers were willing to pay",
    choiceD: "The lemonade got worse",
    correctAnswer: "C",
    explanation:
      "The price crossed the point where supply meets demand. At $1 everyone was happy to buy. At $3 fewer people thought it was worth it. That crossing point is called the equilibrium price.",
  },
  {
    id: "q-m1-fr1",
    moduleUnlock: 1,
    type: "fr",
    question:
      "Think of a choice you made this week — buying something, spending time on something, or picking one thing over another. What was the opportunity cost of that choice?",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "If I chose to play video games instead of doing homework, the opportunity cost was the homework I didn't finish. Opportunity cost is always about what you gave up, not what you paid for.",
  },
  {
    id: "q-m1-fr2",
    moduleUnlock: 1,
    type: "fr",
    question: "Why can't everyone have everything they want? Use the word scarcity in your answer.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "Not everyone can have everything they want because resources are scarce — there's a limited amount of money, time, materials, and space. Because things are scarce, people have to make choices about what they want most. That's basically what economics is about.",
  },

  /* ---- Module 2 — How Markets Work ---- */
  {
    id: "q-m2-mc1",
    moduleUnlock: 2,
    type: "mc",
    question:
      "A store is the only place in town that sells winter coats. They charge $200 per coat. A second store opens across the street selling the same coat for $150. What will the first store probably do?",
    choiceA: "Raise their prices",
    choiceB: "Close immediately",
    choiceC: "Lower their prices to compete",
    choiceD: "Nothing, people will still pay $200",
    correctAnswer: "C",
    explanation:
      "Competition pushes prices down. When only one store exists they can charge whatever they want. When a second store shows up, they have to compete for customers. That's why competition is good for buyers.",
  },
  {
    id: "q-m2-mc2",
    moduleUnlock: 2,
    type: "mc",
    question: "When supply of something goes up and demand stays the same, the price usually:",
    choiceA: "Goes up",
    choiceB: "Goes down",
    choiceC: "Stays the same",
    choiceD: "Doubles",
    correctAnswer: "B",
    explanation:
      "More supply with the same number of buyers means sellers have to lower prices to move their product. Think about what happens to strawberry prices in summer when farms are producing at full capacity.",
  },
  {
    id: "q-m2-mc3",
    moduleUnlock: 2,
    type: "mc",
    question:
      "A price ceiling is when the government sets a maximum price sellers can charge. If the ceiling is set below the normal market price, what happens?",
    choiceA: "More goods get produced",
    choiceB: "There is a shortage because demand goes up but supply goes down",
    choiceC: "Prices rise further",
    choiceD: "Nothing changes",
    correctAnswer: "B",
    explanation:
      "Price ceilings sound helpful but they cause shortages. When sellers can't charge what the market would normally pay, they produce less. But buyers want more because the price is low. That gap between supply and demand is a shortage.",
  },
  {
    id: "q-m2-mc4",
    moduleUnlock: 2,
    type: "mc",
    question: "Which of these is an example of an incentive?",
    choiceA: "The weather outside",
    choiceB: "Getting a bonus at work for hitting a sales goal",
    choiceC: "The color of your shirt",
    choiceD: "How far away the store is",
    correctAnswer: "B",
    explanation:
      "An incentive is something that motivates you to act a certain way. A bonus for hitting a goal gives you a reason to work harder. Economists study incentives because they explain why people make the choices they do.",
  },
  {
    id: "q-m2-fr1",
    moduleUnlock: 2,
    type: "fr",
    question: "Explain why competition between businesses is usually good for customers. Give a real example.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "Competition is good for customers because it pushes prices down and quality up. If two coffee shops are next to each other, they'll compete on price, taste, and service to win customers. If only one coffee shop exists in town, they can charge whatever they want and customers have no choice. Competition gives sellers a reason to keep improving.",
  },
  {
    id: "q-m2-fr2",
    moduleUnlock: 2,
    type: "fr",
    question: "What is a monopoly and why can it be a problem? Use an example that isn't sports.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "A monopoly is when one company is the only seller of a product or service in a market. It can be a problem because without competition, the company can charge high prices and doesn't have much reason to improve. An example is a cable company that's the only internet provider in a neighborhood — customers have to pay whatever the company charges because there's no alternative.",
  },

  /* ---- Module 3 — The Big Picture Economy ---- */
  {
    id: "q-m3-mc1",
    moduleUnlock: 3,
    type: "mc",
    question: "GDP measures:",
    choiceA: "How much gold a country has",
    choiceB: "The total value of everything a country produces in a year",
    choiceC: "How much the government spends",
    choiceD: "Average income per person",
    correctAnswer: "B",
    explanation:
      "GDP stands for Gross Domestic Product. It adds up the value of all goods and services produced in a country. When GDP grows the economy is getting bigger. When it shrinks we call it a recession.",
  },
  {
    id: "q-m3-mc2",
    moduleUnlock: 3,
    type: "mc",
    question: "Inflation means prices are:",
    choiceA: "Falling",
    choiceB: "Staying the same",
    choiceC: "Rising over time",
    choiceD: "Controlled by consumers",
    correctAnswer: "C",
    explanation:
      "Inflation means your money buys less than it used to. If a candy bar cost $1 last year and $1.10 this year, that's inflation. A little inflation is normal. Too much inflation is a problem because it makes it hard to afford things.",
  },
  {
    id: "q-m3-mc3",
    moduleUnlock: 3,
    type: "mc",
    question:
      "The government decides to build new highways and hire thousands of workers to do it. This is an example of:",
    choiceA: "Monetary policy",
    choiceB: "Fiscal policy",
    choiceC: "Trade policy",
    choiceD: "Inflation",
    correctAnswer: "B",
    explanation:
      "Fiscal policy is when the government uses spending or taxes to affect the economy. Building highways creates jobs and puts money into the economy. Governments often do this during recessions to get things moving again.",
  },
  {
    id: "q-m3-mc4",
    moduleUnlock: 3,
    type: "mc",
    question: "During a recession, what usually happens to unemployment?",
    choiceA: "It goes down",
    choiceB: "It stays the same",
    choiceC: "It goes up",
    choiceD: "The government fixes it immediately",
    correctAnswer: "C",
    explanation:
      "A recession means the economy is shrinking — businesses are making less money, so they hire fewer people or lay people off. That's why unemployment rises during recessions.",
  },
  {
    id: "q-m3-fr1",
    moduleUnlock: 3,
    type: "fr",
    question: "What is inflation and how does it affect regular people? Give a specific example.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "Inflation is when prices rise over time, which means your money buys less than it used to. For example, if gas cost $3 a gallon last year and costs $4 this year, your family has to spend more money to fill the same tank. Inflation hits hardest for people whose income doesn't rise as fast as prices do.",
  },
  {
    id: "q-m3-fr2",
    moduleUnlock: 3,
    type: "fr",
    question: "Why would a government spend more money during a recession instead of saving money? Does that make sense?",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "It seems backwards but it makes sense economically. During a recession, people and businesses are spending less. If the government also cuts spending, the economy can spiral downward. By spending more — on roads, schools, or aid programs — the government puts money into people's hands, which they spend at businesses, which hire more workers. This is called a stimulus. The tradeoff is the government goes into debt to do it, which has its own costs.",
  },

  /* ---- Module 4 — Applied Economics ---- */
  {
    id: "q-m4-mc1",
    moduleUnlock: 4,
    type: "mc",
    question:
      "Your school cafeteria raises lunch prices from $3 to $5. A lot of students start bringing lunch from home. This is an example of:",
    choiceA: "Inflation",
    choiceB: "Consumers responding to a price change",
    choiceC: "A government policy",
    choiceD: "A monopoly",
    correctAnswer: "B",
    explanation:
      "When prices rise, consumers look for substitutes — alternatives that give them what they need at a lower cost. Bringing lunch from home is the substitute for buying cafeteria food. This is basic demand behavior.",
  },
  {
    id: "q-m4-mc2",
    moduleUnlock: 4,
    type: "mc",
    question:
      "A new phone comes out and everyone wants it. The company only made 500,000 of them but 2 million people want to buy one. What will most likely happen to the price?",
    choiceA: "It will drop",
    choiceB: "It will stay the same",
    choiceC: "It will rise",
    choiceD: "The company will give them away",
    correctAnswer: "C",
    explanation:
      "When demand is much higher than supply, sellers can charge more because buyers are competing with each other. This is why new sneakers or concert tickets sometimes sell for way more than the original price.",
  },
  {
    id: "q-m4-mc3",
    moduleUnlock: 4,
    type: "mc",
    question:
      "Which of these best describes the trade-off a government faces when deciding to spend money on a new stadium?",
    choiceA: "There is no trade-off",
    choiceB: "The trade-off is between the stadium and other things that money could fund",
    choiceC: "The trade-off is only about construction costs",
    choiceD: "There is no opportunity cost because stadiums grow the economy",
    correctAnswer: "B",
    explanation:
      "Every dollar spent on a stadium is a dollar not spent on schools, hospitals, or roads. That's the opportunity cost. Good economic thinking always asks: what else could this money have done?",
  },
  {
    id: "q-m4-mc4",
    moduleUnlock: 4,
    type: "mc",
    question:
      "If the Federal Reserve raises interest rates, borrowing money becomes more expensive. What effect does this most likely have on spending?",
    choiceA: "People spend more",
    choiceB: "People spend less",
    choiceC: "Spending stays the same",
    choiceD: "Only businesses are affected",
    correctAnswer: "B",
    explanation:
      "Higher interest rates mean loans cost more. People and businesses borrow less, which means they spend less. The Federal Reserve raises rates on purpose when inflation is too high — slowing spending helps bring prices back down.",
  },
  {
    id: "q-m4-fr1",
    moduleUnlock: 4,
    type: "fr",
    question:
      "A city is deciding between spending $200 million on a new sports arena or on fixing every public school in the city. Walk through the trade-offs on both sides. What would you choose and why?",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "The arena could bring in jobs, tourism, and tax revenue, and give the city a major venue for events. But most economic research shows arenas don't generate as much value as teams claim. Fixing schools improves education for thousands of kids, which has long-term economic benefits — better-educated workers earn more and contribute more to the economy. I would choose the schools because the long-term return is more reliable and affects more people directly. The opportunity cost of the arena is too high.",
  },
  {
    id: "q-m4-fr2",
    moduleUnlock: 4,
    type: "fr",
    question:
      "Explain the difference between a want and a need, and describe how scarcity forces people to make hard choices between them.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "A need is something you must have to survive or function — food, shelter, clothing. A want is something you'd like to have but don't need — a new phone, sneakers, a vacation. Scarcity means most people can't have everything on both lists. So they have to prioritize. A family with limited income might have to choose between fixing the car (a need) or going on vacation (a want). Scarcity is what forces every individual, business, and government to make trade-offs.",
  },
];

/** A quiz question as the dashboard renders it. Answer keys present only when answered. */
export interface QuizQuestionView {
  id: string;
  type: QuizQuestionType;
  question: string;
  /** Labeled choices for MC (empty for FR). */
  choices: { key: string; text: string }[];
  answered: boolean;
  /** MC answered: the choice the student picked. */
  selectedChoice: string | null;
  /** MC answered: whether it was correct. */
  isCorrect: boolean | null;
  /** FR answered: the student's saved text. */
  responseText: string | null;
  /** Revealed only when answered — the correct MC letter. */
  correctAnswer: string | null;
  /** Revealed only when answered — MC explanation or FR model answer. */
  explanation: string | null;
}

/** One module's quiz section as the dashboard renders it. */
export interface QuizModuleSection {
  moduleOrdinal: number;
  moduleTitle: string;
  /** Module completed → questions unlocked. */
  unlocked: boolean;
  /** Plain-English reason the section is locked, or null when open. */
  lockedReason: string | null;
  /** Empty when locked (locked questions are never sent to the client). */
  questions: QuizQuestionView[];
  mcTotal: number;
  mcAnswered: number;
  mcCorrect: number;
  frTotal: number;
  frSubmitted: number;
}
