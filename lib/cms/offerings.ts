/* ============================================================
 * Public offerings — programs and tracks.
 *
 * Programs are the existing `programs` operating record; tracks are the
 * existing `curricula` record. Neither is duplicated into a CMS table: this
 * module reads the public-facing columns migration 023 added to them and hands
 * pages a DTO that already knows what its call to action should do.
 *
 * Publication is filtered in SQL, not in TypeScript. A draft or archived
 * offering is never fetched by a public reader, so it cannot leak through a
 * forgotten `.filter()`, a JSON payload handed to a client component, the
 * sitemap, or page metadata.
 *
 * Server-only.
 * ============================================================ */

import "server-only";

import { cache } from "react";
import { sqlLearn } from "@/lib/db-sql";
import { ContentError, classifyError } from "@/lib/cms/errors";
import {
  deriveCta,
  toPublicationStatus,
  toRegistrationStatus,
  type OfferingCta,
  type PublicationStatus,
  type RegistrationStatus,
} from "@/lib/cms/status";

export interface PublicProgram {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  gradeRange: string;
  audience: string;
  deliveryFormat: string;
  isOnline: boolean | null;
  locationLabel: string;
  startDate: string | null;
  endDate: string | null;
  scheduleLabel: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string | null;
  sessionCount: number | null;
  sessionLengthMinutes: number | null;
  capacity: number | null;
  registeredCount: number;
  seatsRemaining: number | null;
  isFree: boolean;
  priceLabel: string;
  priceNote: string;
  curriculumSummary: string;
  learningGoals: string;
  studentExperience: string;
  imageUrl: string;
  featured: boolean;
  displayOrder: number;
  publicationStatus: PublicationStatus;
  registrationStatus: RegistrationStatus;
  interestListEnabled: boolean;
  confirmationMessage: string;
  seoTitle: string;
  seoDescription: string;
  socialImageUrl: string;
  trackSlug: string | null;
  cta: OfferingCta;
}

export interface PublicTrack {
  id: string;
  slug: string;
  title: string;
  kicker: string;
  headline: string;
  shortDescription: string;
  longDescription: string;
  gradeRange: string;
  audience: string;
  curriculumSummary: string;
  studentExperience: string;
  imageUrl: string;
  badgeLabel: string;
  ctaLabel: string;
  ctaHref: string;
  featured: boolean;
  displayOrder: number;
  publicationStatus: PublicationStatus;
  seoTitle: string;
  seoDescription: string;
  socialImageUrl: string;
}

