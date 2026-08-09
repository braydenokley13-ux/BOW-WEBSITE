/* ============================================================
 * Public read layer for site content.
 *
 * Everything here answers the same question — "what should a visitor see?" —
 * and answers it with published rows only. There is no argument that widens a
 * public read into a draft read: preview goes through `readDocument`'s
 * `preview` flag, which every caller can only reach after
 * `requirePreviewAccess()` has approved the request (lib/cms/preview.ts).
 *
 * Reads are memoized per render pass with React `cache`, so a page that shows
 * navigation, a footer, an announcement bar, and three sections still makes one
 * round trip per distinct query rather than one per component.
 *
 * Failures are translated, not swallowed: a missing table raises a
 * `schema_out_of_date` ContentError that the page renders as a specific state.
 * An *empty* result is never an error — it is an empty state, which is a
 * different thing and reads differently to a visitor.
 *
 * Server-only.
 * ============================================================ */

import "server-only";

import { cache } from "react";
import { sqlLearn } from "@/lib/db-sql";
import { ContentError, classifyError } from "@/lib/cms/errors";
import { toIsoDate } from "@/lib/cms/dates";
import {
  DEFAULT_FOOTER,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_NAV_MENU,
  parseSectionData,
  type FooterColumnsData,
  type GlobalSettingsData,
  type NavMenuData,
  type SectionKind,
} from "@/lib/cms/sections";

export const NAVIGATION_SLUG = "system-navigation";
export const FOOTER_SLUG = "system-footer";
export const SETTINGS_SLUG = "system-settings";

export interface PageSection {
  id: string;
  kind: SectionKind;
  ordinal: number;
  hidden: boolean;
  data: Record<string, unknown>;
}

export interface PageDocument {
  id: string;
  slug: string;
  kind: "page" | "track" | "program" | "system";
  path: string | null;
  name: string;
  entityId: string | null;
  status: "draft" | "published" | "archived";
  /** True when the caller is looking at the unpublished working copy. */
  isDraft: boolean;
  versionId: string;
  versionNo: number;
  title: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  socialImageUrl: string | null;
  noindex: boolean;
  updatedAt: number;
  sections: PageSection[];
}

export interface SiteFaq {
  id: string;
  question: string;
  answer: string;
}

export interface SiteAnnouncement {
  id: string;
  message: string;
  linkHref: string | null;
  linkLabel: string | null;
}

/** Wrap a database failure in the vocabulary the pages render. */
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

function rowToDocument(row: any, sections: any[], isDraft: boolean): PageDocument {
  return {
    id: String(row.id),
    slug: String(row.slug),
    kind: row.kind,
    path: row.path ?? null,
    name: String(row.name ?? row.slug),
    entityId: row.entity_id ?? null,
    status: row.status,
    isDraft,
    versionId: String(row.version_id),
    versionNo: Number(row.version_no) || 1,
    title: row.title ?? null,
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    socialImageUrl: row.social_image_url ?? null,
    noindex: Boolean(row.noindex),
    updatedAt: Number(row.updated_at) || 0,
    sections: sections
      .filter((section) => !section.hidden)
      .map((section) => ({
        id: String(section.id),
        kind: section.kind as SectionKind,
        ordinal: Number(section.ordinal) || 0,
        hidden: Boolean(section.hidden),
        data: parseSectionData(String(section.kind), section.data),
      })),
  };
}

/**
 * Load one document by slug.
 *
 * `preview: false` — the published version of a published page, or null.
 * `preview: true`  — the draft version if one exists, else the published one.
 *                    Callers must have passed `requirePreviewAccess()` first.
 */
