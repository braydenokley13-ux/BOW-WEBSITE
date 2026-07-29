/* ============================================================
 * Section catalog — the constrained vocabulary of the site editor.
 *
 * Every public layout the site already renders is described here once: a
 * `kind`, the shape of its `data`, a safe default, and the label/help text the
 * founder sees. Public rendering, the editor form, and the database CHECK
 * constraint all read from this one list, so a new layout cannot be half-added.
 *
 * Two rules make this safe to put in front of a non-technical editor:
 *
 *   1. Nothing here is markup. A section carries words, links, and a small set
 *      of named choices ("tone: paper | ink | blue"); the React component owns
 *      every pixel. The founder cannot author spacing, colour, or CSS.
 *   2. Reads never throw. Each schema is `.catch()`-guarded field by field, so
 *      a row written by an older version of the editor — or hand-edited in the
 *      database — degrades to its default instead of taking a page down.
 *
 * Browser-safe: the editor imports this module directly.
 * ============================================================ */

import { z } from "zod";

/* ---------- shared leaf shapes ---------- */

export const TONES = ["paper", "white", "raised", "ink", "blue"] as const;
export type Tone = (typeof TONES)[number];
const tone = z.enum(TONES).catch("paper");

export const BUTTON_VARIANTS = ["primary", "secondary", "ink"] as const;

const text = (fallback = "") => z.string().catch(fallback);
const optionalText = z.string().nullish().transform((v) => v ?? "").catch("");
const flag = (fallback = false) => z.boolean().catch(fallback);
const count = (fallback = 0) => z.coerce.number().int().catch(fallback);

const action = z
  .object({
    label: text(),
    href: text("/"),
    variant: z.enum(BUTTON_VARIANTS).catch("primary"),
  })
  .catch({ label: "", href: "/", variant: "primary" as const });

const actions = z.array(action).catch([]);

const linkItem = z
  .object({ label: text(), href: text("/") })
  .catch({ label: "", href: "/" });

/* ---------- per-kind data schemas ---------- */

const heroData = z.object({
  eyebrow: optionalText,
  headline: text("Headline"),
  body: optionalText,
  note: optionalText,
  ghostText: optionalText,
  tone: tone,
  actions: actions,
});

const textData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
});

const featureCardsData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  columns: z.coerce.number().int().min(2).max(4).catch(3),
  groups: z
    .array(
      z.object({
        label: optionalText,
        cards: z
          .array(
            z.object({
              title: text(),
              body: optionalText,
              ctaLabel: optionalText,
              href: optionalText,
            }),
          )
          .catch([]),
      }),
    )
    .catch([]),
});

const statsData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  items: z
    .array(z.object({ value: text(), label: text() }))
    .catch([]),
});

const programCollectionData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  limit: count(0),
  featuredOnly: flag(false),
  /** Explicit picks win over `featuredOnly`/`limit` when non-empty. */
  programSlugs: z.array(z.string()).catch([]),
  showAllLabel: optionalText,
  showAllHref: optionalText,
  emptyHeadline: optionalText,
  emptyBody: optionalText,
  emptyActionLabel: optionalText,
  emptyActionHref: optionalText,
  /** Hide the whole section when nothing is open, rather than show an empty state. */
  hideWhenEmpty: flag(false),
});

const trackCollectionData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  trackSlugs: z.array(z.string()).catch([]),
  layout: z.enum(["compare", "grid"]).catch("compare"),
  emptyHeadline: optionalText,
  emptyBody: optionalText,
});

const testimonialsData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  limit: count(3),
});

const faqData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  emptyBody: optionalText,
});

const ctaData = z.object({
  eyebrow: optionalText,
  headline: text("Headline"),
  body: optionalText,
  ghostText: optionalText,
  tone: z.enum(TONES).catch("blue"),
  actions: actions,
});

const announcementData = z.object({
  source: z.enum(["live", "inline"]).catch("live"),
  message: optionalText,
  linkLabel: optionalText,
  linkHref: optionalText,
  tone: z.enum(TONES).catch("ink"),
});

