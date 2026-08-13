/* ============================================================
 * Teaching materials — browser-safe types and the kind inference.
 *
 * A resource points at the real thing: the Slides that already exist in Google
 * Drive, the worksheet in Canva, the BOW simulation that Track 101 already
 * runs. BOW does not copy any of it. There is no file storage here and no
 * second copy to keep in sync.
 * ============================================================ */

export const RESOURCE_KINDS = [
  "slides",
  "document",
  "pdf",
  "worksheet",
  "video",
  "simulation",
  "website",
  "other",
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  slides: "Slides",
  document: "Document",
  pdf: "PDF",
  worksheet: "Worksheet",
  video: "Video",
  simulation: "Simulation",
  website: "Website",
  other: "Other",
};

export interface CourseResource {
  id: string;
  label: string;
  url: string;
  kind: ResourceKind;
  note: string | null;
  sort: number;
}

/**
 * What kind of thing a URL points at, when that can be told reliably.
 *
 * Only patterns that are actually unambiguous are claimed. Anything else comes
 * back as `website`, which the operator can correct — a wrong guess that looks
 * confident is worse than no guess, because nobody re-checks a filled field.
 */
export function inferResourceKind(rawUrl: string): ResourceKind {
  const url = (rawUrl ?? "").trim().toLowerCase();
  if (!url) return "other";

  // A BOW simulation is a BOW path, not an external host. Recognising it is
  // what lets a session point at the same experience Track 101 runs instead of
  // a copy of it.
  if (/^\/(simulation|simulation-room)\b/.test(url)) return "simulation";

  let host = "";
  let path = url;
  try {
    const parsed = new URL(url);
    host = parsed.hostname.replace(/^www\./, "");
    path = parsed.pathname;
  } catch {
    /* a relative path — host stays empty and the path checks still apply */
  }

  if (path.endsWith(".pdf")) return "pdf";
  if (host === "docs.google.com" && path.startsWith("/presentation")) return "slides";
  if (host === "docs.google.com" && path.startsWith("/document")) return "document";
  if (host === "docs.google.com" && path.startsWith("/spreadsheets")) return "worksheet";
  if (host === "docs.google.com" && path.startsWith("/forms")) return "worksheet";
  if (host === "slides.google.com") return "slides";
  if (host === "canva.com") return "slides";
  if (host === "youtube.com" || host === "youtu.be" || host === "vimeo.com") return "video";
  if (host === "drive.google.com") return "document";
  if (host.endsWith("bowsportscapital.com") && /^\/(simulation|simulation-room)\b/.test(path)) return "simulation";

  return "website";
}

/**
 * Only http(s) and BOW-relative links are ever rendered.
 *
 * Same rule the session meeting link follows: a resource is turned into an
 * `href` an operator clicks, so a `javascript:` URL typed into the field is a
 * hole rather than a formatting nit.
 */
export function safeResourceUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

export function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === "string" && (RESOURCE_KINDS as readonly string[]).includes(value);
}

/**
 * How a course is taught. Derived, never stored: a course that has authored
 * Learn lessons is digital, one with its own lesson list is instructor-led,
 * and one with both is genuinely both.
 */
export type CourseMode = "instructor_led" | "digital" | "hybrid" | "unplanned";

export const COURSE_MODE_LABEL: Record<CourseMode, string> = {
  instructor_led: "Taught live",
  digital: "Self-paced",
  hybrid: "Live + self-paced",
  unplanned: "No lessons yet",
};

export function resolveCourseMode(input: { learnLessonCount: number; ownLessonCount: number }): CourseMode {
  if (input.learnLessonCount > 0 && input.ownLessonCount > 0) return "hybrid";
  if (input.learnLessonCount > 0) return "digital";
  if (input.ownLessonCount > 0) return "instructor_led";
  return "unplanned";
}