const loadDocument = cache(async (slug: string, preview: boolean): Promise<PageDocument | null> => {
  return guarded(`page:${slug}`, async () => {
    // Two literal queries rather than one with interpolated SQL fragments: the
    // difference between a public read and a preview read is the single most
    // security-relevant line in this file, and it should be readable as such.
    const rows = preview
      ? await sqlLearn`
          SELECT p.id, p.slug, p.kind, p.path, p.name, p.entity_id, p.status, p.updated_at,
                 v.id AS version_id, v.version_no, v.state, v.title, v.seo_title, v.seo_description,
                 v.social_image_url, v.noindex
            FROM site_pages p
            JOIN site_page_versions v ON v.id = COALESCE(p.draft_version_id, p.published_version_id)
           WHERE p.slug = ${slug} AND p.status <> 'archived'
           LIMIT 1
        `
      : await sqlLearn`
          SELECT p.id, p.slug, p.kind, p.path, p.name, p.entity_id, p.status, p.updated_at,
                 v.id AS version_id, v.version_no, v.state, v.title, v.seo_title, v.seo_description,
                 v.social_image_url, v.noindex
            FROM site_pages p
            JOIN site_page_versions v ON v.id = p.published_version_id
           WHERE p.slug = ${slug} AND p.status = 'published' AND v.state = 'published'
           LIMIT 1
        `;
    const row = rows[0];
    if (!row) return null;

    const sections = await sqlLearn`
      SELECT id, kind, ordinal, hidden, data
        FROM site_page_sections
       WHERE version_id = ${row.version_id}
       ORDER BY ordinal ASC, id ASC
    `;
    return rowToDocument(row, [...sections], preview && row.state === "draft");
  });
});

export async function getPageDocument(
  slug: string,
  options: { preview?: boolean } = {},
): Promise<PageDocument | null> {
  return loadDocument(slug, options.preview === true);
}

/** Resolve a public route (`/about`) to its document. */
export const getDocumentForPath = cache(async (path: string, preview: boolean): Promise<PageDocument | null> => {
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const rows = await guarded(`path:${normalized}`, async () =>
    sqlLearn`SELECT slug FROM site_pages WHERE path = ${normalized} LIMIT 1`,
  );
  const slug = rows[0]?.slug;
  return slug ? loadDocument(String(slug), preview) : null;
});

/* ---------- singletons ---------- */

async function systemSection<T>(
  slug: string,
  kind: SectionKind,
  fallback: T,
  preview: boolean,
): Promise<T> {
  const document = await loadDocument(slug, preview);
  const section = document?.sections.find((entry) => entry.kind === kind);
  return (section ? (section.data as unknown as T) : fallback);
}

export async function getNavigation(options: { preview?: boolean } = {}): Promise<NavMenuData> {
  return systemSection(NAVIGATION_SLUG, "nav_menu", DEFAULT_NAV_MENU, options.preview === true);
}

export async function getFooterContent(options: { preview?: boolean } = {}): Promise<FooterColumnsData> {
  return systemSection(FOOTER_SLUG, "footer_columns", DEFAULT_FOOTER, options.preview === true);
}

export async function getGlobalSettings(options: { preview?: boolean } = {}): Promise<GlobalSettingsData> {
  return systemSection(SETTINGS_SLUG, "global_settings", DEFAULT_GLOBAL_SETTINGS, options.preview === true);
}

/**
 * Navigation, footer, and settings are needed by the layout on every request
 * and must never take the whole site down. A failure here degrades to the
 * built-in defaults — an unstyled-but-correct masthead beats a 500 — while
 * page bodies still surface their own specific error.
 */
export async function getChromeContent(preview: boolean): Promise<{
  navigation: NavMenuData;
  footer: FooterColumnsData;
  settings: GlobalSettingsData;
  degraded: boolean;
}> {
  try {
    const [navigation, footer, settings] = await Promise.all([
      getNavigation({ preview }),
      getFooterContent({ preview }),
      getGlobalSettings({ preview }),
    ]);
    return { navigation, footer, settings, degraded: false };
  } catch {
    return {
      navigation: DEFAULT_NAV_MENU,
      footer: DEFAULT_FOOTER,
      settings: DEFAULT_GLOBAL_SETTINGS,
      degraded: true,
    };
  }
}

/* ---------- FAQs ---------- */

export const getFaqsForScope = cache(
  async (scopeKind: "page" | "track" | "program", scopeKey: string): Promise<SiteFaq[]> => {
    const rows = await guarded(`faqs:${scopeKind}:${scopeKey}`, async () =>
      sqlLearn`
        SELECT f.id, f.question, f.answer
          FROM site_faq_placements pl
          JOIN site_faqs f ON f.id = pl.faq_id
         WHERE pl.scope_kind = ${scopeKind}
           AND pl.scope_key = ${scopeKey}
           AND f.status = 'published'
         ORDER BY pl.ordinal ASC, f.ordinal ASC, f.created_at ASC
      `,
    );
    return rows.map((row) => ({
      id: String(row.id),
      question: String(row.question),
      answer: String(row.answer),
    }));
  },
);