const stepsData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  style: z.enum(["grid", "list", "spec"]).catch("grid"),
  items: z
    .array(
      z.object({
        number: optionalText,
        label: text(),
        body: optionalText,
        detail: optionalText,
        emphasis: flag(false),
      }),
    )
    .catch([]),
});

const imageTextData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  imageUrl: optionalText,
  imageAlt: optionalText,
  imagePosition: z.enum(["left", "right"]).catch("right"),
  actions: actions,
  bullets: z.array(z.string()).catch([]),
});

const contactData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  email: optionalText,
  phone: optionalText,
  location: optionalText,
  formIntro: optionalText,
  showForm: flag(true),
});

const listData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  style: z.enum(["chips", "rows", "numbered"]).catch("chips"),
  items: z.array(z.string()).catch([]),
});

const decisionDemoData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: z.enum(TONES).catch("ink"),
  desk: text("Decision Desk"),
  round: optionalText,
  prompt: text(""),
  primaryLabel: text("Make the Call"),
  meta: z.array(z.object({ label: text(), value: text() })).catch([]),
  facts: z
    .array(
      z.object({
        label: text(),
        value: text(),
        tone: z.enum(["neutral", "negative", "warning", "positive"]).catch("neutral"),
      }),
    )
    .catch([]),
  unknowns: z.array(z.string()).catch([]),
  options: z
    .array(z.object({ id: text(), label: text(), detail: optionalText }))
    .catch([]),
  outcomes: z
    .array(
      z.object({
        optionId: text(),
        status: z.enum(["positive", "warning", "negative"]).catch("warning"),
        headline: text(),
        body: optionalText,
      }),
    )
    .catch([]),
});

const mediaListData = z.object({
  eyebrow: optionalText,
  headline: optionalText,
  body: optionalText,
  tone: tone,
  actions: actions,
  items: z
    .array(
      z.object({
        tag: optionalText,
        kicker: optionalText,
        title: text(),
        meta: optionalText,
        href: optionalText,
      }),
    )
    .catch([]),
});

const navMenuData = z.object({
  items: z
    .array(
      z.object({
        label: text(),
        href: text("/"),
        visible: flag(true),
        children: z
          .array(z.object({ label: text(), href: text("/"), visible: flag(true) }))
          .catch([]),
      }),
    )
    .catch([]),
  signInLabel: text("Sign In"),
  signInHref: text("/sign-in"),
  primaryCtaLabel: optionalText,
  primaryCtaHref: optionalText,
  secondaryCtaLabel: optionalText,
  secondaryCtaHref: optionalText,
});

const footerColumnsData = z.object({
  description: optionalText,
  tagline: optionalText,
  columns: z
    .array(z.object({ heading: text(), links: z.array(linkItem).catch([]) }))
    .catch([]),
  contactText: optionalText,
  socialLinks: z.array(linkItem).catch([]),
  legalLinks: z.array(linkItem).catch([]),
  baseNote: optionalText,
});

const globalSettingsData = z.object({
  organizationName: text("BOW Sports Capital"),
  organizationDescription: optionalText,
  primaryAnnouncement: optionalText,
  primaryAnnouncementHref: optionalText,
  defaultSocialImage: text("/bow-social-preview.png"),
  supportEmail: optionalText,
  defaultRegistrationExplanation: optionalText,
  defaultInterestListExplanation: optionalText,
  defaultEmptyStateText: optionalText,
  seoTitlePattern: text("%s · BOW Sports Capital"),
  defaultSeoTitle: optionalText,
  defaultSeoDescription: optionalText,
  primaryCtaLabel: optionalText,
  primaryCtaHref: optionalText,
  contactEmail: optionalText,
  contactPhone: optionalText,
  contactLocation: optionalText,
});

/* ---------- the catalog ---------- */

export interface SectionKindSpec {
  kind: SectionKind;
  label: string;
  summary: string;
  /** System kinds back navigation/footer/settings and never appear in "add section". */
  system?: boolean;
  schema: z.ZodTypeAny;
  empty: () => Record<string, unknown>;
}

