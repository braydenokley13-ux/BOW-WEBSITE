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
}

/** Per-student, per-lesson progress detail (source of truth in the DB). */
export interface LessonProgressDetail {
  status: "not-started" | "in-progress" | "completed";
  simulationDone: boolean;
  reflection: string;
  challengeDone: boolean;
  startedAt: string | null;
  completedAt: string | null;
}

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

/* ============================================================
 * Backend wiring
 * ============================================================ */

/**
 * Development password assigned to every seeded account that has
 * "active" or "suspended" status. Seeded "invited" users have no
 * password until they accept their invitation. Real deployments
 * should rotate these out — they exist so the prototype's seed
 * accounts can actually sign in.
 */
export const SEED_PASSWORD = "bowdemo123";

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