/* ---------- announcements ---------- */

/**
 * Live announcements for a page. The date window is evaluated in SQL against
 * `now()`, so an expired announcement stops appearing on its own without any
 * scheduled job — and without a stale render surviving in a cache, because
 * every public route here is request-rendered.
 */
export const getLiveAnnouncements = cache(async (pageSlug: string | null): Promise<SiteAnnouncement[]> => {
  const rows = await guarded("announcements", async () =>
    sqlLearn`
      SELECT id, message, link_href, link_label
        FROM site_announcements
       WHERE status = 'published'
         AND (starts_at IS NULL OR starts_at <= ${Date.now()})
         AND (ends_at IS NULL OR ends_at >= ${Date.now()})
         AND (placement = 'site' OR (placement = 'page' AND page_slug = ${pageSlug}))
       ORDER BY ordinal ASC, created_at DESC
    `,
  );
  return rows.map((row) => ({
    id: String(row.id),
    message: String(row.message),
    linkHref: row.link_href ?? null,
    linkLabel: row.link_label ?? null,
  }));
});

/**
 * The announcement bar shown in the site chrome. Like `getChromeContent`, a
 * failure here is silent: a broken announcement query must not remove the
 * navigation from every page on the site.
 */
export async function getChromeAnnouncements(pageSlug: string | null): Promise<SiteAnnouncement[]> {
  try {
    return await getLiveAnnouncements(pageSlug);
  } catch {
    return [];
  }
}

/* ---------- testimonials ---------- */

export interface PublicTestimonial {
  id: string;
  quote: string;
  attribution: string;
}

export const getPublicTestimonials = cache(async (limit: number): Promise<PublicTestimonial[]> => {
  const rows = await guarded("testimonials", async () =>
    sqlLearn`
      SELECT id, quote, student_name, school_name, track_completed
        FROM testimonials
       WHERE active = 1
       ORDER BY ordinal ASC, created_at ASC
       LIMIT ${Math.max(1, Math.min(limit || 3, 24))}
    `,
  );
  return rows.map((row) => ({
    id: String(row.id),
    quote: String(row.quote ?? ""),
    attribution: [row.student_name, row.school_name, row.track_completed ? `Track ${row.track_completed}` : ""]
      .filter((part) => typeof part === "string" && part.trim())
      .join(" · ")
      .toUpperCase(),
  }));
});

/* ---------- press coverage ---------- */

export interface PublicPublication {
  id: string;
  name: string;
  logoUrl: string;
  articleTitle: string;
  articleUrl: string;
  publicationDate: string;
}

export const getPublicPublications = cache(async (): Promise<PublicPublication[]> => {
  const rows = await guarded("press coverage", async () =>
    sqlLearn`
      SELECT id, name, logo_url, article_title, article_url, publication_date
        FROM site_publications
       WHERE status = 'published'
       ORDER BY ordinal ASC, publication_date DESC NULLS LAST, name ASC
    `,
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    logoUrl: String(row.logo_url ?? ""),
    articleTitle: String(row.article_title ?? ""),
    articleUrl: String(row.article_url ?? ""),
    publicationDate: toIsoDate(row.publication_date),
  }));
});

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ---------- route discovery (sitemap) ---------- */

export interface PublishedRoute {
  path: string;
  slug: string;
  kind: string;
}

/**
 * Every public URL that currently has published content behind it: pages,
 * tracks, and programs. Filtered in SQL so a draft or archived record has no
 * way to reach a sitemap or a crawler.
 */
export async function listPublishedRoutes(): Promise<PublishedRoute[]> {
  const [pages, programs] = await Promise.all([
    guarded("routes:pages", async () =>
      sqlLearn`
        SELECT path, slug, kind FROM site_pages
         WHERE status = 'published' AND published_version_id IS NOT NULL
           AND path IS NOT NULL AND kind IN ('page', 'system')
           AND cms_visible = true
      `,
    ),
    guarded("routes:programs", async () =>
      sqlLearn`SELECT public_slug FROM programs WHERE publication_status = 'published' AND public_slug IS NOT NULL`,
    ),
  ]);

  return [
    ...pages.map((row) => ({ path: String(row.path), slug: String(row.slug), kind: String(row.kind) })),
    ...programs.map((row) => ({ path: `/programs/p/${row.public_slug}`, slug: String(row.public_slug), kind: "program" })),
  ];
}