const SPECS = {
  hero: {
    label: "Hero",
    summary: "The opening statement: kicker, headline, short paragraph, and buttons.",
    schema: heroData,
    empty: () => ({ eyebrow: "", headline: "Headline", body: "", tone: "paper", actions: [] }),
  },
  text: {
    label: "Text section",
    summary: "A kicker, heading, and paragraph. The workhorse for explanation.",
    schema: textData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "paper" }),
  },
  feature_cards: {
    label: "Feature cards",
    summary: "A grid of titled cards, optionally split into labelled groups.",
    schema: featureCardsData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "paper", columns: 3, groups: [{ label: "", cards: [] }] }),
  },
  stats: {
    label: "Statistics",
    summary: "A row of big numbers with labels underneath.",
    schema: statsData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "ink", items: [] }),
  },
  program_collection: {
    label: "Program collection",
    summary: "Live program cards, pulled from the Programs you have published.",
    schema: programCollectionData,
    empty: () => ({ eyebrow: "", headline: "Upcoming programs", body: "", tone: "paper", limit: 3, featuredOnly: false, programSlugs: [], hideWhenEmpty: false }),
  },
  track_collection: {
    label: "Track collection",
    summary: "Published tracks, shown as a comparison or a grid.",
    schema: trackCollectionData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "raised", trackSlugs: [], layout: "compare" }),
  },
  testimonials: {
    label: "Testimonial",
    summary: "Approved quotes from the Testimonials list.",
    schema: testimonialsData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "ink", limit: 3 }),
  },
  faq: {
    label: "FAQ",
    summary: "The questions assigned to this page in the FAQs screen.",
    schema: faqData,
    empty: () => ({ eyebrow: "FAQ", headline: "What people want to know.", body: "", tone: "paper" }),
  },
  cta: {
    label: "Call to action",
    summary: "A closing block with a headline and buttons.",
    schema: ctaData,
    empty: () => ({ eyebrow: "", headline: "Headline", body: "", tone: "blue", actions: [] }),
  },
  announcement: {
    label: "Announcement",
    summary: "The live announcement bar, or a one-off message on this page only.",
    schema: announcementData,
    empty: () => ({ source: "live", message: "", linkLabel: "", linkHref: "", tone: "ink" }),
  },
  steps: {
    label: "Steps or process",
    summary: "Numbered beats — how something works, in order.",
    schema: stepsData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "paper", style: "grid", items: [] }),
  },
  image_text: {
    label: "Image and text",
    summary: "A picture beside a block of copy, with optional bullets and buttons.",
    schema: imageTextData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "white", imageUrl: "", imageAlt: "", imagePosition: "right", actions: [], bullets: [] }),
  },
  contact: {
    label: "Contact",
    summary: "How to reach BOW, with the contact form underneath.",
    schema: contactData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "paper", email: "", phone: "", location: "", formIntro: "", showForm: true }),
  },
  list: {
    label: "List",
    summary: "A run of short items — chips, rows, or a numbered list.",
    schema: listData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "paper", style: "chips", items: [] }),
  },
  decision_demo: {
    label: "Decision demo",
    summary: "The interactive front-office brief. All of its wording is editable.",
    schema: decisionDemoData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "ink", desk: "Decision Desk", round: "", prompt: "", primaryLabel: "Make the Call", meta: [], facts: [], unknowns: [], options: [], outcomes: [] }),
  },
  media_list: {
    label: "Linked list",
    summary: "Episodes, lessons, or articles as a ruled list of links.",
    schema: mediaListData,
    empty: () => ({ eyebrow: "", headline: "", body: "", tone: "raised", actions: [], items: [] }),
  },
  nav_menu: {
    label: "Navigation menu",
    summary: "Primary navigation links and the masthead buttons.",
    system: true,
    schema: navMenuData,
    empty: () => ({ items: [], signInLabel: "Sign In", signInHref: "/sign-in", primaryCtaLabel: "", primaryCtaHref: "", secondaryCtaLabel: "", secondaryCtaHref: "" }),
  },
  footer_columns: {
    label: "Footer",
    summary: "Footer description, link columns, contact, social, and legal links.",
    system: true,
    schema: footerColumnsData,
    empty: () => ({ description: "", tagline: "", columns: [], contactText: "", socialLinks: [], legalLinks: [], baseNote: "" }),
  },
  global_settings: {
    label: "Global settings",
    summary: "Content that appears across the whole site.",
    system: true,
    schema: globalSettingsData,
    empty: () => globalSettingsData.parse({}),
  },
} as const;

