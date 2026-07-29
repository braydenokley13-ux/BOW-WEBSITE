/* ============================================================
 * Publication and registration status — one explicit state each.
 *
 * The site used to describe an offering with two booleans and a four-value
 * enum (`is_public`, `public_status`) that overlapped: "not public" and
 * "closed" and "coming soon" all meant slightly different things depending on
 * which page was reading them, and a founder had no way to say "the program
 * exists, it is full, but you may still join the interest list".
 *
 * Two independent axes replace that:
 *
 *   publication_status  — does this exist publicly at all?  draft/published/archived
 *   registration_status — can you act on it right now?      six states
 *
 * The call-to-action is *derived* from registration status, so a founder never
 * has to keep wording and behaviour in sync by hand. `ctaLabelOverride` changes
 * only the words; the behaviour underneath is still the derived one.
 *
 * Browser-safe: the admin editor and the public cards both import this.
 * ============================================================ */

export const PUBLICATION_STATUSES = ["draft", "published", "archived"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const REGISTRATION_STATUSES = [
  "coming_soon",
  "registration_open",
  "interest_list",
  "full",
  "registration_closed",
  "completed",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export function isPublicationStatus(value: unknown): value is PublicationStatus {
  return typeof value === "string" && (PUBLICATION_STATUSES as readonly string[]).includes(value);
}

export function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return typeof value === "string" && (REGISTRATION_STATUSES as readonly string[]).includes(value);
}

export function toPublicationStatus(value: unknown, fallback: PublicationStatus = "draft"): PublicationStatus {
  return isPublicationStatus(value) ? value : fallback;
}

export function toRegistrationStatus(value: unknown, fallback: RegistrationStatus = "coming_soon"): RegistrationStatus {
  return isRegistrationStatus(value) ? value : fallback;
}

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  coming_soon: "Coming Soon",
  registration_open: "Registration Open",
  interest_list: "Interest List",
  full: "Full",
  registration_closed: "Registration Closed",
  completed: "Completed",
};

/** What the founder is told each registration state does, in the editor. */
export const REGISTRATION_STATUS_HELP: Record<RegistrationStatus, string> = {
  coming_soon: "Shown publicly, but nobody can sign up yet.",
  registration_open: "Anyone can register right now.",
  interest_list: "No seats on sale — visitors join the interest list instead.",
  full: "Seats are gone. Registration is disabled; the interest list still shows if you allow it.",
  registration_closed: "Registration has ended. The program stays visible, with signup disabled.",
  completed: "The program has finished. No signup is offered at all.",
};

/**
 * What a visitor may do, derived from registration status alone.
 *
 * `register`      — the registration form is open
 * `interest`      — the interest list is the only route in
 * `disabled`      — a button is shown, greyed out, with the reason as its label
 * `none`          — no call to action belongs on the page at all
 */
export type CtaBehavior = "register" | "interest" | "disabled" | "none";

export interface OfferingCta {
  behavior: CtaBehavior;
  label: string;
  /** Set when the primary action is a link the visitor can follow. */
  href: string | null;
  /** An interest-list route offered alongside a disabled primary action. */
  secondary: { label: string; href: string } | null;
  /** Plain-language explanation shown near the button. */
  explanation: string;
}

export interface CtaInput {
  registrationStatus: RegistrationStatus;
  /** Where a live registration would go, e.g. `/programs/register/<id>`. */
  registerHref: string;
  /** Where an interest-list signup would go. */
  interestHref: string;
  /** Founder may turn the interest list off for a specific offering. */
  interestListEnabled: boolean;
  /** Changes the wording only — never the behaviour. */
  ctaLabelOverride?: string | null;
  signupExplanation?: string | null;
  interestListExplanation?: string | null;
}

const DEFAULT_LABELS: Record<RegistrationStatus, string> = {
  coming_soon: "Coming Soon",
  registration_open: "Register",
  interest_list: "Join the Interest List",
  full: "Program Full",
  registration_closed: "Registration Closed",
  completed: "Completed",
};

/**
 * The single place a public call to action is decided. Every surface — program
 * card, program detail, finder result, track page — calls this, so the button
 * a visitor sees can never contradict the status a founder set.
 */
export function deriveCta(input: CtaInput): OfferingCta {
  const {
    registrationStatus: status,
    registerHref,
    interestHref,
    interestListEnabled,
    ctaLabelOverride,
    signupExplanation,
    interestListExplanation,
  } = input;

  const label = (ctaLabelOverride ?? "").trim() || DEFAULT_LABELS[status];
  const interestSecondary = interestListEnabled
    ? { label: "Join the Interest List", href: interestHref }
    : null;

  switch (status) {
    case "registration_open":
      return {
        behavior: "register",
        label,
        href: registerHref,
        secondary: null,
        explanation: (signupExplanation ?? "").trim(),
      };
    case "interest_list":
      return {
        behavior: "interest",
        label,
        href: interestHref,
        secondary: null,
        explanation: (interestListExplanation ?? "").trim(),
      };
    case "full":
      return {
        behavior: "disabled",
        label,
        href: null,
        secondary: interestSecondary,
        explanation: interestListEnabled
          ? (interestListExplanation ?? "").trim()
          : "",
      };
    case "registration_closed":
      return { behavior: "disabled", label, href: null, secondary: null, explanation: "" };
    case "completed":
      return { behavior: "none", label, href: null, secondary: null, explanation: "" };
    case "coming_soon":
    default:
      return {
        behavior: "none",
        label,
        href: null,
        secondary: interestSecondary,
        explanation: interestListEnabled ? (interestListExplanation ?? "").trim() : "",
      };
  }
}

/** Short badge text for cards and admin lists. */
export function registrationBadge(status: RegistrationStatus): string {
  return REGISTRATION_STATUS_LABELS[status];
}

/**
 * Whether a visitor may still reach the registration form for this state.
 * Server actions check this before accepting a submission — the button being
 * hidden is a UI courtesy, not the control.
 */
export function registrationIsOpen(status: RegistrationStatus): boolean {
  return status === "registration_open";
}

/** Whether an interest-list submission is legitimate for this state. */
export function interestListIsOpen(status: RegistrationStatus, interestListEnabled: boolean): boolean {
  if (!interestListEnabled) return false;
  return status === "interest_list" || status === "full" || status === "coming_soon";
}
