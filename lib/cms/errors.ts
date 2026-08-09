/* ============================================================
 * Specific failure states, in place of one generic apology.
 *
 * One generic apology used to cover a missing database table, an expired
 * session, an empty content list, and a typo'd URL alike. A visitor learned
 * nothing and a founder learned less. This module names the situations the
 * site can actually be in and gives each one its own words.
 *
 * The founder-facing text may carry a diagnostic *identifier* — a reason code
 * and, for a Postgres error, its SQLSTATE and relation name — because the
 * person who can fix a missing migration needs to know which one. It never
 * carries connection strings, credentials, SQL text, or row data: `describe()`
 * builds its detail string from a fixed allow-list of fields, so a future
 * caller cannot accidentally widen it by passing a richer error.
 *
 * Browser-safe.
 * ============================================================ */

export const CONTENT_REASONS = [
  "no_published_content",
  "no_programs_available",
  "program_not_found",
  "track_not_found",
  "page_not_found",
  "registration_closed",
  "authentication_required",
  "insufficient_permissions",
  "network_unavailable",
  "configuration_error",
  "schema_out_of_date",
  "internal_error",
] as const;

export type ContentReason = (typeof CONTENT_REASONS)[number];

export interface ContentNotice {
  reason: ContentReason;
  /** What a public visitor reads. Plain, useful, never blaming them. */
  title: string;
  body: string;
  /** Suggested next step, when one exists. */
  action?: { label: string; href: string };
  /** Extra line shown only to signed-in staff. Safe to render in HTML. */
  diagnostic?: string;
  /** True when this is a fault rather than an ordinary empty state. */
  isFault: boolean;
}

const BASE: Record<ContentReason, Omit<ContentNotice, "reason" | "diagnostic">> = {
  no_published_content: {
    title: "This page isn’t published yet.",
    body: "There’s nothing here to read right now. Check back shortly, or head to the programs page in the meantime.",
    action: { label: "See programs", href: "/programs" },
    isFault: false,
  },
  no_programs_available: {
    title: "No public classes are open right now",
    body: "Join the interest list and we'll contact you when a relevant BOW program becomes available.",
    action: { label: "Join the Interest List", href: "/sign-up" },
    isFault: false,
  },
  program_not_found: {
    title: "We couldn’t find that program.",
    body: "It may have finished, or the link may be out of date. Here’s everything currently running.",
    action: { label: "See all programs", href: "/programs" },
    isFault: false,
  },
  track_not_found: {
    title: "We couldn’t find that track.",
    body: "It may not be published yet, or the link may be out of date.",
    action: { label: "See all programs", href: "/programs" },
    isFault: false,
  },
  page_not_found: {
    title: "We couldn’t find that page.",
    body: "The link may be out of date, or the page may not be published yet.",
    action: { label: "Back to home", href: "/" },
    isFault: false,
  },
  registration_closed: {
    title: "Registration isn’t open for this one.",
    body: "You can still join the interest list and we’ll let you know when a seat opens up.",
    action: { label: "See open programs", href: "/programs" },
    isFault: false,
  },
  authentication_required: {
    title: "Sign in to continue.",
    body: "This page is part of your BOW account.",
    action: { label: "Sign in", href: "/sign-in" },
    isFault: false,
  },
  insufficient_permissions: {
    title: "You don’t have access to this.",
    body: "Your account is signed in, but this area is limited to BOW staff.",
    action: { label: "Back to your dashboard", href: "/app" },
    isFault: false,
  },
  network_unavailable: {
    title: "We couldn’t reach our systems just now.",
    body: "This is almost always temporary. Try again in a moment — nothing you did was lost.",
    isFault: true,
  },
  configuration_error: {
    title: "This part of the site is being set up.",
    body: "We’re aware and working on it. Please try again shortly.",
    isFault: true,
  },
  schema_out_of_date: {
    title: "This part of the site is being updated.",
    body: "We’re mid-upgrade on this page. Please try again shortly.",
    isFault: true,
  },
  internal_error: {
    title: "Something went wrong on our end.",
    body: "Not your fault, and nothing was lost. Try again — if it keeps happening, let us know.",
    isFault: true,
  },
};

/**
 * A failure whose cause we already know. Thrown by the content layer so a page
 * can render the right state instead of falling through to an error boundary.
 */
export class ContentError extends Error {
  readonly reason: ContentReason;
  readonly detail: string | undefined;

  constructor(reason: ContentReason, detail?: string) {
    super(`${reason}${detail ? `: ${detail}` : ""}`);
    this.name = "ContentError";
    this.reason = reason;
    this.detail = detail;
  }
}