export type SectionKind = keyof typeof SPECS;

export const SECTION_KINDS = Object.keys(SPECS) as SectionKind[];

/** The kinds a founder can add to a page, in the order the picker shows them. */
export const AUTHORABLE_SECTION_KINDS: SectionKind[] = SECTION_KINDS.filter(
  (kind) => !("system" in SPECS[kind] && SPECS[kind].system),
);

export function sectionSpec(kind: SectionKind): SectionKindSpec {
  const spec = SPECS[kind];
  return { kind, label: spec.label, summary: spec.summary, system: "system" in spec ? spec.system : false, schema: spec.schema, empty: spec.empty };
}

export function isSectionKind(value: string): value is SectionKind {
  return Object.prototype.hasOwnProperty.call(SPECS, value);
}

/**
 * Parse stored section data. Never throws: unknown kinds and unparseable
 * payloads both resolve to the kind's empty shape, because a bad row must
 * degrade to a blank section rather than a 500 on a public page.
 */
export function parseSectionData(kind: string, raw: unknown): Record<string, unknown> {
  if (!isSectionKind(kind)) return {};
  const spec = SPECS[kind];
  const input = raw && typeof raw === "object" ? raw : {};
  const result = spec.schema.safeParse(input);
  return (result.success ? result.data : spec.empty()) as Record<string, unknown>;
}

/** Strict parse for writes — surfaces a real validation error to the editor. */
export function validateSectionData(kind: string, raw: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; message: string } {
  if (!isSectionKind(kind)) return { ok: false, message: `Unknown section type "${kind}".` };
  const result = SPECS[kind].schema.safeParse(raw && typeof raw === "object" ? raw : {});
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, message: first ? `${first.path.join(".") || "section"}: ${first.message}` : "That section could not be saved." };
  }
  return { ok: true, data: result.data as Record<string, unknown> };
}

/* ---------- typed views used by the renderers ---------- */

export type HeroData = z.infer<typeof heroData>;
export type TextData = z.infer<typeof textData>;
export type FeatureCardsData = z.infer<typeof featureCardsData>;
export type StatsData = z.infer<typeof statsData>;
export type ProgramCollectionData = z.infer<typeof programCollectionData>;
export type TrackCollectionData = z.infer<typeof trackCollectionData>;
export type TestimonialsData = z.infer<typeof testimonialsData>;
export type FaqSectionData = z.infer<typeof faqData>;
export type CtaData = z.infer<typeof ctaData>;
export type AnnouncementSectionData = z.infer<typeof announcementData>;
export type StepsData = z.infer<typeof stepsData>;
export type ImageTextData = z.infer<typeof imageTextData>;
export type ContactData = z.infer<typeof contactData>;
export type ListData = z.infer<typeof listData>;
export type DecisionDemoData = z.infer<typeof decisionDemoData>;
export type MediaListData = z.infer<typeof mediaListData>;
export type NavMenuData = z.infer<typeof navMenuData>;
export type FooterColumnsData = z.infer<typeof footerColumnsData>;
export type GlobalSettingsData = z.infer<typeof globalSettingsData>;

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettingsData = globalSettingsData.parse({});
export const DEFAULT_NAV_MENU: NavMenuData = navMenuData.parse({});
export const DEFAULT_FOOTER: FooterColumnsData = footerColumnsData.parse({});