async function guarded<T>(label: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ContentError) throw error;
    const { reason, detail } = classifyError(error);
    throw new ContentError(reason, [label, detail].filter(Boolean).join(" · "));
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function priceLabel(row: any): string {
  if (row.is_free) return "Free";
  const cents = num(row.price_cents);
  if (cents === null) return "";
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

export interface OfferingDefaults {
  registrationExplanation: string;
  interestListExplanation: string;
  interestHref: string;
}

/**
 * The interest list is the site's account signup flow, which already collects
 * the family details BOW needs and is the destination every current
 * "Join the interest list" button points at. It is a route, not content, so it
 * stays in code rather than becoming an editable field that could be pointed
 * somewhere that silently drops leads.
 */
export const INTEREST_LIST_HREF = "/sign-up";

const FALLBACK_DEFAULTS: OfferingDefaults = {
  registrationExplanation: "",
  interestListExplanation: "",
  interestHref: INTEREST_LIST_HREF,
};

function toProgram(row: any, defaults: OfferingDefaults): PublicProgram {
  const capacity = num(row.capacity);
  const registeredCount = Number(row.registered_count) || 0;
  const declared = toRegistrationStatus(row.registration_status);

  // Capacity is a fact, not an opinion: an open program whose seats are gone
  // presents as Full even if nobody has updated its status yet. The founder's
  // explicit "closed"/"completed" states are never overridden this way.
  const registrationStatus: RegistrationStatus =
    declared === "registration_open" && capacity !== null && registeredCount >= capacity
      ? "full"
      : declared;

  const slug = str(row.public_slug, String(row.id));
  const interestListEnabled = row.interest_list_enabled !== false;

  return {
    id: String(row.id),
    slug,
    title: str(row.public_title) || str(row.name, "Program"),
    shortDescription: str(row.short_description),
    longDescription: str(row.long_description),
    gradeRange: str(row.grade_range),
    audience: str(row.audience),
    deliveryFormat: str(row.delivery_format),
    isOnline: row.is_online === null || row.is_online === undefined ? null : Boolean(row.is_online),
    locationLabel: str(row.location_label) || str(row.location_name),
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    scheduleLabel: str(row.schedule_label),
    startTime: row.schedule_start_time ?? null,
    endTime: row.schedule_end_time ?? null,
    timezone: row.schedule_timezone ?? null,
    sessionCount: num(row.session_count),
    sessionLengthMinutes: num(row.session_length_minutes),
    capacity,
    registeredCount,
    seatsRemaining: capacity === null ? null : Math.max(0, capacity - registeredCount),
    isFree: Boolean(row.is_free),
    priceLabel: priceLabel(row),
    priceNote: str(row.price_note),
    curriculumSummary: str(row.curriculum_summary) || str(row.curriculum_title),
    learningGoals: str(row.learning_goals),
    studentExperience: str(row.student_experience),
    imageUrl: str(row.image_url),
    featured: Boolean(row.featured),
    displayOrder: Number(row.display_order) || 0,
    publicationStatus: toPublicationStatus(row.publication_status),
    registrationStatus,
    interestListEnabled,
    confirmationMessage: str(row.confirmation_message),
    seoTitle: str(row.seo_title),
    seoDescription: str(row.seo_description),
    socialImageUrl: str(row.social_image_url),
    trackSlug: row.track_slug ?? null,
    cta: deriveCta({
      registrationStatus,
      // The canonical family wizard, not the per-program legacy form. Only
      // that path takes the class row lock before counting seats, enrols
      // siblings in one flow, and hands a full class to the waitlist engine —
      // the legacy route does none of those, so two families racing for the
      // last seat could both be confirmed.
      //
      // deriveCta only ever uses this href for `registration_open`, so
      // Coming Soon / Full / Closed / interest-list behaviour is untouched.
      // /programs/register/<id> still resolves, as a redirect, so links
      // already shared with families keep working.
      registerHref: `/programs/register?program=${row.id}`,
      interestHref: defaults.interestHref,
      interestListEnabled,
      ctaLabelOverride: row.cta_label_override,
      signupExplanation: str(row.signup_explanation) || defaults.registrationExplanation,
      interestListExplanation: str(row.interest_list_explanation) || defaults.interestListExplanation,
    }),
  };
}

function toTrack(row: any): PublicTrack {
  return {
    id: String(row.id),
    slug: str(row.public_slug),
    title: str(row.public_title) || str(row.title, "Track"),
    kicker: str(row.public_kicker),
    headline: str(row.headline),
    shortDescription: str(row.short_description) || str(row.description),
    longDescription: str(row.long_description),
    gradeRange: str(row.grade_range) || str(row.age_range),
    audience: str(row.audience),
    curriculumSummary: str(row.curriculum_summary),
    studentExperience: str(row.student_experience),
    imageUrl: str(row.image_url),
    badgeLabel: str(row.badge_label),
    ctaLabel: str(row.cta_label, "Learn more"),
    ctaHref: str(row.cta_href) || `/programs/${str(row.public_slug)}`,
    featured: Boolean(row.featured),
    displayOrder: Number(row.display_order) || 0,
    publicationStatus: toPublicationStatus(row.publication_status),
    seoTitle: str(row.seo_title),
    seoDescription: str(row.seo_description),
    socialImageUrl: str(row.social_image_url),
  };
}

/**
 * The confirmed-seat count, computed the same way the roster does — a
 * registration only occupies a seat once it resolves to an active enrolment.
 * Kept as a correlated subquery so one round trip answers the whole list.
 */
const PROGRAM_SELECT = `
  p.*,
  c.title AS curriculum_title,
  t.public_slug AS track_slug,
  loc.name AS location_name,
  (SELECT COUNT(*) FROM program_registrations pr
    WHERE pr.program_id = p.id AND pr.status = 'confirmed') AS registered_count
`;

export const listPublicProgramsForSite = cache(async (): Promise<PublicProgram[]> => {
  const defaults = await offeringDefaults();
  const rows = await guarded("programs", async () =>
    sqlLearn.unsafe(
      `SELECT ${PROGRAM_SELECT}
         FROM programs p
         LEFT JOIN curricula c ON c.id = p.curriculum_id
         LEFT JOIN curricula t ON t.id = p.track_curriculum_id
         LEFT JOIN locations loc ON loc.id = p.location_id
        WHERE p.publication_status = 'published'
        ORDER BY p.featured DESC, p.display_order ASC, p.start_date ASC NULLS LAST, p.updated_at DESC`,
    ),
  );
  return [...rows].map((row) => toProgram(row, defaults));
});

/** Programs a visitor can act on now — everything except finished ones. */
export async function listOpenPrograms(): Promise<PublicProgram[]> {
  const programs = await listPublicProgramsForSite();
  return programs.filter((program) => program.registrationStatus !== "completed");
}

export const getPublicProgramBySlug = cache(async (slugOrId: string): Promise<PublicProgram | null> => {
  const defaults = await offeringDefaults();
  const rows = await guarded(`program:${slugOrId}`, async () =>
    sqlLearn.unsafe(
      `SELECT ${PROGRAM_SELECT}
         FROM programs p
         LEFT JOIN curricula c ON c.id = p.curriculum_id
         LEFT JOIN curricula t ON t.id = p.track_curriculum_id
         LEFT JOIN locations loc ON loc.id = p.location_id
        WHERE p.publication_status = 'published'
          AND (p.public_slug = $1 OR p.id = $1)
        LIMIT 1`,
      [slugOrId],
    ),
  );
  const row = [...rows][0];
  return row ? toProgram(row, defaults) : null;
});

export const listPublicTracks = cache(async (): Promise<PublicTrack[]> => {
  const rows = await guarded("tracks", async () =>
    sqlLearn`
      SELECT * FROM curricula
       WHERE publication_status = 'published' AND public_slug IS NOT NULL
       ORDER BY display_order ASC, title ASC
    `,
  );
  return [...rows].map(toTrack);
});

export const getPublicTrackBySlug = cache(async (slug: string): Promise<PublicTrack | null> => {
  const rows = await guarded(`track:${slug}`, async () =>
    sqlLearn`
      SELECT * FROM curricula
       WHERE publication_status = 'published' AND public_slug = ${slug}
       LIMIT 1
    `,
  );
  const row = [...rows][0];
  return row ? toTrack(row) : null;
});

/**
 * A track's public page still exists in draft while the founder writes it; this
 * variant is only reachable behind `requirePreviewAccess()`.
 */
export async function getTrackForPreview(slug: string): Promise<PublicTrack | null> {
  const rows = await guarded(`track-preview:${slug}`, async () =>
    sqlLearn`SELECT * FROM curricula WHERE public_slug = ${slug} AND publication_status <> 'archived' LIMIT 1`,
  );
  const row = [...rows][0];
  return row ? toTrack(row) : null;
}

export async function getProgramForPreview(slugOrId: string): Promise<PublicProgram | null> {
  const defaults = await offeringDefaults();
  const rows = await guarded(`program-preview:${slugOrId}`, async () =>
    sqlLearn.unsafe(
      `SELECT ${PROGRAM_SELECT}
         FROM programs p
         LEFT JOIN curricula c ON c.id = p.curriculum_id
         LEFT JOIN curricula t ON t.id = p.track_curriculum_id
         LEFT JOIN locations loc ON loc.id = p.location_id
        WHERE p.publication_status <> 'archived' AND (p.public_slug = $1 OR p.id = $1)
        LIMIT 1`,
      [slugOrId],
    ),
  );
  const row = [...rows][0];
  return row ? toProgram(row, defaults) : null;
}

/**
 * Site-wide defaults for signup wording, read once per render pass. A failure
 * here falls back to blanks rather than propagating: an offering with no
 * explanation paragraph is fine; an offering page that 500s is not.
 */
const offeringDefaults = cache(async (): Promise<OfferingDefaults> => {
  try {
    const { getGlobalSettings } = await import("@/lib/cms/read");
    const settings = await getGlobalSettings();
    return {
      registrationExplanation: settings.defaultRegistrationExplanation ?? "",
      interestListExplanation: settings.defaultInterestListExplanation ?? "",
      interestHref: INTEREST_LIST_HREF,
    };
  } catch {
    return FALLBACK_DEFAULTS;
  }
});

/* eslint-enable @typescript-eslint/no-explicit-any */
