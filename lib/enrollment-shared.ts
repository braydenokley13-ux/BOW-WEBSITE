/* ============================================================
 * Registration lifecycle — pure rules, no database.
 *
 * Split from lib/enrollment.ts (which is server-only) so the vocabulary and
 * decision rules can be imported by client components and exercised directly
 * by tests. Same convention as delivery-shared / operations-shared.
 *
 * Everything here is a total function of its arguments. If a rule needs to
 * read a row, it belongs in lib/enrollment.ts instead.
 * ============================================================ */

export const REGISTRATION_STATUSES = [
  "submitted",
  "under_review",
  "seat_reserved",
  "requirements_pending",
  "confirmed",
  "waitlisted",
  "offer_sent",
  "offer_accepted",
  "withdrawn",
  "expired",
  "declined",
  "cancelled",
  "completed",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/**
 * Statuses that occupy a seat. Mirrors the `holds_seat` column exactly, and
 * is the single definition of "this registration is using capacity" — a
 * status added to the lifecycle without being classified here would silently
 * stop counting against the class.
 */
const SEAT_HOLDING: ReadonlySet<string> = new Set([
  "under_review",
  "seat_reserved",
  "requirements_pending",
  "confirmed",
  "offer_sent",
  "offer_accepted",
]);

/** Statuses a family can register again from. */
const TERMINAL: ReadonlySet<string> = new Set(["withdrawn", "expired", "declined", "cancelled"]);

export function holdsSeat(status: string): boolean {
  return SEAT_HOLDING.has(status);
}

export function isTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

/** Family-facing label. Internal stage names are never shown to a parent. */
export function registrationLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "under_review":
    case "pending":
      return "Additional review required";
    case "seat_reserved":
    case "requirements_pending":
      return "Seat reserved";
    case "confirmed":
      return "Confirmed";
    case "waitlisted":
      return "Waitlisted";
    case "offer_sent":
      return "Seat offered";
    case "offer_accepted":
      return "Offer accepted";
    case "withdrawn":
      return "Withdrawn";
    case "expired":
      return "Reservation expired";
    case "declined":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    default:
      return "Registration";
  }
}

export class EnrollmentError extends Error {
  constructor(
    message: string,
    readonly code:
      | "no_capacity"
      | "not_open"
      | "already_registered"
      | "ineligible"
      | "conflict"
      | "expired"
      | "not_found"
      | "invalid" = "invalid",
  ) {
    super(message);
  }
}

/* ===================================================================== */
/* Program shape                                                         */
/* ===================================================================== */

export interface RegistrationProgram {
  id: string;
  name: string;
  is_public: boolean;
  public_status: string | null;
  capacity: number | null;
  registration_mode: "immediate" | "approval";
  full_capacity_behavior: "close" | "waitlist" | "continue";
  registration_deadline: string | null;
  registration_opens_at: string | null;
  reservation_enabled: boolean;
  reservation_hours: number;
  waitlist_mode: "disabled" | "automatic" | "manual";
  waitlist_offer_hours: number;
  grade_min: number | null;
  grade_max: number | null;
  start_date: string | null;
  schedule_timezone: string | null;
}

/* ===================================================================== */
/* Eligibility                                                           */
/* ===================================================================== */