interface PgLikeError {
  code?: unknown;
  routine?: unknown;
  table_name?: unknown;
  column_name?: unknown;
  constraint_name?: unknown;
  message?: unknown;
  errno?: unknown;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Map a thrown value onto a reason. Postgres SQLSTATEs are the reliable signal;
 * everything else falls back to `internal_error` rather than guessing from
 * message text.
 */
export function classifyError(error: unknown): { reason: ContentReason; detail: string | undefined } {
  if (error instanceof ContentError) return { reason: error.reason, detail: error.detail };

  const candidate = (error ?? {}) as PgLikeError;
  const code = str(candidate.code);

  // Missing relation / column / function / type: the database is behind the code.
  if (code === "42P01" || code === "42703" || code === "42883" || code === "42704" || code === "3F000") {
    const target = str(candidate.table_name) ?? str(candidate.column_name) ?? relationFromMessage(candidate.message);
    return { reason: "schema_out_of_date", detail: [`SQLSTATE ${code}`, target].filter(Boolean).join(" · ") };
  }

  // Row Level Security, privilege, or authentication refusals.
  if (code === "42501") return { reason: "insufficient_permissions", detail: "SQLSTATE 42501" };
  if (code === "28P01" || code === "28000") return { reason: "configuration_error", detail: `SQLSTATE ${code}` };

  // Connection-level failures.
  if (
    code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT" ||
    code === "EAI_AGAIN" || code === "CONNECT_TIMEOUT" || code === "ECONNRESET" ||
    code === "57P03" || code === "08006" || code === "08001" || code === "53300"
  ) {
    return { reason: "network_unavailable", detail: `connection ${code}` };
  }

  // The app's own "no POSTGRES_URL" / missing-key guards.
  const message = str(candidate.message) ?? "";
  if (/^\[bow\] Missing |Missing (POSTGRES_URL|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE)/.test(message)) {
    return { reason: "configuration_error", detail: "required environment variable is not set" };
  }

  return { reason: "internal_error", detail: code ? `code ${code}` : undefined };
}

/** Pull a relation name out of `relation "foo" does not exist`, and nothing else. */
function relationFromMessage(message: unknown): string | undefined {
  const text = str(message);
  if (!text) return undefined;
  const match = /relation "([A-Za-z0-9_.]+)" does not exist|column "([A-Za-z0-9_.]+)" does not exist/.exec(text);
  return match ? (match[1] ?? match[2]) : undefined;
}

/**
 * Build the notice a page should render.
 *
 * `staff` widens it by exactly one line — the reason code plus a bounded
 * diagnostic — and nothing else changes. Public output is identical whether or
 * not a staff member is looking at it.
 */
export function describe(
  error: unknown,
  options: { staff?: boolean; overrides?: Partial<Pick<ContentNotice, "title" | "body" | "action">> } = {},
): ContentNotice {
  const { reason, detail } = classifyError(error);
  const base = BASE[reason];
  return {
    reason,
    ...base,
    ...options.overrides,
    diagnostic: options.staff ? [reason, detail].filter(Boolean).join(" · ") : undefined,
  };
}

/** A notice for a known situation, with no underlying exception. */
export function notice(
  reason: ContentReason,
  options: { staff?: boolean; detail?: string; overrides?: Partial<Pick<ContentNotice, "title" | "body" | "action">> } = {},
): ContentNotice {
  const base = BASE[reason];
  return {
    reason,
    ...base,
    ...options.overrides,
    diagnostic: options.staff ? [reason, options.detail].filter(Boolean).join(" · ") : undefined,
  };
}

/**
 * Remediation text for staff, keyed by reason. Shown in BOW HQ only — this is
 * the sentence that turns "a page is broken" into "run the migrations".
 */
export const STAFF_REMEDIATION: Partial<Record<ContentReason, string>> = {
  schema_out_of_date:
    "The database is missing a table or column this build expects. Apply pending migrations with `npm run migrate` against POSTGRES_URL_NON_POOLING.",
  configuration_error:
    "A required environment variable is missing or a credential was rejected. Check POSTGRES_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in the deployment’s environment.",
  network_unavailable:
    "The database refused or dropped the connection. Check Supabase project status and the connection pooler.",
  insufficient_permissions:
    "A Row Level Security policy or table grant refused this read. Confirm the app is connecting with its owner role.",
  no_published_content:
    "Nothing is published for this route yet. Open Website → Pages, edit it, and publish.",
};
