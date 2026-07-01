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
  /** Epoch-ms timestamp the account was created (null for older seed accounts). */
  createdAt?: number | null;
  /** True once the student finished the first-time onboarding flow (Feature 7). */
  onboardingCompleted?: boolean;
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
export const trackLessons = (track: string): Lesson[] =>
  lessons
    .filter((l) => l.track === track)
    .sort((a, b) => a.moduleNumber - b.moduleNumber || a.lessonNumber - b.lessonNumber);
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

/**
 * The full AppData snapshot is loaded once server-side and handed to the
 * client app shell as a prop — which means every field is serialized into
 * the page's RSC payload and reaches the browser, not just what a
 * particular role's screens happen to render. Route-level role guards stop
 * the WRONG ROLE'S PAGES from rendering, but they don't stop this payload
 * from shipping to every signed-in user on every /app/* request. Scope it
 * here, before it ever reaches AppStateProvider, so a student's browser
 * never receives other students' PII, other cohorts' rosters, instructor
 * session notes, or admin-only invitations/inquiries — and an instructor
 * only receives the cohorts they actually teach.
 */
export function scopeAppDataForUser(data: AppData, me: User): AppData {
  if (me.role === "admin") return data;

  if (me.role === "instructor") {
    const cohorts = data.cohorts.filter((c) => c.instructorId === me.id);
    const cohortIds = new Set(cohorts.map((c) => c.id));
    const enrollments = data.enrollments.filter((e) => cohortIds.has(e.cohortId));
    const userIds = new Set<string>([me.id, ...enrollments.map((e) => e.userId)]);
    const users = data.users.filter((u) => userIds.has(u.id));
    const orgIds = new Set([me.orgId, ...cohorts.map((c) => c.orgId)]);
    const organizations = data.organizations.filter((o) => orgIds.has(o.id));
    const notes = data.notes.filter((n) => cohortIds.has(n.cohortId));
    const attendance: AppData["attendance"] = {};
    for (const cId of cohortIds) if (data.attendance[cId]) attendance[cId] = data.attendance[cId];
    const progress: AppData["progress"] = {};
    for (const uid of userIds) if (data.progress[uid]) progress[uid] = data.progress[uid];

    return {
      users,
      organizations,
      cohorts,
      enrollments,
      invitations: [],
      inquiries: [],
      activity: [],
      attendance,
      progress,
      notes,
      deletionRequests: data.deletionRequests.filter((id) => id === me.id),
    };
  }

  // student — only currently-active enrollments, so a student removed or
  // transferred out of a cohort (enroll set to 'inactive') stops receiving
  // that former cohort's org and instructor identity on their next load.
  const enrollments = data.enrollments.filter((e) => e.userId === me.id && e.enroll !== "inactive");
  const cohortIds = new Set(enrollments.map((e) => e.cohortId));
  const cohorts = data.cohorts.filter((c) => cohortIds.has(c.id));
  const orgIds = new Set([me.orgId, ...cohorts.map((c) => c.orgId)]);
  const organizations = data.organizations.filter((o) => orgIds.has(o.id));
  const instructorIds = new Set(cohorts.map((c) => c.instructorId).filter((id): id is string => !!id));
  const users = data.users.filter((u) => u.id === me.id || instructorIds.has(u.id));
  const attendance: AppData["attendance"] = {};
  for (const cId of cohortIds) {
    const row = data.attendance[cId]?.[me.id];
    if (row) attendance[cId] = { [me.id]: row };
  }

  return {
    users,
    organizations,
    cohorts,
    enrollments,
    invitations: [],
    inquiries: [],
    activity: [],
    attendance,
    progress: data.progress[me.id] ? { [me.id]: data.progress[me.id] } : {},
    notes: [],
    deletionRequests: data.deletionRequests.filter((id) => id === me.id),
  };
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

/** The self-paced track keys. Track 201 unlocks after the Track 101 certificate. */
export const TRACK_101 = "101";
export const TRACK_201 = "201";
export type TrackKey = "101" | "201";

/** One self-paced module (reference data). Modules belong to a track. */
export interface SelfModule {
  id: string;
  /** Display + unlock order WITHIN the track, 1..4. */
  ordinal: number;
  title: string;
  summary: string;
  concept: string;
  centralQuestion: string;
  /** Which track this module belongs to ("101" or "201"). */
  track: string;
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
    track: TRACK_101,
    title: "What Is Economics?",
    summary: "Scarcity, choices, and the cost of every decision a front office makes.",
    concept: "Scarcity & Opportunity Cost",
    centralQuestion: "Every team wants everything. Which one thing do you fund first?",
  },
  {
    id: "sm-2",
    ordinal: 2,
    track: TRACK_101,
    title: "How Markets Work",
    summary: "Why prices move, what competition does, and how supply meets demand.",
    concept: "Supply, Demand & Competition",
    centralQuestion: "Why does the same seat cost more some nights than others?",
  },
  {
    id: "sm-3",
    ordinal: 3,
    track: TRACK_101,
    title: "The Big Picture Economy",
    summary: "GDP, inflation, and the policy levers that move a whole economy.",
    concept: "Growth, Inflation & Policy",
    centralQuestion: "When the whole economy shifts, what happens to the league?",
  },
  {
    id: "sm-4",
    ordinal: 4,
    track: TRACK_101,
    title: "Applied Economics",
    summary: "Putting it together — real trade-offs in the business of sport and life.",
    concept: "Decisions in the Real World",
    centralQuestion: "One budget, real trade-offs. What do you actually choose?",
  },
  /* ---- Track 201 — Front Office Fundamentals (Feature 1) ---- */
  {
    id: "sm-201-1",
    ordinal: 1,
    track: TRACK_201,
    title: "The Salary Cap Machine",
    summary: "How the cap is set, Bird Rights, the MLE and BAE, hard-cap triggers, and why contracts are built the way they are.",
    concept: "Cap Mechanics & Exceptions",
    centralQuestion: "If you're already over the cap, how do you still add the player you need?",
  },
  {
    id: "sm-201-2",
    ordinal: 2,
    track: TRACK_201,
    title: "Revenue, Rights, and Power",
    summary: "Media rights, gate revenue, sponsorship, revenue sharing, and the economics of market size.",
    concept: "League Revenue & Market Size",
    centralQuestion: "Why is the national TV deal the most important event in sports?",
  },
  {
    id: "sm-201-3",
    ordinal: 3,
    track: TRACK_201,
    title: "The Analytics Edge",
    summary: "Finding undervalued players, WAR, box score vs. advanced stats, and why market inefficiencies close.",
    concept: "Analytics & Market Inefficiency",
    centralQuestion: "How do you find $10M of value in a $5M player — before everyone else does?",
  },
  {
    id: "sm-201-4",
    ordinal: 4,
    track: TRACK_201,
    title: "Draft Economics and Roster Windows",
    summary: "Rookie-deal surplus value, the draft as the cheapest path to winning, roster windows, and pick-value decay.",
    concept: "Surplus Value & Roster Windows",
    centralQuestion: "When do you push every chip in — and when do you trade the star?",
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
// trackLessons() already returns lessons in module/lesson order.
export const orderedTrackLessons = trackLessons;

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
  /** 1 = straightforward, 2 = applied, 3 = multi-step reasoning. */
  difficulty: number;
}

/** Milliseconds in one week. */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Index (0-based) of the active scenario for the current week. Rotates by
 * week number so a different scenario surfaces each week, looping forever.
 */
export const activeScenarioIndex = (count: number, now: number = Date.now()): number =>
  count <= 0 ? 0 : Math.floor(now / WEEK_MS) % count;

/** The twenty BOW Daily scenarios, seeded on first boot. */
export const dailyScenarios: DailyScenario[] = [
  {
    id: "scn-1",
    ordinal: 1,
    difficulty: 1,
    concept: "Opportunity Cost",
    scenario:
      "The Lakers have $8M left to spend. They can sign a backup point guard or a backup center — but not both. The point guard helps with passing. The center fills a bigger need. What do you pick and why?",
    explanation:
      "When you pick one thing, you give up another. That thing you gave up is called the opportunity cost. Every GM decision is really just a trade-off — what are you willing to give up?",
  },
  {
    id: "scn-2",
    ordinal: 2,
    difficulty: 2,
    concept: "Supply and Demand",
    scenario:
      "Your arena has 20,000 seats. Last year at $120 a ticket you sold every seat. This year you charged $160 and 4,000 seats are empty every night. What went wrong?",
    explanation:
      "When something gets more expensive, fewer people buy it. That's the law of demand. You raised the price past the point where enough fans were willing to pay. The sweet spot where supply and demand meet is called equilibrium.",
  },
  {
    id: "scn-3",
    ordinal: 3,
    difficulty: 2,
    concept: "Incentives",
    scenario:
      "Your star player has one year left on his deal and is playing the best basketball of his life. Your other teammate has five years guaranteed and is barely trying. Why?",
    explanation:
      "People respond to incentives — reasons to work hard or not. The player with one year left is playing for his next contract. The player with five guaranteed years doesn't have the same pressure. Good contracts try to keep players motivated the whole way through.",
  },
  {
    id: "scn-4",
    ordinal: 4,
    difficulty: 1,
    concept: "Scarcity",
    scenario:
      "There are only 30 GM jobs in the entire NBA. Thousands of people want one. Because of that, teams can be really picky about who they hire. What does this tell you about getting a job in sports?",
    explanation:
      "Scarcity means there isn't enough of something for everyone who wants it. Because GM jobs are so rare, the competition is intense. The people who get them usually spent years proving they could make good decisions under pressure.",
  },
  {
    id: "scn-5",
    ordinal: 5,
    difficulty: 2,
    concept: "Monopoly",
    scenario:
      "Your city has one NBA team. The nearest other team is four hours away. Your team charges 40% more for tickets than the average team in the league. Why can they do that?",
    explanation:
      "When there's only one seller of something and buyers have no other option, that's called a monopoly. Your city's team knows you can't just go watch a different local NBA game. So they can charge more. Competition is what keeps prices fair.",
  },
  {
    id: "scn-6",
    ordinal: 6,
    difficulty: 2,
    concept: "Inflation",
    scenario:
      "In 2010 the average NBA player made $5M a year. In 2025 the average is $10M. Does that mean players today are twice as good?",
    explanation:
      "Not exactly. Over time, prices for everything go up — that's called inflation. A dollar in 2010 bought more than a dollar today. So some of that salary increase is just inflation, not players getting better. Economists compare salaries across years by adjusting for inflation.",
  },
  {
    id: "scn-7",
    ordinal: 7,
    difficulty: 3,
    concept: "Multiplier Effect",
    scenario:
      "A new basketball arena gets built downtown. Thousands of construction workers get hired. On game nights, restaurants nearby are packed, parking lots fill up, and hotels sell out. How does one building affect so many businesses?",
    explanation:
      "This is called the multiplier effect. When money gets spent in one place, it ripples through the whole local economy. The construction worker spends his paycheck at a local restaurant. That restaurant hires more staff. Each dollar spent creates more than one dollar of economic activity.",
  },
  {
    id: "scn-8",
    ordinal: 8,
    difficulty: 3,
    concept: "Fiscal Policy",
    scenario:
      "A city offers an NFL team $500 million in taxpayer money to help build a new stadium. Supporters say it'll create jobs and grow the local economy. Critics say that money should go to schools and roads instead. Who's right?",
    explanation:
      "This is one of the most debated questions in sports economics. Governments spending money to boost the economy is called fiscal policy. Most economic studies actually show that stadiums don't generate as much economic benefit as teams claim. But the debate is real — reasonable people disagree.",
  },
  {
    id: "scn-9",
    ordinal: 9,
    difficulty: 2,
    concept: "Price Elasticity",
    scenario:
      "A team sells hot dogs for $5 and sells 1,000 a game. They raise the price to $6 and now sell only 500. But when they raised parking from $20 to $24, almost nobody stopped paying. Why did fans quit hot dogs but keep paying for parking?",
    explanation:
      "This is price elasticity — how much people change what they buy when the price changes. Hot dogs are \"elastic\": fans can eat before the game or skip the snack, so a higher price scares a lot of them off. Parking is \"inelastic\": fans need somewhere to put the car, so they pay even when it costs more.",
  },
  {
    id: "scn-10",
    ordinal: 10,
    difficulty: 3,
    concept: "Comparative Advantage",
    scenario:
      "Your star is the best passer AND the best scorer on the team — but he can't do both on the same play. Your new teammate is a good passer and a weak scorer. Who should bring the ball up the court, and who should finish the shot?",
    explanation:
      "This is comparative advantage — letting each person do the job they give up the least by doing. Your star should score, because that's where he is far better than anyone else. Let the teammate handle the passing. Even when one person is better at everything, the team wins more by splitting up the work.",
  },
  {
    id: "scn-11",
    ordinal: 11,
    difficulty: 2,
    concept: "Externalities",
    scenario:
      "A team builds a new stadium downtown. Nearby restaurants get packed on game nights and make more money, even though they never paid for the stadium. But neighbors deal with loud crowds and traffic they never asked for. What do these two effects have in common?",
    explanation:
      "Both are externalities — side effects of a choice that land on people who weren't part of it. The busy restaurants are a positive externality (a good side effect). The traffic and noise are a negative externality (a bad side effect). Smart cities try to grow the good side effects and shrink the bad ones.",
  },
  {
    id: "scn-12",
    ordinal: 12,
    difficulty: 2,
    concept: "Public Goods",
    scenario:
      "A city wants free fireworks after every home game. Anyone in the city can watch from their yard, and one person watching doesn't stop anyone else from watching. Why would a private company almost never pay for this on its own?",
    explanation:
      "Fireworks like this are a public good — something everyone can use and no one can be blocked from. A company can't sell tickets to a sky that everyone sees for free, so it can't make money on it. That's why governments, not businesses, usually pay for public goods like parks, streetlights, and clean air.",
  },
  {
    id: "scn-13",
    ordinal: 13,
    difficulty: 3,
    concept: "Market Failure",
    scenario:
      "Only one company sells tickets to every game in your city, and it adds big hidden fees at checkout. Fans are angry but have nowhere else to buy. The free market is supposed to punish bad sellers — so why isn't it working here?",
    explanation:
      "This is a market failure — when a market doesn't reach a fair result on its own. Normally competition would punish the company, but here there's no competition, so fans are stuck. When markets fail like this, governments sometimes step in with rules to protect buyers.",
  },
  {
    id: "scn-14",
    ordinal: 14,
    difficulty: 3,
    concept: "The Federal Reserve",
    scenario:
      "Prices everywhere are rising fast — tickets, food, even player salaries. The country's central bank, called the Federal Reserve, decides to make borrowing money more expensive for everyone. Why would it slow the economy down on purpose?",
    explanation:
      "The Federal Reserve, or \"the Fed,\" is the bank that manages the country's money. When prices rise too fast (that's inflation), the Fed raises interest rates so loans cost more. People and businesses then borrow and spend less, which cools prices down. It's like tapping the brakes on a car going too fast.",
  },
  {
    id: "scn-15",
    ordinal: 15,
    difficulty: 2,
    concept: "Budget Deficit",
    scenario:
      "A team brings in $200 million a year but spends $230 million on players, staff, and travel. To cover the gap, the owner borrows money every season. What is the team running, and why can't it keep this up forever?",
    explanation:
      "The team is running a budget deficit — spending more than it brings in. To cover a deficit you borrow, and borrowing builds up debt that must be paid back with interest. A little debt can be fine, but spending more than you earn year after year eventually catches up with you.",
  },
  {
    id: "scn-16",
    ordinal: 16,
    difficulty: 2,
    concept: "Trade Deficit",
    scenario:
      "Your team buys star players from clubs in other countries every year, but those clubs almost never buy players from you. More talent flows in than flows out. People call this a \"trade deficit.\" Is that automatically a bad thing?",
    explanation:
      "A trade deficit means you buy more from others than they buy from you. It sounds bad, but it isn't always — you might be getting exactly the talent you need to win. What matters is whether the trades leave you better off, not just which direction more players move.",
  },
  {
    id: "scn-17",
    ordinal: 17,
    difficulty: 3,
    concept: "Unemployment Types",
    scenario:
      "Three coaches are out of work. One just quit and is picking his next job. One coached a sport the league cancelled, so his skills aren't needed anymore. One lost his job because the whole league is losing money this year. Are they all unemployed for the same reason?",
    explanation:
      "No — economists name three kinds. The coach choosing his next job is \"frictional\" (between jobs for a short time). The coach whose sport ended is \"structural\" (his skills no longer match the jobs that exist). The coach hurt by a league-wide slump is \"cyclical\" (jobless because the economy is down). Each kind needs a different fix.",
  },
  {
    id: "scn-18",
    ordinal: 18,
    difficulty: 1,
    concept: "Cost-Benefit Analysis",
    scenario:
      "You can spend $3 million on a fancy new scoreboard. You figure it brings in about $1 million in extra ticket and ad sales. A coach you trust says, \"List what it costs and what you get, then compare.\" What is she telling you to do?",
    explanation:
      "She's describing cost-benefit analysis — listing the costs and the benefits of a choice, then comparing them. Here the cost ($3 million) is bigger than the benefit ($1 million), so the scoreboard isn't worth it yet. This simple compare-the-two step stops you from making expensive mistakes.",
  },
  {
    id: "scn-19",
    ordinal: 19,
    difficulty: 2,
    concept: "Economic Growth",
    scenario:
      "Ten years ago your league had 20 teams, small arenas, and tiny TV deals. Today it has 30 teams, packed arenas, and huge TV money. The whole league earns far more than before. What is this called, and what usually drives it?",
    explanation:
      "This is economic growth — the whole \"economy\" (here, the league) producing and earning more over time. Growth usually comes from more people taking part, better technology like streaming, and smarter ways of doing things. When an economy grows, there's more value to go around for everyone in it.",
  },
  {
    id: "scn-20",
    ordinal: 20,
    difficulty: 2,
    concept: "Business Cycle",
    scenario:
      "Your league booms for a few years — sold-out games and rising salaries. Then it slumps: empty seats and pay cuts. A few years later it booms again. This up-and-down pattern keeps repeating. What are you watching happen?",
    explanation:
      "You're watching the business cycle — the natural pattern of an economy speeding up and slowing down over time. The good stretches are called expansions, and the slow stretches are called recessions. Because the cycle repeats, smart teams save money during the booms so they can survive the slumps.",
  },
];

/** A scenario as the dashboard renders it. Explanation/response present only when answered. */
export interface DailyScenarioView {
  id: string;
  ordinal: number;
  concept: string;
  scenario: string;
  difficulty: number;
  answered: boolean;
  response: string | null;
  /** Revealed only after submission. */
  explanation: string | null;
  submittedAt: number | null;
  /** Total students (incl. this one) who have submitted this scenario. */
  totalResponses?: number;
  /** Up to 3 anonymized excerpts (first 60 chars) of other students' responses. */
  othersExcerpts?: string[];
  /** True when the student has not yet submitted (used by the locked archive). */
  locked?: boolean;
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
  /** 1 = recall, 2 = application, 3 = analysis. */
  difficulty: number;
  /** Which track this question belongs to ("101" or "201"). Defaults to "101". */
  track?: string;
}

/** 48 seed questions — twelve per module (8 multiple choice + 4 free response). */
export const quizQuestions: QuizQuestion[] = [
  /* ---- Module 1 — What Is Economics? ---- */
  {
    id: "q-m1-mc1",
    moduleUnlock: 1,
    difficulty: 1,
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
    difficulty: 1,
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
    difficulty: 1,
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
    difficulty: 2,
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
    difficulty: 1,
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
    difficulty: 1,
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
    difficulty: 2,
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
    difficulty: 1,
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
    difficulty: 2,
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
    difficulty: 1,
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
    difficulty: 2,
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
    difficulty: 2,
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
    difficulty: 1,
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
    difficulty: 1,
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
    difficulty: 2,
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
    difficulty: 1,
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
    difficulty: 2,
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
    difficulty: 3,
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
    difficulty: 2,
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
    difficulty: 2,
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
    difficulty: 2,
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
    difficulty: 2,
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
    difficulty: 3,
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
    difficulty: 2,
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

  /* ---- Module 1 — What Is Economics? (added: application & analysis) ---- */
  {
    id: "q-m1-mc5",
    moduleUnlock: 1,
    difficulty: 2,
    type: "mc",
    question:
      "A concert ticket costs $50. To go, you also skip a babysitting job that would have paid you $40. What is the true cost of going to the concert?",
    choiceA: "$50",
    choiceB: "$40",
    choiceC: "$90",
    choiceD: "$10",
    correctAnswer: "C",
    explanation:
      "The real cost is everything you give up: the $50 you spent plus the $40 you could have earned. That's $90. Opportunity cost includes money you spend AND money or time you give up by choosing one thing over another.",
  },
  {
    id: "q-m1-mc6",
    moduleUnlock: 1,
    difficulty: 2,
    type: "mc",
    question:
      "You have one free hour. You decide that one more hour of studying is worth more to you than one more hour of gaming, so you study. Weighing \"one more\" like this is called:",
    choiceA: "Inflation",
    choiceB: "Marginal thinking",
    choiceC: "A monopoly",
    choiceD: "A surplus",
    correctAnswer: "B",
    explanation:
      "Marginal thinking means weighing one more — one more hour, one more dollar, one more cookie — instead of all or nothing. Most good decisions come from asking \"Is one more worth it?\" rather than \"Should I ever do this at all?\"",
  },
  {
    id: "q-m1-mc7",
    moduleUnlock: 1,
    difficulty: 3,
    type: "mc",
    question:
      "A store pays workers a bonus for every sale. Sales go up, but workers start pushing items customers don't need. This shows that incentives:",
    choiceA: "Never change what people do",
    choiceB: "Can change behavior in ways you didn't plan",
    choiceC: "Only matter when money is involved",
    choiceD: "Are against the law",
    correctAnswer: "B",
    explanation:
      "Incentives are powerful, but people respond to exactly what you reward. Reward raw sales and you may get pushy workers. Smart leaders think ahead about every behavior a reward might cause, not just the one they hope for.",
  },
  {
    id: "q-m1-mc8",
    moduleUnlock: 1,
    difficulty: 3,
    type: "mc",
    question:
      "Front-row tickets are scarce, so something has to decide who gets them. Which of these is NOT a real way to deal with scarcity?",
    choiceA: "Raising the price",
    choiceB: "First-come, first-served lines",
    choiceC: "A random lottery",
    choiceD: "Making the tickets unlimited",
    correctAnswer: "D",
    explanation:
      "Scarcity means there isn't enough for everyone, so price, waiting in line, or luck has to decide who gets it. \"Making them unlimited\" isn't an option — if they were unlimited, they wouldn't be scarce in the first place.",
  },
  {
    id: "q-m1-fr3",
    moduleUnlock: 1,
    difficulty: 2,
    type: "fr",
    question:
      "Name something your family treats as scarce — money, time, the car, the TV. Describe one rule your family uses to decide who gets it, and explain whether you think that rule is fair.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "A strong answer names a scarce resource and a real rule for sharing it. For example: \"The TV is scarce on game nights. The rule is whoever asks first picks the show. It's mostly fair because everyone gets a turn, but it's unfair to the youngest kid who doesn't always know to ask early.\" The key idea is that scarcity forces a rule, and every rule has trade-offs.",
  },
  {
    id: "q-m1-fr4",
    moduleUnlock: 1,
    difficulty: 3,
    type: "fr",
    question:
      "A friend says, \"If something is free, it has no cost.\" Use opportunity cost to explain why that isn't really true. Give an example of a \"free\" thing that still costs something.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "Even free things cost you the next-best use of your time or space. A free two-hour movie still costs the two hours you could have spent doing homework, sleeping, or earning money. That lost option is the opportunity cost. So \"free\" usually means free of money, not free of all cost.",
  },

  /* ---- Module 2 — How Markets Work (added: application & analysis) ---- */
  {
    id: "q-m2-mc5",
    moduleUnlock: 2,
    difficulty: 2,
    type: "mc",
    question:
      "A popular toy is priced so low that stores sell out in minutes and long lines form. There isn't nearly enough to go around. Economists call this a:",
    choiceA: "Surplus",
    choiceB: "Shortage",
    choiceC: "Monopoly",
    choiceD: "Profit",
    correctAnswer: "B",
    explanation:
      "A shortage happens when the price is set below the point where supply meets demand — buyers want more than sellers have. Raising the price usually shrinks a shortage, because fewer people buy and sellers are willing to make more.",
  },
  {
    id: "q-m2-mc6",
    moduleUnlock: 2,
    difficulty: 2,
    type: "mc",
    question:
      "A bakery makes 200 cupcakes a day but only sells 120 at its current price, leaving 80 unsold every day. What does it most likely have, and what would fix it?",
    choiceA: "A shortage; raise the price",
    choiceB: "A surplus; lower the price",
    choiceC: "A monopoly; do nothing",
    choiceD: "Inflation; bake even more",
    correctAnswer: "B",
    explanation:
      "Leftovers mean a surplus — the price sits above the point where buyers and sellers meet, so supply is bigger than demand. Lowering the price brings in more buyers and clears the extra cupcakes.",
  },
  {
    id: "q-m2-mc7",
    moduleUnlock: 2,
    difficulty: 3,
    type: "mc",
    question:
      "The price of beef jumps, so many people buy chicken instead. Chicken is a \"substitute\" for beef. What will most likely happen to the price of chicken?",
    choiceA: "It falls",
    choiceB: "It rises, because demand for chicken went up",
    choiceC: "It stays exactly the same",
    choiceD: "Chicken disappears from stores",
    correctAnswer: "B",
    explanation:
      "A substitute is something you buy instead of another thing. When beef gets pricey, demand shifts to chicken. More demand for chicken, with the same supply, usually pushes the price of chicken up too.",
  },
  {
    id: "q-m2-mc8",
    moduleUnlock: 2,
    difficulty: 3,
    type: "mc",
    question:
      "Two gas stations sit right across the street from each other. One quietly raises its price by 30 cents a gallon. What most likely happens?",
    choiceA: "Both stations make more money",
    choiceB: "It loses customers to the cheaper station across the street",
    choiceC: "The other station is forced to raise prices too",
    choiceD: "Nothing — drivers won't notice",
    correctAnswer: "B",
    explanation:
      "When buyers can easily switch, a seller who raises prices loses customers to the competition. That fear of losing business is exactly what keeps prices down in a competitive market.",
  },
  {
    id: "q-m2-fr3",
    moduleUnlock: 2,
    difficulty: 2,
    type: "fr",
    question:
      "Pick a product you buy that has lots of competing brands. Explain how that competition affects the price and quality you get, compared with a product that has only one seller.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "A strong answer shows that competition pushes prices down and quality up. For example: \"There are dozens of sneaker brands, so they fight for me with sales and better designs. But my town has one internet company, so it charges a lot and the service is slow — there's nowhere else to go.\" Competition gives sellers a reason to keep improving; a single seller doesn't have that pressure.",
  },
  {
    id: "q-m2-fr4",
    moduleUnlock: 2,
    difficulty: 3,
    type: "fr",
    question:
      "A city sets a maximum rent far below the normal market price to help renters. Explain one way this could backfire and actually create a shortage of apartments.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "When rent is forced below the market price, more people want apartments (they're cheap) but landlords offer fewer (they earn less and may not build or maintain new ones). That gap between how many people want apartments and how many are available is a shortage. The rule helps the renters who get an apartment but can leave many others with nowhere to rent.",
  },

  /* ---- Module 3 — The Big Picture Economy (added: application & analysis) ---- */
  {
    id: "q-m3-mc5",
    moduleUnlock: 3,
    difficulty: 2,
    type: "mc",
    question:
      "A worker's pay went up 3% this year, but prices went up 5%. Can she actually buy more than before?",
    choiceA: "Yes — her pay went up",
    choiceB: "No — prices rose faster than her pay",
    choiceC: "Prices don't matter, only pay does",
    choiceD: "It's impossible to tell",
    correctAnswer: "B",
    explanation:
      "What matters is how much your money can buy, not just the number on your paycheck. If prices rise faster than pay, you can actually buy less — even though your pay went up. Economists call this losing \"buying power.\"",
  },
  {
    id: "q-m3-mc6",
    moduleUnlock: 3,
    difficulty: 2,
    type: "mc",
    question:
      "The central bank cuts interest rates, making loans cheaper. What is this mainly trying to get people and businesses to do?",
    choiceA: "Save more and spend less",
    choiceB: "Borrow more and spend more",
    choiceC: "Stop working",
    choiceD: "Pay higher taxes",
    correctAnswer: "B",
    explanation:
      "Cheaper loans make borrowing easier, so people buy houses and cars and businesses expand. That extra spending speeds the economy up. Central banks cut rates when they want to give a slow economy a push.",
  },
  {
    id: "q-m3-mc7",
    moduleUnlock: 3,
    difficulty: 3,
    type: "mc",
    question:
      "Congress passes a law to spend $1 billion building bridges to boost the economy. This is an example of:",
    choiceA: "Monetary policy",
    choiceB: "Fiscal policy",
    choiceC: "A trade deficit",
    choiceD: "Inflation",
    correctAnswer: "B",
    explanation:
      "Fiscal policy is the government using its spending and taxes to steer the economy. (Monetary policy is the central bank changing interest rates.) Spending government money on bridges is a classic fiscal-policy move.",
  },
  {
    id: "q-m3-mc8",
    moduleUnlock: 3,
    difficulty: 3,
    type: "mc",
    question:
      "For six months in a row, a country produces fewer goods and services, its GDP shrinks, and businesses cut jobs. What is the country most likely in?",
    choiceA: "A boom",
    choiceB: "A recession",
    choiceC: "A surplus",
    choiceD: "A trade deficit",
    correctAnswer: "B",
    explanation:
      "A recession is a stretch where the economy shrinks instead of grows — GDP falls and unemployment usually rises. It's the \"down\" part of the business cycle, the opposite of an expansion.",
  },
  {
    id: "q-m3-fr3",
    moduleUnlock: 3,
    difficulty: 2,
    type: "fr",
    question:
      "In your own words, explain what GDP measures and why a country might care whether its GDP is growing or shrinking.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "GDP measures the total value of all the goods and services a country produces in a year. A country cares because growing GDP usually means more jobs, more income, and more things being made and sold. Shrinking GDP usually means the opposite — fewer jobs and less money going around — which is why a falling GDP worries leaders.",
  },
  {
    id: "q-m3-fr4",
    moduleUnlock: 3,
    difficulty: 3,
    type: "fr",
    question:
      "Explain the difference between fiscal policy (government spending and taxes) and monetary policy (the central bank changing interest rates). Give one example of each.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "Fiscal policy is run by the government using spending and taxes — for example, building schools or cutting taxes to put money in people's pockets. Monetary policy is run by the central bank using interest rates and the money supply — for example, raising rates to slow down rising prices. Both try to steer the economy, but they use different tools and different people control them.",
  },

  /* ---- Module 4 — Applied Economics (added: application & analysis) ---- */
  {
    id: "q-m4-mc5",
    moduleUnlock: 4,
    difficulty: 3,
    type: "mc",
    question:
      "A bus company raises fares 20%. Most riders have no car and no other way to get to work, so almost all keep riding. The total money the company collects will most likely:",
    choiceA: "Fall a lot",
    choiceB: "Rise, because riders can't easily quit",
    choiceC: "Stay exactly the same",
    choiceD: "Drop to zero",
    correctAnswer: "B",
    explanation:
      "When buyers can't easily switch or quit, demand is \"inelastic\" — they keep buying even at a higher price. So raising the fare brings in more money. This is why prices for hard-to-replace things like gas or medicine can climb so high.",
  },
  {
    id: "q-m4-mc6",
    moduleUnlock: 4,
    difficulty: 3,
    type: "mc",
    question:
      "A factory pollutes a river for free while making its product, harming people downstream. Which government action targets this negative side effect most directly?",
    choiceA: "Giving the factory an award",
    choiceB: "Making the factory pay a fee for the pollution it causes",
    choiceC: "Lowering the factory's taxes",
    choiceD: "Doing nothing at all",
    correctAnswer: "B",
    explanation:
      "Pollution is a negative externality — a cost the factory pushes onto others. Making the factory pay for the harm forces it to count that cost in its decisions, so it pollutes less. Economists call this \"making the polluter pay.\"",
  },
  {
    id: "q-m4-mc7",
    moduleUnlock: 4,
    difficulty: 2,
    type: "mc",
    question:
      "Country A can make both shirts and phones more cheaply than Country B. Should the two countries still trade with each other?",
    choiceA: "No — A should just make everything itself",
    choiceB: "Yes — each should focus on what it gives up the least to make, then trade",
    choiceC: "Only if the two countries are friends",
    choiceD: "No — trade never helps anyone",
    correctAnswer: "B",
    explanation:
      "Even when one country is better at making everything, both gain by each focusing on what it is relatively best at and trading for the rest. That's comparative advantage, and it's why almost every country trades.",
  },
  {
    id: "q-m4-mc8",
    moduleUnlock: 4,
    difficulty: 3,
    type: "mc",
    question:
      "A city wants fewer cars downtown. Which plan uses an incentive to get that result, instead of simply banning cars?",
    choiceA: "Charging a fee to drive downtown during busy hours",
    choiceB: "Just hoping people choose to drive less",
    choiceC: "Building lots more parking",
    choiceD: "Lowering the price of gas",
    correctAnswer: "A",
    explanation:
      "An incentive changes the costs or rewards of a choice so people decide differently on their own. A busy-hour driving fee makes driving downtown more expensive, so more people take the train or carpool — without an outright ban.",
  },
  {
    id: "q-m4-fr3",
    moduleUnlock: 4,
    difficulty: 3,
    type: "fr",
    question:
      "A streaming service raises its price by $3 a month. Some customers quit and some stay. Use the idea of price elasticity to explain who is most likely to quit and who is most likely to stay.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "Customers who have lots of other options — other streaming services, free shows, or who barely watch — have \"elastic\" demand and are most likely to quit over $3. Customers who love this service, share it with family, or have no good substitute have \"inelastic\" demand and are most likely to stay. Elasticity is really about how easy it is to walk away.",
  },
  {
    id: "q-m4-fr4",
    moduleUnlock: 4,
    difficulty: 3,
    type: "fr",
    question:
      "You're the GM of a team with a fixed budget. Walk through how you'd use BOTH cost-benefit analysis and opportunity cost to decide between signing one expensive star or three solid role players.",
    choiceA: null,
    choiceB: null,
    choiceC: null,
    choiceD: null,
    correctAnswer: null,
    explanation:
      "A strong answer lists the costs and benefits of each option (cost-benefit analysis): the star brings star power and ticket sales but eats most of the budget; three role players add depth but no superstar. Then it names the opportunity cost: signing the star means giving up the depth, and signing the role players means giving up the star. The best GM picks the option whose benefits beat its costs by the most, knowing every dollar spent one way can't be spent the other.",
  },

  /* ============================================================
   * Track 201 — Front Office Fundamentals (Feature 1).
   * 48 questions, twelve per module (8 MC + 4 FR), difficulty 2–3.
   * ============================================================ */

  /* ---- Module 201-1 — The Salary Cap Machine ---- */
  {
    id: "q-t201-m1-mc1", moduleUnlock: 1, track: TRACK_201, difficulty: 2, type: "mc",
    question: "The NBA salary cap is based on:",
    choiceA: "How much the richest team earns",
    choiceB: "A percentage of total league revenue split among all teams",
    choiceC: "What the commissioner decides each year",
    choiceD: "Ticket sales from the prior season",
    correctAnswer: "B",
    explanation: "The cap is set as a share of Basketball Related Income — the total money the league makes. When the league signs a bigger TV deal, the cap goes up for every team.",
  },
  {
    id: "q-t201-m1-mc2", moduleUnlock: 1, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Bird Rights let a team:",
    choiceA: "Draft any player they want",
    choiceB: "Sign their own free agent for more money than other teams can offer",
    choiceC: "Trade without using cap space",
    choiceD: "Avoid the luxury tax",
    correctAnswer: "B",
    explanation: "Bird Rights are earned after a player has been with the same team for three years. They let the team go over the cap to re-sign him. This is why superstars usually stay with the team that drafted them.",
  },
  {
    id: "q-t201-m1-mc3", moduleUnlock: 1, track: TRACK_201, difficulty: 2, type: "mc",
    question: "A hard cap means:",
    choiceA: "The team can spend as much as they want",
    choiceB: "The team cannot go above a specific number under any circumstances",
    choiceC: "Only rookies are affected",
    choiceD: "The cap only applies in the playoffs",
    correctAnswer: "B",
    explanation: "Most teams have a soft cap — they can go over it by using exceptions. A hard cap is triggered by certain moves and means the team absolutely cannot exceed the threshold. No exceptions. No workarounds.",
  },
  {
    id: "q-t201-m1-mc4", moduleUnlock: 1, track: TRACK_201, difficulty: 2, type: "mc",
    question: "The Mid-Level Exception lets teams:",
    choiceA: "Sign a player to a max contract",
    choiceB: "Sign a player even if they are already over the salary cap, up to a set dollar amount",
    choiceC: "Trade a player without his consent",
    choiceD: "Cut a player without paying them",
    correctAnswer: "B",
    explanation: "The MLE is one of the most important tools in roster building. It gives over-cap teams a pool of money they can use to add a player. Most role players on contenders are signed using the MLE.",
  },
  {
    id: "q-t201-m1-mc5", moduleUnlock: 1, track: TRACK_201, difficulty: 3, type: "mc",
    question: "If a team is $20M over the luxury tax line, they pay:",
    choiceA: "Nothing",
    choiceB: "Exactly $20M",
    choiceC: "A penalty amount calculated by how far over the line they are, which increases the further over they go",
    choiceD: "A flat $5M fine",
    correctAnswer: "C",
    explanation: "The luxury tax is progressive — the further over the line you go, the higher the rate. The first $5M over costs one rate. The next $5M costs more. Teams deep in the tax pay dollar amounts many times their overage.",
  },
  {
    id: "q-t201-m1-mc6", moduleUnlock: 1, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Rookie contracts are valuable because:",
    choiceA: "Rookies are always the best players",
    choiceB: "Teams control them for four years at below-market salaries",
    choiceC: "Rookies never get injured",
    choiceD: "They count as exceptions",
    correctAnswer: "B",
    explanation: "The NBA sets rookie salaries by draft slot. A first overall pick makes around $12M — far below what a player that good would earn as a free agent. That gap between salary and value is called surplus value.",
  },
  {
    id: "q-t201-m1-mc7", moduleUnlock: 1, track: TRACK_201, difficulty: 2, type: "mc",
    question: "The Bi-Annual Exception can be used:",
    choiceA: "Every year",
    choiceB: "Only every other year",
    choiceC: "Only during the draft",
    choiceD: "Only for international players",
    correctAnswer: "B",
    explanation: "Unlike the Mid-Level Exception which resets annually, the BAE can only be used once every two years. Teams have to decide whether to use it now or save it for a better opportunity next offseason.",
  },
  {
    id: "q-t201-m1-mc8", moduleUnlock: 1, track: TRACK_201, difficulty: 3, type: "mc",
    question: "When a team signs a free agent using an exception that triggers a hard cap, what happens?",
    choiceA: "They get extra cap room",
    choiceB: "They cannot sign any more players for the rest of the year",
    choiceC: "They cannot exceed a specific cap number for the rest of the season, no matter what",
    choiceD: "The player's contract is voided",
    correctAnswer: "C",
    explanation: "Certain signings — like using the full MLE or signing a player via sign-and-trade — trigger a hard cap. From that moment on, the team's total payroll cannot exceed the apron. This limits roster moves for the rest of the year.",
  },
  {
    id: "q-t201-m1-fr1", moduleUnlock: 1, track: TRACK_201, difficulty: 2, type: "fr",
    question: "In your own words, explain what Bird Rights are and why a team would want them.",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "Bird Rights let a team re-sign their own player for more money than other teams are allowed to offer. Teams want them because it means they don't have to let a player they developed walk away just because another team has more cap room. It rewards loyalty and helps teams keep players long-term.",
  },
  {
    id: "q-t201-m1-fr2", moduleUnlock: 1, track: TRACK_201, difficulty: 3, type: "fr",
    question: "Why do you think the NBA uses a soft cap instead of a hard cap for most teams? What are the pros and cons of each?",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "A soft cap lets teams keep their own players using exceptions, which helps competitive teams stay together. A hard cap gives every team a truly equal spending limit. The pros of soft cap: better teams can stay together, fans see continuity. The cons: rich teams can stack rosters by paying the luxury tax. Hard cap pros: more parity. Hard cap cons: teams might lose players they developed to cap constraints.",
  },
  {
    id: "q-t201-m1-fr3", moduleUnlock: 1, track: TRACK_201, difficulty: 3, type: "fr",
    question: "A team has $8M in cap space and wants to sign two free agents. One costs $6M and one costs $5M. They can't afford both with cap space. Name one tool they could use to sign the second player and explain how it works.",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "They could use the Mid-Level Exception, which gives teams a pool of money to sign players even when they're over the cap. It doesn't come from cap space — it's a separate allowance. So the team signs the first player with cap space and uses the MLE to sign the second.",
  },
  {
    id: "q-t201-m1-fr4", moduleUnlock: 1, track: TRACK_201, difficulty: 3, type: "fr",
    question: "Explain what surplus value means in the context of a rookie contract. Why does it matter for building a team?",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "Surplus value is the gap between what a player is worth on the court and what they're actually paid. Rookie contracts create huge surplus value because stars get paid at pre-set slot salaries — far below market rate. Teams that draft well get great production for cheap, which frees up cap space to sign more veterans. That's why the draft is so valuable — you're getting top talent at a discount.",
  },

  /* ---- Module 201-2 — Revenue, Rights, and Power ---- */
  {
    id: "q-t201-m2-mc1", moduleUnlock: 2, track: TRACK_201, difficulty: 2, type: "mc",
    question: "The single biggest source of NBA revenue is:",
    choiceA: "Ticket sales",
    choiceB: "Merchandise",
    choiceC: "National TV and media rights deals",
    choiceD: "Sponsorship patches on jerseys",
    correctAnswer: "C",
    explanation: "The NBA's national TV deal — currently with ESPN and Amazon — is worth billions per year and funds a massive share of every team's budget. When the cap goes up after a new TV deal, it's because that media money is being distributed to teams.",
  },
  {
    id: "q-t201-m2-mc2", moduleUnlock: 2, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Revenue sharing in the NBA means:",
    choiceA: "All teams split ticket revenue evenly",
    choiceB: "Teams in big cities give a portion of their revenue to teams in small cities",
    choiceC: "Players share revenue with owners",
    choiceD: "International teams get a share of US revenue",
    correctAnswer: "B",
    explanation: "Revenue sharing is designed to help small-market teams compete. The Lakers and Knicks generate far more local revenue than the Memphis Grizzlies. Revenue sharing redistributes some of that money so small-market teams can afford competitive rosters.",
  },
  {
    id: "q-t201-m2-mc3", moduleUnlock: 2, track: TRACK_201, difficulty: 2, type: "mc",
    question: "A market with 10 million people versus a market with 1 million people will likely generate more:",
    choiceA: "Draft picks",
    choiceB: "Local media and sponsorship revenue",
    choiceC: "Luxury tax payments",
    choiceD: "International fans",
    correctAnswer: "B",
    explanation: "Local TV deals, sponsorships, and ticket prices all scale with market size. The Lakers in Los Angeles have access to vastly more local revenue than a team in a smaller city. This is why market size is one of the most important structural advantages in sports.",
  },
  {
    id: "q-t201-m2-mc4", moduleUnlock: 2, track: TRACK_201, difficulty: 3, type: "mc",
    question: "When a player signs with a large-market team, they can sometimes earn more money because:",
    choiceA: "Large-market teams always have more cap space",
    choiceB: "They can negotiate bigger endorsement deals off the court",
    choiceC: "The NBA pays them a bonus",
    choiceD: "Small-market teams have salary restrictions",
    correctAnswer: "B",
    explanation: "On-court salary is set by the CBA. But off-court income — Nike deals, commercials, social media partnerships — scales with market size and media exposure. A star in New York or LA gets far more endorsement opportunities than the same player in a smaller market.",
  },
  {
    id: "q-t201-m2-mc5", moduleUnlock: 2, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Gate revenue refers to:",
    choiceA: "Revenue from streaming",
    choiceB: "Money from ticket sales at games",
    choiceC: "Revenue from the front gate of team headquarters",
    choiceD: "International licensing fees",
    correctAnswer: "B",
    explanation: "Gate revenue is what teams earn from selling tickets and suite packages at their arena. It varies hugely by team — teams in expensive cities with sellout crowds earn far more gate revenue than teams with lower attendance or cheaper ticket prices.",
  },
  {
    id: "q-t201-m2-mc6", moduleUnlock: 2, track: TRACK_201, difficulty: 3, type: "mc",
    question: "If a league signs a new TV deal worth 50% more than the old one, what most likely happens to the salary cap?",
    choiceA: "It stays the same",
    choiceB: "It decreases",
    choiceC: "It increases significantly",
    choiceD: "Only playoff teams benefit",
    correctAnswer: "C",
    explanation: "The cap is calculated as a percentage of Basketball Related Income. A bigger TV deal means more BRI, which means a higher cap. This is why front offices track media deal negotiations — a new deal can change team-building strategy for a decade.",
  },
  {
    id: "q-t201-m2-mc7", moduleUnlock: 2, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Naming rights for an arena (like Barclays Center or Chase Center) are a form of:",
    choiceA: "Gate revenue",
    choiceB: "Media revenue",
    choiceC: "Sponsorship revenue",
    choiceD: "Revenue sharing",
    correctAnswer: "C",
    explanation: "Companies pay tens of millions of dollars for the right to put their name on an arena. It's one of the most reliable sponsorship revenue streams teams have. For some teams, the naming rights deal alone covers a significant portion of player salaries.",
  },
  {
    id: "q-t201-m2-mc8", moduleUnlock: 2, track: TRACK_201, difficulty: 3, type: "mc",
    question: "Small-market teams are at a structural disadvantage because:",
    choiceA: "They are not allowed to sign star players",
    choiceB: "They generate less local revenue, making it harder to spend on everything from scouting to facilities",
    choiceC: "The NBA gives large-market teams more cap space",
    choiceD: "Small-market fans don't watch basketball",
    correctAnswer: "B",
    explanation: "The structural disadvantage isn't about rules — it's about economics. Less local TV revenue, lower ticket prices, fewer sponsors. Revenue sharing helps, but it doesn't fully close the gap. Small-market teams compensate by drafting better and developing players more efficiently.",
  },
  {
    id: "q-t201-m2-fr1", moduleUnlock: 2, track: TRACK_201, difficulty: 3, type: "fr",
    question: "Why is the national TV deal the most important financial event in professional sports? Explain using what you know about how the salary cap works.",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "The salary cap is calculated from league revenue. The national TV deal is the biggest single source of league revenue. When a new TV deal is signed, league revenue jumps, which raises the cap for every team. A bigger cap means teams can spend more on players. The 2016 cap spike — when the NBA's TV deal with ESPN/TNT kicked in — added over $20M to the cap overnight and reshaped the entire free agent market.",
  },
  {
    id: "q-t201-m2-fr2", moduleUnlock: 2, track: TRACK_201, difficulty: 3, type: "fr",
    question: "A team in a city of 500,000 people is competing against a team in a city of 8 million people. What economic advantages does the larger-market team have, and what can the small-market team do to compete?",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "The large-market team generates more local TV revenue, commands higher sponsorship deals, sells more merchandise locally, and attracts more endorsement interest for its players. The small-market team can compete by being smarter in the draft, developing players better, using analytics to find undervalued talent, and building a culture that retains players who might otherwise leave for bigger markets. Small-market champions — San Antonio, Oklahoma City — usually succeed through player development and front-office excellence, not spending power.",
  },
  {
    id: "q-t201-m2-fr3", moduleUnlock: 2, track: TRACK_201, difficulty: 3, type: "fr",
    question: "What is revenue sharing and why is it controversial? Make an argument for why it helps the league, then make an argument for why some teams think it's unfair.",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "Revenue sharing redistributes money from high-revenue teams to low-revenue teams. For the league: it keeps small-market teams financially healthy, prevents the league from becoming a two-team show, and maintains fan interest across all 30 cities. Against it: large-market teams argue they earned their revenue through smart management and strong markets — it's not fair to penalize success. Some owners see it as subsidizing poorly-run franchises. Both sides have real points.",
  },
  {
    id: "q-t201-m2-fr4", moduleUnlock: 2, track: TRACK_201, difficulty: 2, type: "fr",
    question: "You are the GM of a small-market team. Your star player is a free agent and wants to sign with a large-market team for the same money you're offering. What non-financial arguments do you make to keep him?",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "I'd argue he's the face of the franchise — in a small market he's the biggest star, not one of several. He'll get more touches, more shots, and more chances to showcase his individual game. I'd point to the team's trajectory, the talent we're building around him, and the culture we've developed. I'd also emphasize that in a small market, he becomes a civic legend — something that's harder to achieve when sharing the spotlight in a massive city.",
  },

  /* ---- Module 201-3 — The Analytics Edge ---- */
  {
    id: "q-t201-m3-mc1", moduleUnlock: 3, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Wins Above Replacement (WAR) measures:",
    choiceA: "How many games a team wins",
    choiceB: "How much better a player is than a freely available replacement-level player, measured in wins",
    choiceC: "How many points a player scores",
    choiceD: "A player's shooting percentage",
    correctAnswer: "B",
    explanation: "WAR answers the question: how many wins does this player add compared to the average player you could find for minimum salary? A player with a WAR of 5 adds 5 wins to their team compared to playing a replacement-level player in their spot.",
  },
  {
    id: "q-t201-m3-mc2", moduleUnlock: 3, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Market inefficiency in sports means:",
    choiceA: "Teams spend too much money",
    choiceB: "Some players are priced below their actual value because the market hasn't recognized their contribution yet",
    choiceC: "Small-market teams can't afford good players",
    choiceD: "Analytics don't work",
    correctAnswer: "B",
    explanation: "When the market doesn't fully understand a skill, players with that skill get underpaid. The Moneyball Oakland A's found that on-base percentage was undervalued — hitters who got on base a lot weren't being paid for it. They signed those players cheap and competed with a fraction of the Yankees' budget.",
  },
  {
    id: "q-t201-m3-mc3", moduleUnlock: 3, track: TRACK_201, difficulty: 3, type: "mc",
    question: "Why do market inefficiencies eventually disappear?",
    choiceA: "The players retire",
    choiceB: "Once enough teams start valuing the same thing, the price for it goes up",
    choiceC: "The NBA changes the rules",
    choiceD: "Analytics become illegal",
    correctAnswer: "B",
    explanation: "When Oakland started winning with OBP-heavy lineups, other teams noticed. They started bidding for the same players. Supply stayed the same but demand went up — prices rose. The inefficiency closed. The front offices that move first capture the value. The ones that follow pay full price.",
  },
  {
    id: "q-t201-m3-mc4", moduleUnlock: 3, track: TRACK_201, difficulty: 3, type: "mc",
    question: "A player averages 8 points, 3 rebounds, and 2 assists per game. By traditional stats, he looks mediocre. Advanced stats show he has a top-5 defensive rating in the league. This player is most likely:",
    choiceA: "Overpaid",
    choiceB: "Paid correctly",
    choiceC: "Undervalued because defense doesn't show up in the box score",
    choiceD: "Not worth signing",
    correctAnswer: "C",
    explanation: "Box score stats capture offense easily but miss most defensive value. Players who defend, screen, move without the ball, and make their teammates better rarely show up well in simple stats. Advanced metrics try to capture this hidden value — which is why defensive specialists are often underpaid.",
  },
  {
    id: "q-t201-m3-mc5", moduleUnlock: 3, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Which of these is an advanced statistic?",
    choiceA: "Points per game",
    choiceB: "Field goal percentage",
    choiceC: "Player Efficiency Rating (PER)",
    choiceD: "Assists per game",
    correctAnswer: "C",
    explanation: "PER attempts to summarize a player's total per-minute productivity into one number, accounting for positive contributions (points, rebounds, assists, steals, blocks) and negative ones (missed shots, turnovers). Unlike raw counting stats, it adjusts for pace and playing time.",
  },
  {
    id: "q-t201-m3-mc6", moduleUnlock: 3, track: TRACK_201, difficulty: 3, type: "mc",
    question: "A team uses analytics to find that corner three-pointers are the highest-value shot in basketball. They build their offense around corner threes. Three years later, every team in the league is also running corner-three heavy offenses. What happened to the advantage?",
    choiceA: "It grew stronger",
    choiceB: "It disappeared because everyone now values and defends corner threes",
    choiceC: "It became illegal",
    choiceD: "Only that team can keep using it",
    correctAnswer: "B",
    explanation: "This is how sports analytics cycles work. Someone finds an edge, exploits it, wins. Others copy it. The edge disappears. The teams that win long-term are the ones that keep finding the next thing — not the ones defending last year's innovation.",
  },
  {
    id: "q-t201-m3-mc7", moduleUnlock: 3, track: TRACK_201, difficulty: 3, type: "mc",
    question: "In the NFL, why did the Moneyball approach take longer to catch on than in baseball?",
    choiceA: "NFL players are smarter",
    choiceB: "Football has more variables and randomness, making statistical isolation harder",
    choiceC: "The NFL banned analytics",
    choiceD: "Baseball is more popular",
    correctAnswer: "B",
    explanation: "Baseball is beautifully isolated — a pitcher faces a batter, the result is measurable. Football has 22 players moving simultaneously. Isolating one player's contribution is much harder. That's why NFL analytics lagged baseball by a decade, and why football still has more disagreement about metrics than baseball does.",
  },
  {
    id: "q-t201-m3-mc8", moduleUnlock: 3, track: TRACK_201, difficulty: 3, type: "mc",
    question: "A team signs a player based on advanced metrics that suggest he's undervalued. He performs well. The next offseason, three other teams bid on him using the same data. His salary doubles. What does this illustrate?",
    choiceA: "Players always deserve more money",
    choiceB: "Analytics created a market correction that closed the inefficiency",
    choiceC: "The team made a mistake",
    choiceD: "Advanced stats are unreliable",
    correctAnswer: "B",
    explanation: "This is the full analytics cycle: find inefficiency, exploit it cheaply, win, watch the market correct, pay more next time. The advantage is in being early — which requires having better data or better interpretation than your competitors.",
  },
  {
    id: "q-t201-m3-fr1", moduleUnlock: 3, track: TRACK_201, difficulty: 3, type: "fr",
    question: "Explain what a market inefficiency is and give a real example from sports history where a team exploited one.",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "A market inefficiency is when the market is systematically mispricing something — undervaluing a skill or player type because it doesn't understand them yet. The classic example is the 2002 Oakland A's. They found that on-base percentage was being ignored by most teams, who were still judging hitters mostly by batting average and RBI. Oakland signed players with high OBP at a discount, built one of the most efficient offenses in baseball, and won 103 games with the third-lowest payroll in the league.",
  },
  {
    id: "q-t201-m3-fr2", moduleUnlock: 3, track: TRACK_201, difficulty: 3, type: "fr",
    question: "Why is defensive value harder to measure than offensive value in basketball? What does this mean for how teams should think about building a roster?",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "Offense is easy to count — you can track who scores, who passes, who shoots. Defense happens in movement, positioning, communication, and deterrence — things that don't show up in a box score. A defender who makes a star take a bad shot didn't get a stat for that. Teams that understand defensive value can sign elite defenders at below-market rates because most teams don't know how to measure them. Building a roster means combining scorers everyone can see with defenders only smart front offices can find.",
  },
  {
    id: "q-t201-m3-fr3", moduleUnlock: 3, track: TRACK_201, difficulty: 3, type: "fr",
    question: "If every team starts using the same analytics system, does analytics still give anyone an advantage? Explain your answer.",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "No — or at least, not the same advantage. When everyone uses the same data the same way, prices adjust and the edge disappears. The advantage moves to whoever interprets the data better, finds data others don't have, or asks questions the standard tools don't answer yet. Long-term, the analytical edge is less about the tool and more about the quality of the thinking — which is why the best front offices hire curious people who challenge their own models.",
  },
  {
    id: "q-t201-m3-fr4", moduleUnlock: 3, track: TRACK_201, difficulty: 3, type: "fr",
    question: "You're the GM of a team with a small budget. How would you use analytics to compete with teams that have twice your payroll?",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "I'd start by identifying skills the market is currently undervaluing — the same way Oakland found OBP. Right now, that might be defensive versatility, specific shooting patterns, or off-ball movement. I'd build a scouting system that measures those things before other teams do. I'd also target players coming off injuries or down years, whose market value is temporarily low but whose underlying metrics are still strong. The goal is to find $10M value in $5M players — every time. That's the only sustainable path to competing without spending power.",
  },

  /* ---- Module 201-4 — Draft Economics and Roster Windows ---- */
  {
    id: "q-t201-m4-mc1", moduleUnlock: 4, track: TRACK_201, difficulty: 2, type: "mc",
    question: "A rookie on a first-round contract who performs like an All-Star is valuable primarily because:",
    choiceA: "Rookies are always better than veterans",
    choiceB: "They are paid far below their market value, freeing up cap space for other players",
    choiceC: "They get extra playing time",
    choiceD: "The NBA gives rookie teams bonus cap space",
    correctAnswer: "B",
    explanation: "A rookie playing at All-Star level might be worth $35M per year on the open market but is paid $10M on their rookie deal. That $25M gap is surplus value. The team gets $35M of performance for $10M and can use the remaining cap space to build around them.",
  },
  {
    id: "q-t201-m4-mc2", moduleUnlock: 4, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Roster window theory says teams should go all-in and win now when:",
    choiceA: "They have young players with rookie deals and are close to championship contention",
    choiceB: "They just lost their best player",
    choiceC: "The salary cap goes down",
    choiceD: "They have too many draft picks",
    correctAnswer: "A",
    explanation: "The window is when a star is on a cheap deal and the team is good enough to compete. Stars on max contracts don't have surplus value — you're paying market rate. The window is the cheap years. Teams that don't push during the window often watch the star leave in free agency having won nothing.",
  },
  {
    id: "q-t201-m4-mc3", moduleUnlock: 4, track: TRACK_201, difficulty: 2, type: "mc",
    question: "Earlier draft picks are generally more valuable than later picks because:",
    choiceA: "Earlier picks are always better players",
    choiceB: "The probability of drafting a franchise-altering player is much higher at the top of the draft",
    choiceC: "Later picks cost more money",
    choiceD: "Teams can trade earlier picks for cash",
    correctAnswer: "B",
    explanation: "Pick value follows a steep curve. The top five picks have produced the vast majority of franchise players in NBA history. By pick 20, the probability of hitting on a star drops significantly. This is why teams trade multiple late picks for one high pick — the expected value math supports it.",
  },
  {
    id: "q-t201-m4-mc4", moduleUnlock: 4, track: TRACK_201, difficulty: 3, type: "mc",
    question: "A team trades away a first-round pick that turns out to be the second overall pick. They gave up a potential franchise player. This is an example of:",
    choiceA: "Smart trading",
    choiceB: "The risk of trading picks — you don't know where they'll land when you trade them",
    choiceC: "A good deal",
    choiceD: "Revenue sharing",
    correctAnswer: "B",
    explanation: "Pick value is uncertain at the time of the trade. A pick from a team you expect to be bad might land at 5 if that team improves, or at 1 if everything goes wrong. This is why pick protections exist — teams add conditions like 'top-5 protected' to limit their downside risk.",
  },
  {
    id: "q-t201-m4-mc5", moduleUnlock: 4, track: TRACK_201, difficulty: 3, type: "mc",
    question: "A team is rebuilding and accumulates six first-round picks over the next three years. The risk of having too many picks is:",
    choiceA: "There is no risk",
    choiceB: "You can only play five players — having six lottery picks means some won't get enough development time or might be traded at low value",
    choiceC: "Picks expire",
    choiceD: "Other teams won't trade with you",
    correctAnswer: "B",
    explanation: "You can only have one star — teams that accumulate many picks often find they have more talent than they can develop. The smart move is to identify the best two or three prospects and trade the rest at peak value for veterans who can accelerate the rebuild.",
  },
  {
    id: "q-t201-m4-mc6", moduleUnlock: 4, track: TRACK_201, difficulty: 3, type: "mc",
    question: "What is a 'pick swap' in NBA trades?",
    choiceA: "Two teams trade equal picks",
    choiceB: "One team has the right to swap their first-round pick for another team's pick if the other team's pick is better",
    choiceC: "Teams swap their entire draft boards",
    choiceD: "A type of cap exception",
    correctAnswer: "B",
    explanation: "Pick swaps are a way to trade future pick value without giving away a pick outright. If Team A has the right to swap with Team B in 2027, they'll take whichever pick is better that year. If Team A finishes with a worse record, they take Team B's pick. If Team A is better, they keep their own. It transfers value with less risk.",
  },
  {
    id: "q-t201-m4-mc7", moduleUnlock: 4, track: TRACK_201, difficulty: 3, type: "mc",
    question: "A team's star player has two years left on his contract. The team is mediocre (35-47). What should the GM prioritize?",
    choiceA: "Re-signing him to a max extension immediately",
    choiceB: "Going all-in on a trade for veteran help to maximize the remaining window",
    choiceC: "Trading the star while his value is still high and starting a rebuild",
    choiceD: "There is no right answer — any of these could be correct depending on the full picture",
    correctAnswer: "D",
    explanation: "This is a real GM decision with no single right answer. It depends on how good the star is, whether the team can realistically contend in two years, what offers exist for the star, and ownership's willingness to spend. The best answer is the one backed by the most rigorous analysis — which is exactly what front offices do.",
  },
  {
    id: "q-t201-m4-mc8", moduleUnlock: 4, track: TRACK_201, difficulty: 3, type: "mc",
    question: "Why do teams that rebuild through the draft tend to have longer windows of contention than teams that buy veterans in free agency?",
    choiceA: "Draft picks are always better than free agents",
    choiceB: "Rookie contracts provide surplus value for four years, giving teams cost-controlled talent while they build around it",
    choiceC: "Veterans decline faster",
    choiceD: "Free agents don't try as hard",
    correctAnswer: "B",
    explanation: "Four years of below-market talent is four years of cap space to add pieces. Teams built around drafted stars — Golden State with Curry/Thompson/Green, San Antonio with Duncan/Parker/Ginobili — contend for a decade because the core stays cheap long enough to build depth. Teams that buy veterans in free agency pay market rate, get less surplus, and have smaller windows.",
  },
  {
    id: "q-t201-m4-fr1", moduleUnlock: 4, track: TRACK_201, difficulty: 3, type: "fr",
    question: "Explain what surplus value is and why rookie contracts create it. Give a specific hypothetical example with numbers.",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "Surplus value is the gap between a player's market value and their actual salary. Rookie contracts create it because the NBA sets rookie salaries by draft slot, not by how good the player turns out to be. Example: if you draft a player at pick 10, his rookie salary might be $6M per year. If he develops into a player worth $25M per year on the open market, you're getting $25M of value for $6M — that's $19M in surplus value per year. That extra cap space lets you sign other good players, which is how teams with one great draft pick build contenders.",
  },
  {
    id: "q-t201-m4-fr2", moduleUnlock: 4, track: TRACK_201, difficulty: 3, type: "fr",
    question: "What is a roster window and why does timing matter so much? Use a real NBA team as an example.",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "A roster window is the period when a team's best players are in their prime and on contracts that allow the team to spend on supporting pieces. Timing matters because windows close — players age, contracts expire, injuries happen. The Golden State Warriors' window was roughly 2015-2019 when Curry, Thompson, and Green were all on reasonable contracts and in their prime. The Dubs pushed hard during that window and won four championships. Teams that don't recognize their window — or that wait too long — often watch their core break up without winning anything.",
  },
  {
    id: "q-t201-m4-fr3", moduleUnlock: 4, track: TRACK_201, difficulty: 3, type: "fr",
    question: "A team offers you two trade packages for your expiring superstar: Package A is three future first-round picks. Package B is one top-five protected pick this year and one established young star on a rookie deal. Which do you take and why? Walk through the trade-offs.",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "I'd lean toward Package B. Three future firsts sounds like more, but picks are uncertain — they could land anywhere from 1 to 30. One guaranteed top-five pick is rare and high-value. Adding an established young star on a rookie deal gives me a player I know is good plus surplus value to build around. Package A gives me more shots at a star but more variance. The decision depends on how desperate I am to rebuild quickly vs. how comfortable I am with uncertainty. If I have patience, Package A. If I need a foundation fast, Package B.",
  },
  {
    id: "q-t201-m4-fr4", moduleUnlock: 4, track: TRACK_201, difficulty: 3, type: "fr",
    question: "Explain the concept of pick value decay. Why is a pick four years from now worth less than a pick next year, even if both will land in the same draft range?",
    choiceA: null, choiceB: null, choiceC: null, choiceD: null, correctAnswer: null,
    explanation: "Pick value decays over time for two reasons. First, uncertainty — the further out a pick is, the less you know where it will land. A team that looks bad today might be good in four years, turning a lottery pick into a late first. Second, time value — a pick you can use next year adds a player to your roster immediately. A pick four years away means four more years of the roster you already have. Front offices discount future picks heavily. That's why teams often trade two or three future picks for one present pick — the math actually works out when you account for decay and uncertainty.",
  },
];

/** A quiz question as the dashboard renders it. Answer keys present only when answered. */
export interface QuizQuestionView {
  id: string;
  type: QuizQuestionType;
  question: string;
  difficulty: number;
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
  /** MC score split by difficulty (1=Easy, 2=Medium, 3=Hard) for the tracker. */
  mcByDifficulty: { difficulty: number; correct: number; total: number }[];
  /** True once every MC question in the module has been answered (enables Review Mode). */
  mcAllAnswered: boolean;
}

/* ============================================================
 * Discussion Board (Feature 3).
 *
 * Three channels students can post in. Posts, replies, and reactions
 * persist in the discussion_* tables; six starter posts seed on first
 * boot so the board isn't empty at launch. Pure content + types only.
 * ============================================================ */

export type DiscussionChannel = "gm_decisions" | "econ_wild" | "track_talk";
export type ReactionType = "fire" | "agree" | "big_brain";

/** Channel metadata for tabs, tags, and headers. */
export const DISCUSSION_CHANNELS: { key: DiscussionChannel; label: string; blurb: string }[] = [
  { key: "gm_decisions", label: "GM Decisions", blurb: "Debate real NBA / NFL / MLB front office moves." },
  { key: "econ_wild", label: "Econ in the Wild", blurb: "Spot economics concepts happening in real sports news." },
  { key: "track_talk", label: "Track Talk", blurb: "Questions about course content — help from peers." },
];

/** Reaction metadata (emoji + label). One reaction per user per post per type. */
export const REACTION_TYPES: { key: ReactionType; emoji: string; label: string }[] = [
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "agree", emoji: "💯", label: "Agree" },
  { key: "big_brain", emoji: "🧠", label: "Big Brain" },
];

export const isDiscussionChannel = (v: string): v is DiscussionChannel =>
  v === "gm_decisions" || v === "econ_wild" || v === "track_talk";
export const isReactionType = (v: string): v is ReactionType =>
  v === "fire" || v === "agree" || v === "big_brain";
export const channelLabel = (key: string): string =>
  DISCUSSION_CHANNELS.find((c) => c.key === key)?.label ?? "Discussion";

/** A seed discussion post (authored by a demo student on first boot). */
export interface DiscussionSeedPost {
  id: string;
  userId: string;
  channel: DiscussionChannel;
  title: string;
  body: string;
  pinned?: boolean;
  /** Hours before "now" the post was created (for realistic ordering). */
  agoHours: number;
}

/** Six starter posts so the board feels alive at launch. */
export const discussionSeedPosts: DiscussionSeedPost[] = [
  {
    id: "dp-seed-1", userId: "u-self1", channel: "gm_decisions", agoHours: 22, pinned: true,
    title: "Why did the Lakers give LeBron that extension when they're so far over the tax?",
    body: "They're already deep in the luxury tax and the bill is brutal at that level. But he's still a top-tier player and they have his Bird Rights, so they can pay him more than anyone else. Is keeping the star worth the repeating tax penalty, or is there a point where you let him walk and reset the books? Curious what people think the actual breakeven is.",
  },
  {
    id: "dp-seed-2", userId: "u-self2", channel: "gm_decisions", agoHours: 30,
    title: "Small-market teams should NEVER trade their first-round picks. Change my mind.",
    body: "Rookie deals are the only way a small market keeps surplus value on the books. The second you trade picks you're betting you can win NOW, and most small markets can't out-spend anybody. Feels like trading picks is a big-market luxury. Am I wrong?",
  },
  {
    id: "dp-seed-3", userId: "u-self3", channel: "track_talk", agoHours: 50,
    title: "The NFL Draft is the best example of surplus value I've ever seen — prove me wrong",
    body: "A first-round QB on a rookie deal is worth like four times what he's paid. That's why teams with a cheap young QB go all-in — the surplus is enormous. Once he gets paid, the window basically closes. Is there a cleaner real-world example of surplus value than a rookie-deal QB?",
  },
  {
    id: "dp-seed-4", userId: "u-self1", channel: "econ_wild", agoHours: 8,
    title: "Ticket prices for the rivalry game doubled — textbook supply and demand",
    body: "Same arena, same number of seats, way more people who want in. Price shot up. My BOW Daily brain immediately went 'fixed supply + spike in demand = higher price.' Spotted economics in the wild. Anyone else catch concepts from the modules out there in real life?",
  },
  {
    id: "dp-seed-5", userId: "u-self2", channel: "econ_wild", agoHours: 74,
    title: "A new arena naming-rights deal just dropped — that's sponsorship revenue at scale",
    body: "Saw a company pay a fortune to put their name on an arena for years. That's not gate revenue or media money — it's pure sponsorship. Module 201-2 said naming rights can cover a chunk of player salaries by themselves. Wild that a logo on a building helps fund the roster.",
  },
  {
    id: "dp-seed-6", userId: "u-self3", channel: "track_talk", agoHours: 96,
    title: "Still a little fuzzy on the Mid-Level Exception — can someone explain it simply?",
    body: "I get that it lets you sign someone when you're over the cap, but where does the money 'come from' if you don't have cap space? Trying to wrap my head around it before the Module 201-1 quiz. Appreciate any plain-language help!",
  },
];

/* ============================================================
 * Weekly Challenge (Feature 4).
 *
 * One harder, multi-part challenge per week, combining concepts across
 * both tracks. Eight are seeded so the first two months are populated.
 * Pure content + types only — the live week + completions live in the DB.
 * ============================================================ */

export interface WeeklyChallengeSeed {
  id: string;
  ordinal: number;
  title: string;
  prompt: string;
}

export const weeklyChallengeSeed: WeeklyChallengeSeed[] = [
  {
    id: "wc-1", ordinal: 1, title: "The Trade Deadline",
    prompt: "The Knicks are 38-30, 4th in the East, $6M under the luxury tax line. Their starting center just tore his ACL. A rebuilding team is offering him for three future firsts and a young wing on a rookie deal. Walk through: (1) whether the Knicks should make the trade, (2) what cap implications arise, (3) what the opportunity cost of the three picks is, and (4) what you would do as GM and why.",
  },
  {
    id: "wc-2", ordinal: 2, title: "Build a Winner on a Budget",
    prompt: "You are the GM of a small-market team with $8M in cap space and the 8th pick in the upcoming draft. Design your offseason strategy using at least three of the following tools: the MLE, Bird Rights, a sign-and-trade, surplus value from rookie contracts, or analytics-driven free agent targeting. Explain each tool you use and why.",
  },
  {
    id: "wc-3", ordinal: 3, title: "The Media Rights Negotiation",
    prompt: "Your league's TV deal expires in two years. Three networks are bidding: Network A offers $4B/year for 8 years. Network B offers $5B/year for 5 years. Network C offers $3.5B/year for 10 years. Calculate the total value of each deal. Then explain which you'd sign and why, considering factors beyond just total dollars.",
  },
  {
    id: "wc-4", ordinal: 4, title: "The Rebuild vs. Retool Decision",
    prompt: "Your franchise star is 31, on a three-year max contract, and your team went 44-38 last season — a first-round playoff exit. You can: (A) retool by trading for a second star (costs two future firsts plus a rotation player), (B) rebuild by trading your star for young players and picks, or (C) stay the course and add role players. Use roster window theory and surplus value concepts to argue for one path.",
  },
  {
    id: "wc-5", ordinal: 5, title: "Market Inefficiency Hunt",
    prompt: "Based on what you know about analytics and market inefficiencies: what skill or player type do you think is currently undervalued by NBA teams? Explain what the data would look like if you were right, and how you would find players with that skill at below-market value.",
  },
  {
    id: "wc-6", ordinal: 6, title: "The Luxury Tax Math",
    prompt: "A team has a payroll of $180M. The luxury tax line is $165M. The first tax bracket charges $1.50 for every $1 over up to $5M over. The second bracket charges $1.75 for every $1 from $5M to $10M over. The third bracket charges $2.50 for everything above $10M over. Calculate the team's total luxury tax bill and explain why the progressive structure discourages teams from going deep into the tax.",
  },
  {
    id: "wc-7", ordinal: 7, title: "The Draft Pick Trade",
    prompt: "Team A offers Team B: their 2026 first-round pick (projected 18-22) plus a young player on a rookie deal (2 years left, $4M/year, plays like a $10M player). Team B would give up their starting small forward (28 years old, $20M/year, two years left). Analyze this trade from both perspectives. Who wins and why? Use surplus value, pick value, and roster window theory in your answer.",
  },
  {
    id: "wc-8", ordinal: 8, title: "Design Your Front Office",
    prompt: "If you were building an NBA front office from scratch, what three roles would you hire first (beyond GM and coach)? What skills would you look for in each? How would you use analytics, scouting, and economics to build a decision-making process that finds edges other teams miss?",
  },
];

/* ============================================================
 * Partner / School landing pages (Feature 5).
 *
 * Public, custom-branded outreach pages. Three seed partners ship so
 * BOW can demo the system. Pure content + types only.
 * ============================================================ */

export type PartnerOrgType = "school" | "jcc" | "youth_org" | "league";

export const PARTNER_ORG_TYPES: { key: PartnerOrgType; label: string }[] = [
  { key: "school", label: "School" },
  { key: "jcc", label: "JCC" },
  { key: "youth_org", label: "Youth Organization" },
  { key: "league", label: "League" },
];

export const isPartnerOrgType = (v: string): v is PartnerOrgType =>
  v === "school" || v === "jcc" || v === "youth_org" || v === "league";
export const partnerTypeLabel = (key: string): string =>
  PARTNER_ORG_TYPES.find((t) => t.key === key)?.label ?? "Organization";

export interface PartnerOrgSeed {
  id: string;
  name: string;
  slug: string;
  orgType: PartnerOrgType;
  contactName: string;
  contactEmail: string;
  customHeadline: string;
  customBody: string;
}

export const partnerOrgSeed: PartnerOrgSeed[] = [
  {
    id: "po-frisch", name: "The Frisch School", slug: "frisch", orgType: "school",
    contactName: "Athletics & Electives Office", contactEmail: "partnerships@frisch.org",
    customHeadline: "Frisch students, meet the front office.",
    customBody: "Bring BOW Sports Capital to The Frisch School — a sports-business curriculum that teaches real economics, finance, and decision-making through the lens students already love. Self-paced, classroom-ready, and built to run alongside your existing electives and athletics program.",
  },
  {
    id: "po-jcc", name: "JCC Demo Partner", slug: "jcc-demo", orgType: "jcc",
    contactName: "Youth & Teen Programs", contactEmail: "programs@jccdemo.org",
    customHeadline: "A teen program they'll actually show up for.",
    customBody: "BOW Sports Capital gives your JCC's teen and youth programs a turnkey way to teach economics and leadership through sports. Run it as an after-school block, a summer camp track, or a drop-in program — the platform handles the curriculum, the simulations, and the progress tracking.",
  },
  {
    id: "po-bow", name: "General Demo", slug: "bow-demo", orgType: "youth_org",
    contactName: "BOW Partnerships", contactEmail: "hello@bowsportscapital.com",
    customHeadline: "The front office for the next generation.",
    customBody: "This is a live demo of a BOW Sports Capital partner page. Every organization we work with gets a custom-branded page like this one — built to show your students, families, and staff exactly what BOW offers and how to get started.",
  },
];


/** What partner students and instructors get (shown on every partner page). */
export const PARTNER_STUDENT_BULLETS: string[] = [
  "A self-paced curriculum — two full tracks of sports-business economics, unlocked one decision at a time.",
  "The Simulation Room — turn-based front-office games where every choice teaches an economic concept.",
  "The Econ Quiz — plain-language questions that build real financial literacy, module by module.",
  "A certificate of completion — a shareable, verifiable credential for each track they finish.",
];

export const PARTNER_INSTRUCTOR_BULLETS: string[] = [
  "Roster management — invite students, track enrollment, and manage cohorts in one place.",
  "Class analytics — see module progress, quiz scores, and engagement across the whole group.",
  "Session tools — attendance, per-student notes, and manual module unlocks when you need them.",
];