/** Numeric grade for eligibility. "K" and "Kindergarten" are grade 0. */
export function parseGrade(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (text === "k" || text.startsWith("kinder") || text === "tk") return 0;
  const match = text.match(/-?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

/**
 * Evaluated for display on the public page and re-evaluated inside the seat
 * transaction. A grade the program cannot interpret is never treated as a
 * failure — an admin resolves it through review instead of the family being
 * silently turned away by a parser.
 */
export function checkEligibility(
  program: Pick<RegistrationProgram, "grade_min" | "grade_max">,
  grade: string | null | undefined,
): EligibilityResult {
  const numeric = parseGrade(grade);
  if (numeric === null) return { eligible: true };
  if (program.grade_min != null && numeric < program.grade_min) {
    return { eligible: false, reason: `This program is for grades ${gradeRangeLabel(program)}.` };
  }
  if (program.grade_max != null && numeric > program.grade_max) {
    return { eligible: false, reason: `This program is for grades ${gradeRangeLabel(program)}.` };
  }
  return { eligible: true };
}

export function gradeRangeLabel(program: Pick<RegistrationProgram, "grade_min" | "grade_max">): string {
  const low = program.grade_min;
  const high = program.grade_max;
  const name = (value: number) => (value <= 0 ? "K" : String(value));
  if (low != null && high != null) return low === high ? name(low) : `${name(low)}–${name(high)}`;
  if (low != null) return `${name(low)} and up`;
  if (high != null) return `${name(high)} and below`;
  return "all grades";
}

/* ===================================================================== */
/* Public availability                                                   */
/* ===================================================================== */

export type PublicAvailability =
  | "registration_open"
  | "limited_seats"
  | "waitlist_available"
  | "interest_list"
  | "registration_closed"
  | "coming_soon";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function registrationWindowClosed(
  program: Pick<RegistrationProgram, "registration_deadline">,
): boolean {
  return Boolean(program.registration_deadline && program.registration_deadline < today());
}

export function registrationWindowNotYetOpen(
  program: Pick<RegistrationProgram, "registration_opens_at">,
): boolean {
  return Boolean(program.registration_opens_at && program.registration_opens_at > today());
}

/**
 * The only availability vocabulary families ever see. Internal program stages
 * (`opportunity`, `delivery`, ...) are deliberately not reachable from here.
 */
export function publicAvailability(
  program: Pick<
    RegistrationProgram,
    "is_public" | "public_status" | "waitlist_mode" | "full_capacity_behavior" | "registration_deadline"
  >,
  seatsRemaining: number | null,
): PublicAvailability {
  if (!program.is_public) return "coming_soon";
  const status = program.public_status ?? "coming_soon";
  if (status === "coming_soon") return "coming_soon";
  if (status === "closed") return "registration_closed";
  if (registrationWindowClosed(program)) return "registration_closed";
  if (seatsRemaining != null && seatsRemaining <= 0) {
    if (program.waitlist_mode !== "disabled") return "waitlist_available";
    if (program.full_capacity_behavior === "close") return "interest_list";
    return "registration_open";
  }
  if (seatsRemaining != null && seatsRemaining <= 3) return "limited_seats";
  return "registration_open";
}

export function availabilityLabel(value: PublicAvailability): string {
  switch (value) {
    case "registration_open":
      return "Registration open";
    case "limited_seats":
      return "Limited seats";
    case "waitlist_available":
      return "Waitlist available";
    case "interest_list":
      return "Interest list";
    case "registration_closed":
      return "Registration closed";
    case "coming_soon":
      return "Coming soon";
  }
}

/* ===================================================================== */
/* Submission results                                                    */
/* ===================================================================== */

export type SubmissionOutcome =
  | "confirmed"
  | "seat_reserved"
  | "under_review"
  | "waitlisted"
  | "interest_recorded"
  | "already_registered"
  | "ineligible"
  | "unavailable";

export interface ChildSelectionResult {
  studentId: string | null;
  studentName: string;
  programId: string;
  programName: string;
  outcome: SubmissionOutcome;
  status: RegistrationStatus | null;
  registrationId: string | null;
  reservationExpiresAt: number | null;
  blockingRequirements: number;
  message: string;
}

export function outcomeHeading(outcome: SubmissionOutcome): string {
  switch (outcome) {
    case "confirmed":
      return "Confirmed";
    case "seat_reserved":
      return "Seat reserved";
    case "under_review":
      return "Additional review required";
    case "waitlisted":
      return "Waitlisted";
    case "interest_recorded":
      return "Interest recorded";
    case "already_registered":
      return "Already registered";
    case "ineligible":
      return "Not eligible";
    case "unavailable":
      return "Not available";
  }
}

/* ===================================================================== */
/* Requirement vocabulary                                                */
/* ===================================================================== */

// Kept here rather than beside the admin actions because a "use server" file
// may only export async functions, and both the admin builder and the family
// requirement forms need these labels.
export const REQUIREMENT_KINDS = [
  "emergency_contact",
  "medical",
  "accessibility",
  "photo_consent",
  "agreement",
  "waiver",
  "student_interests",
  "prior_experience",
  "school",
  "grade_verification",
  "logistics_ack",
  "short_response",
  "choice",
  "file_upload",
] as const;

export const REQUIREMENT_KIND_LABELS: Record<(typeof REQUIREMENT_KINDS)[number], string> = {
  emergency_contact: "Emergency contact",
  medical: "Medical information",
  accessibility: "Accessibility needs",
  photo_consent: "Photo / media consent",
  agreement: "Program agreement",
  waiver: "Liability waiver",
  student_interests: "Student interests",
  prior_experience: "Prior experience",
  school: "School",
  grade_verification: "Grade verification",
  logistics_ack: "Logistics acknowledgment",
  short_response: "Short response",
  choice: "Multiple choice",
  file_upload: "File upload",
};
