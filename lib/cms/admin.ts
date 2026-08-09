/* ============================================================
 * Founder-side content operations — every write to the site content system.
 *
 * Publishing model, in one paragraph: a document always has at most one
 * published version and at most one draft. Editing touches the draft only,
 * creating it as a copy of the published version on first edit. Publishing
 * points `published_version_id` at the draft, marks the old published version
 * `superseded`, and clears the draft pointer. Nothing is deleted, so
 * "restore the published version" is discarding a draft, and unpublishing is
 * flipping a status while the version history stays intact.
 *
 * Authorization is not optional here: every exported mutation calls
 * `requireWebsiteEditor()` as its first statement. Hiding a button in the UI is
 * not a control, and these functions are reachable as server actions.
 *
 * Server-only.
 * ============================================================ */

import "server-only";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { sqlLearn, withTransaction } from "@/lib/db-sql";
import { getCurrentUser } from "@/lib/dal";
import type { User } from "@/lib/account";
import { WEBSITE_EDITOR_ROLES } from "@/lib/cms/preview";
import {
  isSectionKind,
  parseSectionData,
  sectionSpec,
  validateSectionData,
  type SectionKind,
} from "@/lib/cms/sections";
import { isSafeEditorialImageUrl, validateEditorSectionData } from "@/lib/cms/validation";
import { isIsoCalendarDate, toIsoDate } from "@/lib/cms/dates";
import { editableVersionId, hasUnpublishedDraft } from "@/lib/cms/workflow";
import {
  PUBLICATION_STATUSES,
  REGISTRATION_STATUSES,
  toPublicationStatus,
  toRegistrationStatus,
  type PublicationStatus,
  type RegistrationStatus,
} from "@/lib/cms/status";

/* eslint-disable @typescript-eslint/no-explicit-any */

const now = () => Date.now();
const id = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12)}`;

/**
 * The authorization boundary for the whole Website area. Redirects rather than
 * throwing so a mis-navigated founder lands somewhere useful, and so a server
 * action invoked without a session can never fall through to a write.
 */
export async function requireWebsiteEditor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/app/website");
  if (!(WEBSITE_EDITOR_ROLES as readonly string[]).includes(user.role)) redirect("/app");
  return user;
}

export class ContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentValidationError";
  }
}

/* ------------------------------------------------------------
 * Pages
 * ---------------------------------------------------------- */

export interface AdminPageRow {
  id: string;
  slug: string;
  kind: "page" | "track" | "program" | "system";
  path: string | null;
  name: string;
  description: string;
  status: PublicationStatus;
  isSystem: boolean;
  cmsVisible: boolean;
  hasDraft: boolean;
  isPublished: boolean;
  publishedVersionNo: number | null;
  draftVersionNo: number | null;
  updatedAt: number;
  sectionCount: number;
}

function toAdminPageRow(row: any): AdminPageRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    kind: row.kind,
    path: row.path ?? null,
    name: String(row.name ?? row.slug),
    description: row.description ?? "",
    status: toPublicationStatus(row.status),
    isSystem: Boolean(row.is_system),
    cmsVisible: row.cms_visible === undefined ? true : Boolean(row.cms_visible),
    hasDraft: hasUnpublishedDraft(row.draft_version_id),
    isPublished: row.status === "published" && Boolean(row.published_version_id),
    publishedVersionNo: row.published_version_no === null || row.published_version_no === undefined ? null : Number(row.published_version_no),
    draftVersionNo: row.draft_version_no === null || row.draft_version_no === undefined ? null : Number(row.draft_version_no),
    updatedAt: Number(row.updated_at) || 0,
    sectionCount: Number(row.section_count) || 0,
  };
}

const PAGE_LIST_SELECT = `
  p.*,
  pv.version_no AS published_version_no,
  dv.version_no AS draft_version_no,
  (SELECT COUNT(*) FROM site_page_sections s
    WHERE s.version_id = COALESCE(p.draft_version_id, p.published_version_id)) AS section_count
`;

export async function listAdminPages(kind?: "page" | "track" | "program" | "system"): Promise<AdminPageRow[]> {
  await requireWebsiteEditor();
  const rows = kind
    ? await sqlLearn.unsafe(
        `SELECT ${PAGE_LIST_SELECT}
           FROM site_pages p
           LEFT JOIN site_page_versions pv ON pv.id = p.published_version_id
           LEFT JOIN site_page_versions dv ON dv.id = p.draft_version_id
          WHERE p.kind = $1
          ORDER BY p.ordinal ASC, p.name ASC`,
        [kind],
      )
    : await sqlLearn.unsafe(
        `SELECT ${PAGE_LIST_SELECT}
           FROM site_pages p
           LEFT JOIN site_page_versions pv ON pv.id = p.published_version_id
           LEFT JOIN site_page_versions dv ON dv.id = p.draft_version_id
          ORDER BY p.kind ASC, p.ordinal ASC, p.name ASC`,
      );
  return [...rows].map(toAdminPageRow);
}

export interface EditableSection {
  id: string;
  kind: SectionKind;
  ordinal: number;
  hidden: boolean;
  data: Record<string, unknown>;
}

export interface EditablePage {
  page: AdminPageRow;
  versionId: string;
  versionNo: number;
  editingDraft: boolean;
  title: string;
  seoTitle: string;
  seoDescription: string;
  socialImageUrl: string;
  noindex: boolean;
  sections: EditableSection[];
  publishedVersionNo: number | null;
  publishedAt: number | null;
}

async function loadPageRow(pageId: string): Promise<any> {
  const rows = await sqlLearn.unsafe(
    `SELECT ${PAGE_LIST_SELECT}
       FROM site_pages p
       LEFT JOIN site_page_versions pv ON pv.id = p.published_version_id
       LEFT JOIN site_page_versions dv ON dv.id = p.draft_version_id
      WHERE p.id = $1 OR p.slug = $1
      LIMIT 1`,
    [pageId],
  );
  return [...rows][0] ?? null;
}

/**
 * Load the current working copy without mutating anything.
 *
 * A published page with no draft returns its published version. The first
 * explicit Save Draft clones that version before writing. This keeps opening
 * an editor, generating metadata, and discarding a draft genuinely read-only.
 */
export async function getEditablePage(pageIdOrSlug: string): Promise<EditablePage | null> {
  await requireWebsiteEditor();
  const row = await loadPageRow(pageIdOrSlug);
  if (!row) return null;

  const versionId = editableVersionId(row.draft_version_id, row.published_version_id);
  if (!versionId) return null;
  const versionRows = await sqlLearn`
    SELECT v.*, pv.version_no AS published_no, pv.published_at AS published_at
      FROM site_page_versions v
      LEFT JOIN site_page_versions pv ON pv.id = ${row.published_version_id ?? null}
     WHERE v.id = ${versionId}
     LIMIT 1
  `;
  const version = versionRows[0];
  if (!version) return null;

  const sections = await sqlLearn`
    SELECT id, kind, ordinal, hidden, data
      FROM site_page_sections
     WHERE version_id = ${version.id}
     ORDER BY ordinal ASC, id ASC
  `;

  return {
    page: toAdminPageRow(row),
    versionId: String(version.id),
    versionNo: Number(version.version_no) || 1,
    editingDraft: version.state === "draft",
    title: version.title ?? "",
    seoTitle: version.seo_title ?? "",
    seoDescription: version.seo_description ?? "",
    socialImageUrl: version.social_image_url ?? "",
    noindex: Boolean(version.noindex),
    publishedVersionNo: version.published_no === null || version.published_no === undefined ? null : Number(version.published_no),
    publishedAt: version.published_at === null || version.published_at === undefined ? null : Number(version.published_at),
    sections: [...sections].map((section) => ({
      id: String(section.id),
      kind: section.kind as SectionKind,
      ordinal: Number(section.ordinal) || 0,
      hidden: Boolean(section.hidden),
      data: parseSectionData(String(section.kind), section.data),
    })),
  };
}

/** Clone the published version (or start empty) into a new draft. */
async function createDraftFrom(pageId: string, userId: string): Promise<string> {
  return withTransaction(async (tx) => {
    const pages = await tx`SELECT * FROM site_pages WHERE id = ${pageId} FOR UPDATE`;
    const page = pages[0];
    if (!page) throw new ContentValidationError("That page no longer exists.");
    if (page.draft_version_id) return String(page.draft_version_id);

    const maxRows = await tx`SELECT COALESCE(MAX(version_no), 0) AS n FROM site_page_versions WHERE page_id = ${pageId}`;
    const nextNo = (Number(maxRows[0]?.n) || 0) + 1;
    const draftId = id("spv");
    const source = page.published_version_id
      ? (await tx`SELECT * FROM site_page_versions WHERE id = ${page.published_version_id}`)[0]
      : null;

    await tx`
      INSERT INTO site_page_versions (id, page_id, version_no, state, title, seo_title, seo_description, social_image_url, noindex, created_at, created_by_user_id)
      VALUES (${draftId}, ${pageId}, ${nextNo}, 'draft', ${source?.title ?? null}, ${source?.seo_title ?? null},
              ${source?.seo_description ?? null}, ${source?.social_image_url ?? null}, ${source?.noindex ?? false},
              ${now()}, ${userId})
    `;

    if (source) {
      await tx`
        INSERT INTO site_page_sections (id, version_id, kind, ordinal, hidden, data, created_at, updated_at)
        SELECT 'sps-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), ${draftId}, s.kind, s.ordinal, s.hidden, s.data, ${now()}, ${now()}
          FROM site_page_sections s
         WHERE s.version_id = ${source.id}
      `;
    }

    await tx`UPDATE site_pages SET draft_version_id = ${draftId}, updated_at = ${now()}, updated_by_user_id = ${userId} WHERE id = ${pageId}`;
    return draftId;
  });
}

async function ensureDraftId(pageId: string, userId: string): Promise<string> {
  const rows = await sqlLearn`SELECT draft_version_id FROM site_pages WHERE id = ${pageId} LIMIT 1`;
  if (!rows[0]) throw new ContentValidationError("That page no longer exists.");
  return rows[0].draft_version_id ? String(rows[0].draft_version_id) : createDraftFrom(pageId, userId);
}

export interface PageDraftInput {
  meta: {
    name: string;
    seoTitle: string;
    seoDescription: string;
    socialImageUrl: string;
    noindex: boolean;
  };
  sections: {
    ordinal: number;
    kind: SectionKind;
    data: Record<string, unknown>;
  }[];
}

/**
 * Save every editable field in one explicit operation.
 *
 * The first save creates the draft; merely opening the editor never does. A
 * direct Server Action request cannot change the page structure because the
 * submitted section count, order, and kinds must exactly match the current
 * code-backed document before any content is written.
 */
export async function savePageDraft(pageId: string, input: PageDraftInput): Promise<void> {
  const user = await requireWebsiteEditor();
  const meta = input?.meta;
  if (!meta || typeof meta !== "object") throw new ContentValidationError("The page details are missing.");
  if (typeof meta.name !== "string" || !meta.name.trim()) throw new ContentValidationError("Page name cannot be empty.");
  if (typeof meta.seoTitle !== "string" || typeof meta.seoDescription !== "string" || typeof meta.socialImageUrl !== "string") {
    throw new ContentValidationError("The page’s search and sharing fields must contain text.");
  }
  if (typeof meta.noindex !== "boolean") throw new ContentValidationError("The search visibility choice is invalid.");
  if (!isSafeEditorialImageUrl(meta.socialImageUrl)) {
    throw new ContentValidationError("Sharing image must be a site path or a complete http(s) web address.");
  }
  if (!Array.isArray(input.sections)) throw new ContentValidationError("The page sections are missing.");

  const draftId = await ensureDraftId(pageId, user.id);
  await withTransaction(async (tx) => {
    const storedRows = await tx`
      SELECT id, kind, ordinal
        FROM site_page_sections
       WHERE version_id = ${draftId}
       ORDER BY ordinal ASC, id ASC
       FOR UPDATE
    `;
    const stored = [...storedRows];
    if (stored.length !== input.sections.length) {
      throw new ContentValidationError("This page’s section structure changed. Reload the editor before saving.");
    }

    const byOrdinal = new Map(stored.map((section) => [Number(section.ordinal), section]));
    const seen = new Set<number>();
    const updates: { id: string; data: Record<string, unknown> }[] = [];

    for (const section of input.sections) {
      if (!section || typeof section !== "object" || !Number.isInteger(section.ordinal) || seen.has(section.ordinal)) {
        throw new ContentValidationError("This page’s section order is invalid. Reload the editor before saving.");
      }
      seen.add(section.ordinal);
      const storedSection = byOrdinal.get(section.ordinal);
      if (!storedSection || storedSection.kind !== section.kind) {
        throw new ContentValidationError("This page’s section structure changed. Reload the editor before saving.");
      }
      const validated = validateEditorSectionData(section.kind, section.data);
      if (!validated.ok) {
        throw new ContentValidationError(`${sectionSpec(section.kind).label}: ${validated.message}`);
      }
      updates.push({ id: String(storedSection.id), data: validated.data });
    }

    for (const update of updates) {
      await tx`
        UPDATE site_page_sections
           SET data = ${tx.json(update.data as never)}, updated_at = ${now()}
         WHERE id = ${update.id} AND version_id = ${draftId}
      `;
    }
    await tx`
      UPDATE site_page_versions
         SET seo_title = ${meta.seoTitle.trim() || null},
             seo_description = ${meta.seoDescription.trim() || null},
             social_image_url = ${meta.socialImageUrl.trim() || null},
             noindex = ${meta.noindex}
       WHERE id = ${draftId}
    `;
    await tx`
      UPDATE site_pages
         SET name = ${meta.name.trim()}, updated_at = ${now()}, updated_by_user_id = ${user.id}
       WHERE id = ${pageId}
    `;
  });
}

export async function addSection(pageId: string, kind: string, atIndex?: number): Promise<string> {
  const user = await requireWebsiteEditor();
  if (!isSectionKind(kind)) throw new ContentValidationError("That section type doesn’t exist.");
  const draftId = await ensureDraftId(pageId, user.id);
  const spec = sectionSpec(kind);
  const sectionId = id("sps");

  await withTransaction(async (tx) => {
    const rows = await tx`SELECT id, ordinal FROM site_page_sections WHERE version_id = ${draftId} ORDER BY ordinal ASC`;
    const list = [...rows];
    const target = atIndex === undefined || atIndex < 0 || atIndex > list.length ? list.length : atIndex;
    await tx`
      INSERT INTO site_page_sections (id, version_id, kind, ordinal, hidden, data, created_at, updated_at)
      VALUES (${sectionId}, ${draftId}, ${kind}, ${target}, false, ${tx.json(spec.empty() as never)}, ${now()}, ${now()})
    `;
    for (let index = target; index < list.length; index += 1) {
      await tx`UPDATE site_page_sections SET ordinal = ${index + 1}, updated_at = ${now()} WHERE id = ${list[index].id}`;
    }
    await tx`UPDATE site_pages SET updated_at = ${now()}, updated_by_user_id = ${user.id} WHERE id = ${pageId}`;
  });
  return sectionId;
}

export async function saveSection(pageId: string, sectionId: string, data: unknown): Promise<void> {
  const user = await requireWebsiteEditor();
  const draftId = await ensureDraftId(pageId, user.id);
  const rows = await sqlLearn`SELECT kind FROM site_page_sections WHERE id = ${sectionId} AND version_id = ${draftId} LIMIT 1`;
  const kind = rows[0]?.kind;
  if (!kind) throw new ContentValidationError("That section is no longer part of this draft.");

  const validated = validateEditorSectionData(String(kind), data);
  if (!validated.ok) throw new ContentValidationError(validated.message);

  await sqlLearn`
    UPDATE site_page_sections SET data = ${sqlLearn.json(validated.data as never)}, updated_at = ${now()}
     WHERE id = ${sectionId} AND version_id = ${draftId}
  `;
  await sqlLearn`UPDATE site_pages SET updated_at = ${now()}, updated_by_user_id = ${user.id} WHERE id = ${pageId}`;
}

export async function setSectionHidden(pageId: string, sectionId: string, hidden: boolean): Promise<void> {
  const user = await requireWebsiteEditor();
  const draftId = await ensureDraftId(pageId, user.id);
  await sqlLearn`UPDATE site_page_sections SET hidden = ${hidden}, updated_at = ${now()} WHERE id = ${sectionId} AND version_id = ${draftId}`;
  await sqlLearn`UPDATE site_pages SET updated_at = ${now()}, updated_by_user_id = ${user.id} WHERE id = ${pageId}`;
}

export async function removeSection(pageId: string, sectionId: string): Promise<void> {
  const user = await requireWebsiteEditor();
  const draftId = await ensureDraftId(pageId, user.id);
  await withTransaction(async (tx) => {
    await tx`DELETE FROM site_page_sections WHERE id = ${sectionId} AND version_id = ${draftId}`;
    const rows = await tx`SELECT id FROM site_page_sections WHERE version_id = ${draftId} ORDER BY ordinal ASC, id ASC`;
    const list = [...rows];
    for (let index = 0; index < list.length; index += 1) {
      await tx`UPDATE site_page_sections SET ordinal = ${index} WHERE id = ${list[index].id}`;
    }
    await tx`UPDATE site_pages SET updated_at = ${now()}, updated_by_user_id = ${user.id} WHERE id = ${pageId}`;
  });
}

export async function moveSection(pageId: string, sectionId: string, direction: "up" | "down"): Promise<void> {
  const user = await requireWebsiteEditor();
  const draftId = await ensureDraftId(pageId, user.id);
  await withTransaction(async (tx) => {
    const rows = await tx`SELECT id FROM site_page_sections WHERE version_id = ${draftId} ORDER BY ordinal ASC, id ASC`;
    const list = [...rows].map((row) => String(row.id));
    const from = list.indexOf(sectionId);
    if (from === -1) return;
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    for (let index = 0; index < list.length; index += 1) {
      await tx`UPDATE site_page_sections SET ordinal = ${index}, updated_at = ${now()} WHERE id = ${list[index]}`;
    }
    await tx`UPDATE site_pages SET updated_at = ${now()}, updated_by_user_id = ${user.id} WHERE id = ${pageId}`;
  });
}

/* ---------- publishing ---------- */

/**
 * Refuse to publish content that is obviously unfinished.
 *
 * The bar is deliberately low — a missing optional paragraph is fine — but a
 * page with nothing on it, a button with no destination, or a hero with no
 * headline are all mistakes a founder would want caught before a visitor sees
 * them. Internal links are checked against the routes that actually exist.
 */
export async function validateForPublish(pageId: string): Promise<string[]> {
  await requireWebsiteEditor();
  const editable = await getEditablePage(pageId);
  if (!editable) return ["That page no longer exists."];

  const problems: string[] = [];
  const visible = editable.sections.filter((section) => !section.hidden);
  if (visible.length === 0) problems.push("This page has no visible sections yet.");

  const known = await knownInternalPaths();
  const checkHref = (href: unknown, where: string) => {
    const value = typeof href === "string" ? href.trim() : "";
    if (!value) return;
    if (!value.startsWith("/")) return; // external and anchor links are the author's call
    const path = value.split(/[?#]/, 1)[0] || "/";
    if (!known.has(path.length > 1 ? path.replace(/\/+$/, "") : path)) {
      problems.push(`${where} links to ${value}, which isn’t a page on this site.`);
    }
  };

  // Section payloads are heterogeneous — `columns` is a count on feature cards
  // and a list of link columns in the footer, `items` is a list of strings on a
  // list section and a list of objects on a linked list. Walking the payload
  // generically, and only ever iterating things that really are arrays, is what
  // keeps this check from throwing on a shape it did not anticipate.
  const rows = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object") : [];

  for (const section of visible) {
    const spec = sectionSpec(section.kind);
    const parsed = validateSectionData(section.kind, section.data);
    if (!parsed.ok) {
      problems.push(`${spec.label}: ${parsed.message}`);
      continue;
    }
    const data = parsed.data as Record<string, unknown>;

    if ((section.kind === "hero" || section.kind === "cta") && !String(data.headline ?? "").trim()) {
      problems.push(`${spec.label} needs a headline.`);
    }

    for (const action of rows(data.actions)) {
      const label = String(action.label ?? "").trim();
      const href = String(action.href ?? "").trim();
      if (!label && !href) continue;
      if (!label) problems.push(`${spec.label} has a button with no words on it.`);
      if (!href) problems.push(`${spec.label}: the “${label}” button has no destination.`);
      checkHref(href, `${spec.label}: the “${label || "unnamed"}” button`);
    }

    // Every remaining destination, wherever it sits in the payload.
    for (const entry of rows(data.items)) {
      checkHref(entry.href, `${spec.label}: “${String(entry.title ?? entry.label ?? "item")}”`);
      for (const child of rows(entry.children)) {
        checkHref(child.href, `${spec.label}: “${String(child.label ?? "link")}”`);
      }
    }
    for (const group of rows(data.groups)) {
      for (const card of rows(group.cards)) {
        checkHref(card.href, `${spec.label}: “${String(card.title ?? "card")}”`);
      }
    }
    for (const column of rows(data.columns)) {
      for (const link of rows(column.links)) {
        checkHref(link.href, `${spec.label}: “${String(link.label ?? "link")}”`);
      }
    }
    for (const link of [...rows(data.legalLinks), ...rows(data.socialLinks)]) {
      checkHref(link.href, `${spec.label}: “${String(link.label ?? "link")}”`);
    }
    checkHref(data.showAllHref, `${spec.label}: the “see all” button`);
    checkHref(data.emptyActionHref, `${spec.label}: the empty-state button`);
    checkHref(data.linkHref, `${spec.label}: its link`);
    checkHref(data.ctaHref, `${spec.label}: its button`);
    checkHref(data.signInHref, `${spec.label}: the sign-in link`);
    checkHref(data.primaryCtaHref, `${spec.label}: the main button`);
    checkHref(data.secondaryCtaHref, `${spec.label}: the second button`);
  }

  return problems;
}

/**
 * Every internal destination a link may point at: the site's own hand-built
 * routes plus whatever documents exist right now. Built fresh per call so a
 * page published a minute ago is immediately a valid link target.
 */
async function knownInternalPaths(): Promise<Set<string>> {
  const paths = new Set<string>(STATIC_ROUTES);
  const pages = await sqlLearn`SELECT path FROM site_pages WHERE path IS NOT NULL`;
  for (const row of pages) if (row.path) paths.add(String(row.path));
  const tracks = await sqlLearn`SELECT public_slug FROM curricula WHERE public_slug IS NOT NULL`;
  for (const row of tracks) paths.add(`/programs/${row.public_slug}`);
  const programs = await sqlLearn`SELECT id, public_slug FROM programs WHERE publication_status <> 'archived'`;
  for (const row of programs) {
    if (row.public_slug) paths.add(`/programs/p/${row.public_slug}`);
    paths.add(`/programs/p/${row.id}`);
    paths.add(`/programs/register/${row.id}`);
  }
  return paths;
}

/** Routes that exist as files rather than as content documents. */
const STATIC_ROUTES = [
  "/", "/programs", "/programs/find", "/programs/register", "/partner-with-bow", "/get-involved", "/get-involved/apply",
  "/get-involved/camps", "/get-involved/families", "/get-involved/partner-inquiry", "/get-involved/partners",
  "/get-involved/schools", "/get-involved/youth-organizations", "/about", "/contact", "/teach", "/news",
  "/podcast", "/glossary", "/standards", "/lessons", "/simulation", "/concept-map", "/highway-world",
  "/analytics", "/analytics/desk", "/analytics/articles", "/analytics/players", "/analytics/teams",
  "/analytics/questions", "/analytics/ledger", "/analytics/methods", "/analytics/notebook", "/analytics/trade",
  "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/join", "/app", "/dashboard",
];

export async function publishPage(pageId: string): Promise<{ ok: true } | { ok: false; problems: string[] }> {
  const user = await requireWebsiteEditor();
  const problems = await validateForPublish(pageId);
  if (problems.length > 0) return { ok: false, problems };

  await withTransaction(async (tx) => {
    const pages = await tx`SELECT * FROM site_pages WHERE id = ${pageId} FOR UPDATE`;
    const page = pages[0];
    if (!page) throw new ContentValidationError("That page no longer exists.");

    const draftId = page.draft_version_id;
    if (!draftId) {
      // Nothing new to promote — just make the existing published version live.
      await tx`UPDATE site_pages SET status = 'published', updated_at = ${now()}, updated_by_user_id = ${user.id} WHERE id = ${pageId}`;
      return;
    }

    if (page.published_version_id) {
      await tx`UPDATE site_page_versions SET state = 'superseded' WHERE id = ${page.published_version_id}`;
    }
    await tx`
      UPDATE site_page_versions
         SET state = 'published', published_at = ${now()}, published_by_user_id = ${user.id}
       WHERE id = ${draftId}
    `;
    await tx`
      UPDATE site_pages
         SET status = 'published', published_version_id = ${draftId}, draft_version_id = NULL,
             updated_at = ${now()}, updated_by_user_id = ${user.id}
       WHERE id = ${pageId}
    `;
  });
  return { ok: true };
}

/** Take a page off the public site without touching its history. */
export async function unpublishPage(pageId: string): Promise<void> {
  const user = await requireWebsiteEditor();
  await sqlLearn`
    UPDATE site_pages SET status = 'draft', updated_at = ${now()}, updated_by_user_id = ${user.id}
     WHERE id = ${pageId} AND is_system = false
  `;
}

export async function archivePage(pageId: string): Promise<void> {
  const user = await requireWebsiteEditor();
  await sqlLearn`
    UPDATE site_pages SET status = 'archived', updated_at = ${now()}, updated_by_user_id = ${user.id}
     WHERE id = ${pageId} AND is_system = false
  `;
}

/**
 * Throw the draft away and go back to exactly what the public is seeing. The
 * published version is never modified by editing, so this is a delete of the
 * working copy rather than a restore from a snapshot.
 */
export async function discardDraft(pageId: string): Promise<void> {
  const user = await requireWebsiteEditor();
  await withTransaction(async (tx) => {
    const pages = await tx`SELECT draft_version_id, published_version_id FROM site_pages WHERE id = ${pageId} FOR UPDATE`;
    const page = pages[0];
    if (!page?.draft_version_id) return;
    if (!page.published_version_id) {
      throw new ContentValidationError("This page has never been published, so there’s nothing to go back to yet.");
    }
    await tx`UPDATE site_pages SET draft_version_id = NULL, updated_at = ${now()}, updated_by_user_id = ${user.id} WHERE id = ${pageId}`;
    await tx`DELETE FROM site_page_versions WHERE id = ${page.draft_version_id}`;
  });
}

/** Roll back to a specific earlier version by copying it into a fresh draft. */
export async function restoreVersion(pageId: string, versionId: string): Promise<void> {
  const user = await requireWebsiteEditor();
  await withTransaction(async (tx) => {
    const pages = await tx`SELECT * FROM site_pages WHERE id = ${pageId} FOR UPDATE`;
    const page = pages[0];
    if (!page) throw new ContentValidationError("That page no longer exists.");
    const sources = await tx`SELECT * FROM site_page_versions WHERE id = ${versionId} AND page_id = ${pageId} LIMIT 1`;
    const source = sources[0];
    if (!source) throw new ContentValidationError("That version belongs to a different page.");

    if (page.draft_version_id) {
      await tx`DELETE FROM site_page_versions WHERE id = ${page.draft_version_id}`;
    }
    const maxRows = await tx`SELECT COALESCE(MAX(version_no), 0) AS n FROM site_page_versions WHERE page_id = ${pageId}`;
    const draftId = id("spv");
    await tx`
      INSERT INTO site_page_versions (id, page_id, version_no, state, title, seo_title, seo_description, social_image_url, noindex, note, created_at, created_by_user_id)
      VALUES (${draftId}, ${pageId}, ${(Number(maxRows[0]?.n) || 0) + 1}, 'draft', ${source.title}, ${source.seo_title},
              ${source.seo_description}, ${source.social_image_url}, ${source.noindex},
              ${`Restored from v${source.version_no}`}, ${now()}, ${user.id})
    `;
    await tx`
      INSERT INTO site_page_sections (id, version_id, kind, ordinal, hidden, data, created_at, updated_at)
      SELECT 'sps-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), ${draftId}, s.kind, s.ordinal, s.hidden, s.data, ${now()}, ${now()}
        FROM site_page_sections s WHERE s.version_id = ${versionId}
    `;
    await tx`UPDATE site_pages SET draft_version_id = ${draftId}, updated_at = ${now()}, updated_by_user_id = ${user.id} WHERE id = ${pageId}`;
  });
}

export interface VersionRow {
  id: string;
  versionNo: number;
  state: "draft" | "published" | "superseded";
  createdAt: number;
  publishedAt: number | null;
  note: string;
}

export async function listVersions(pageId: string): Promise<VersionRow[]> {
  await requireWebsiteEditor();
  const rows = await sqlLearn`
    SELECT id, version_no, state, created_at, published_at, note
      FROM site_page_versions WHERE page_id = ${pageId}
     ORDER BY version_no DESC LIMIT 25
  `;
  return [...rows].map((row) => ({
    id: String(row.id),
    versionNo: Number(row.version_no) || 0,
    state: row.state,
    createdAt: Number(row.created_at) || 0,
    publishedAt: row.published_at === null || row.published_at === undefined ? null : Number(row.published_at),
    note: row.note ?? "",
  }));
}

/* ------------------------------------------------------------
 * Tracks (the public face of `curricula`)
 * ---------------------------------------------------------- */

export interface AdminTrackRow {
  id: string;
  slug: string;
  title: string;
  internalTitle: string;
  gradeRange: string;
  publicationStatus: PublicationStatus;
  featured: boolean;
  displayOrder: number;
  updatedAt: number;
  pageId: string | null;
}

export async function listAdminTracks(): Promise<AdminTrackRow[]> {
  await requireWebsiteEditor();
  const rows = await sqlLearn`
    SELECT c.*, p.id AS page_id
      FROM curricula c
      LEFT JOIN site_pages p ON p.kind = 'track' AND p.entity_id = c.id
     WHERE c.public_slug IS NOT NULL
     ORDER BY c.display_order ASC, c.title ASC
  `;
  return [...rows].map((row) => ({
    id: String(row.id),
    slug: row.public_slug ?? "",
    title: row.public_title ?? row.title ?? "",
    internalTitle: row.title ?? "",
    gradeRange: row.grade_range ?? row.age_range ?? "",
    publicationStatus: toPublicationStatus(row.publication_status),
    featured: Boolean(row.featured),
    displayOrder: Number(row.display_order) || 0,
    updatedAt: Number(row.updated_at) || 0,
    pageId: row.page_id ?? null,
  }));
}

export interface TrackInput {
  publicTitle: string;
  internalTitle: string;
  slug: string;
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
  seoTitle: string;
  seoDescription: string;
  socialImageUrl: string;
  featured: boolean;
  displayOrder: number;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

export async function getAdminTrack(trackId: string): Promise<(TrackInput & { id: string; publicationStatus: PublicationStatus; pageId: string | null }) | null> {
  await requireWebsiteEditor();
  const rows = await sqlLearn`
    SELECT c.*, p.id AS page_id FROM curricula c
      LEFT JOIN site_pages p ON p.kind = 'track' AND p.entity_id = c.id
     WHERE c.id = ${trackId} LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    publicTitle: row.public_title ?? "",
    internalTitle: row.title ?? "",
    slug: row.public_slug ?? "",
    kicker: row.public_kicker ?? "",
    headline: row.headline ?? "",
    shortDescription: row.short_description ?? "",
    longDescription: row.long_description ?? "",
    gradeRange: row.grade_range ?? "",
    audience: row.audience ?? "",
    curriculumSummary: row.curriculum_summary ?? "",
    studentExperience: row.student_experience ?? "",
    imageUrl: row.image_url ?? "",
    badgeLabel: row.badge_label ?? "",
    ctaLabel: row.cta_label ?? "",
    ctaHref: row.cta_href ?? "",
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    socialImageUrl: row.social_image_url ?? "",
    featured: Boolean(row.featured),
    displayOrder: Number(row.display_order) || 0,
    publicationStatus: toPublicationStatus(row.publication_status),
    pageId: row.page_id ?? null,
  };
}

export async function createTrack(input: Pick<TrackInput, "publicTitle" | "slug">): Promise<string> {
  const user = await requireWebsiteEditor();
  const slug = slugify(input.slug || input.publicTitle);
  if (!slug) throw new ContentValidationError("A track needs a name.");
  const clash = await sqlLearn`SELECT 1 FROM curricula WHERE public_slug = ${slug} LIMIT 1`;
  if (clash.length > 0) throw new ContentValidationError(`The address /programs/${slug} is already taken.`);

  const trackId = id("crc");
  await withTransaction(async (tx) => {
    await tx`
      INSERT INTO curricula (id, title, description, published, created_at, updated_at,
                             public_slug, public_title, publication_status, display_order)
      VALUES (${trackId}, ${input.publicTitle}, ${""}, 0, ${now()}, ${now()},
              ${slug}, ${input.publicTitle}, 'draft',
              ${(await nextTrackOrder(tx))})
    `;
    await insertDocument(tx, {
      id: id("spg"),
      kind: "track",
      slug: `track-${slug}`,
      path: `/programs/${slug}`,
      name: input.publicTitle,
      entityId: trackId,
      userId: user.id,
    });
  });
  return trackId;
}

async function nextTrackOrder(tx: any): Promise<number> {
  const rows = await tx`SELECT COALESCE(MAX(display_order), 0) AS n FROM curricula`;
  return (Number(rows[0]?.n) || 0) + 1;
}

export async function saveTrack(trackId: string, input: TrackInput): Promise<void> {
  await requireWebsiteEditor();
  const slug = slugify(input.slug);
  if (!slug) throw new ContentValidationError("A track needs a web address.");
  if (!input.publicTitle.trim()) throw new ContentValidationError("A track needs a public title.");
  const clash = await sqlLearn`SELECT 1 FROM curricula WHERE public_slug = ${slug} AND id <> ${trackId} LIMIT 1`;
  if (clash.length > 0) throw new ContentValidationError(`The address /programs/${slug} is already taken.`);

  await withTransaction(async (tx) => {
    await tx`
      UPDATE curricula SET
        public_slug = ${slug}, public_title = ${input.publicTitle}, title = ${input.internalTitle || input.publicTitle},
        public_kicker = ${input.kicker}, headline = ${input.headline},
        short_description = ${input.shortDescription}, long_description = ${input.longDescription},
        grade_range = ${input.gradeRange}, audience = ${input.audience},
        curriculum_summary = ${input.curriculumSummary}, student_experience = ${input.studentExperience},
        image_url = ${input.imageUrl}, badge_label = ${input.badgeLabel},
        cta_label = ${input.ctaLabel}, cta_href = ${input.ctaHref},
        seo_title = ${input.seoTitle}, seo_description = ${input.seoDescription},
        social_image_url = ${input.socialImageUrl},
        featured = ${input.featured}, display_order = ${input.displayOrder},
        updated_at = ${now()}
      WHERE id = ${trackId}
    `;
    await tx`
      UPDATE site_pages SET path = ${`/programs/${slug}`}, name = ${input.publicTitle}, updated_at = ${now()}
       WHERE kind = 'track' AND entity_id = ${trackId}
    `;
  });
}

export async function setTrackPublication(trackId: string, status: PublicationStatus): Promise<void> {
  await requireWebsiteEditor();
  if (!PUBLICATION_STATUSES.includes(status)) throw new ContentValidationError("Unknown status.");
  const rows = await sqlLearn`SELECT public_slug, public_title FROM curricula WHERE id = ${trackId} LIMIT 1`;
  const row = rows[0];
  if (!row) throw new ContentValidationError("That track no longer exists.");
  if (status === "published" && (!row.public_slug || !row.public_title)) {
    throw new ContentValidationError("Give the track a public title and web address before publishing it.");
  }
  await sqlLearn`UPDATE curricula SET publication_status = ${status}, updated_at = ${now()} WHERE id = ${trackId}`;
}

/* ------------------------------------------------------------
 * Programs — public content and lifecycle
 * ---------------------------------------------------------- */

export interface AdminProgramRow {
  id: string;
  slug: string;
  title: string;
  internalName: string;
  publicationStatus: PublicationStatus;
  registrationStatus: RegistrationStatus;
  featured: boolean;
  displayOrder: number;
  startDate: string | null;
  capacity: number | null;
  updatedAt: number;
  pageId: string | null;
}

export async function listAdminPrograms(): Promise<AdminProgramRow[]> {
  await requireWebsiteEditor();
  const rows = await sqlLearn`
    SELECT p.*, d.id AS page_id
      FROM programs p
      LEFT JOIN site_pages d ON d.kind = 'program' AND d.entity_id = p.id
     ORDER BY p.featured DESC, p.display_order ASC, p.updated_at DESC
  `;
  return [...rows].map((row) => ({
    id: String(row.id),
    slug: row.public_slug ?? "",
    title: row.public_title ?? row.name ?? "",
    internalName: row.name ?? "",
    publicationStatus: toPublicationStatus(row.publication_status),
    registrationStatus: toRegistrationStatus(row.registration_status),
    featured: Boolean(row.featured),
    displayOrder: Number(row.display_order) || 0,
    startDate: row.start_date ?? null,
    capacity: row.capacity === null || row.capacity === undefined ? null : Number(row.capacity),
    updatedAt: Number(row.updated_at) || 0,
    pageId: row.page_id ?? null,
  }));
}

export interface ProgramContentInput {
  publicTitle: string;
  internalName: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  gradeRange: string;
  audience: string;
  deliveryFormat: string;
  isOnline: boolean | null;
  locationLabel: string;
  startDate: string;
  endDate: string;
  scheduleLabel: string;
  startTime: string;
  endTime: string;
  timezone: string;
  sessionCount: number | null;
  sessionLengthMinutes: number | null;
  capacity: number | null;
  isFree: boolean;
  priceCents: number | null;
  priceNote: string;
  curriculumSummary: string;
  learningGoals: string;
  studentExperience: string;
  imageUrl: string;
  signupExplanation: string;
  interestListEnabled: boolean;
  interestListExplanation: string;
  confirmationMessage: string;
  ctaLabelOverride: string;
  seoTitle: string;
  seoDescription: string;
  socialImageUrl: string;
  featured: boolean;
  displayOrder: number;
  trackCurriculumId: string | null;
}

export async function getAdminProgram(programId: string): Promise<(ProgramContentInput & { id: string; publicationStatus: PublicationStatus; registrationStatus: RegistrationStatus; pageId: string | null }) | null> {
  await requireWebsiteEditor();
  const rows = await sqlLearn`
    SELECT p.*, d.id AS page_id FROM programs p
      LEFT JOIN site_pages d ON d.kind = 'program' AND d.entity_id = p.id
     WHERE p.id = ${programId} LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    publicTitle: row.public_title ?? "",
    internalName: row.name ?? "",
    slug: row.public_slug ?? "",
    shortDescription: row.short_description ?? "",
    longDescription: row.long_description ?? "",
    gradeRange: row.grade_range ?? "",
    audience: row.audience ?? "",
    deliveryFormat: row.delivery_format ?? "",
    isOnline: row.is_online === null || row.is_online === undefined ? null : Boolean(row.is_online),
    locationLabel: row.location_label ?? "",
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    scheduleLabel: row.schedule_label ?? "",
    startTime: row.schedule_start_time ?? "",
    endTime: row.schedule_end_time ?? "",
    timezone: row.schedule_timezone ?? "",
    sessionCount: row.session_count === null || row.session_count === undefined ? null : Number(row.session_count),
    sessionLengthMinutes: row.session_length_minutes === null || row.session_length_minutes === undefined ? null : Number(row.session_length_minutes),
    capacity: row.capacity === null || row.capacity === undefined ? null : Number(row.capacity),
    isFree: Boolean(row.is_free),
    priceCents: row.price_cents === null || row.price_cents === undefined ? null : Number(row.price_cents),
    priceNote: row.price_note ?? "",
    curriculumSummary: row.curriculum_summary ?? "",
    learningGoals: row.learning_goals ?? "",
    studentExperience: row.student_experience ?? "",
    imageUrl: row.image_url ?? "",
    signupExplanation: row.signup_explanation ?? "",
    interestListEnabled: row.interest_list_enabled !== false,
    interestListExplanation: row.interest_list_explanation ?? "",
    confirmationMessage: row.confirmation_message ?? "",
    ctaLabelOverride: row.cta_label_override ?? "",
    seoTitle: row.seo_title ?? "",
    seoDescription: row.seo_description ?? "",
    socialImageUrl: row.social_image_url ?? "",
    featured: Boolean(row.featured),
    displayOrder: Number(row.display_order) || 0,
    trackCurriculumId: row.track_curriculum_id ?? null,
    publicationStatus: toPublicationStatus(row.publication_status),
    registrationStatus: toRegistrationStatus(row.registration_status),
    pageId: row.page_id ?? null,
  };
}

export async function saveProgramContent(programId: string, input: ProgramContentInput): Promise<void> {
  await requireWebsiteEditor();
  const slug = slugify(input.slug || input.publicTitle || input.internalName);
  if (!slug) throw new ContentValidationError("A program needs a web address.");
  const clash = await sqlLearn`SELECT 1 FROM programs WHERE public_slug = ${slug} AND id <> ${programId} LIMIT 1`;
  if (clash.length > 0) throw new ContentValidationError(`The address /programs/p/${slug} is already taken.`);

  const nullable = (value: string) => (value.trim() ? value.trim() : null);

  await sqlLearn`
    UPDATE programs SET
      public_slug = ${slug},
      public_title = ${input.publicTitle},
      name = ${input.internalName || input.publicTitle},
      short_description = ${input.shortDescription},
      long_description = ${input.longDescription},
      grade_range = ${input.gradeRange},
      audience = ${nullable(input.audience)},
      delivery_format = COALESCE(${nullable(input.deliveryFormat)}, delivery_format),
      is_online = ${input.isOnline},
      location_label = ${input.locationLabel},
      start_date = ${nullable(input.startDate)},
      end_date = ${nullable(input.endDate)},
      schedule_label = ${nullable(input.scheduleLabel)},
      schedule_start_time = ${nullable(input.startTime)},
      schedule_end_time = ${nullable(input.endTime)},
      schedule_timezone = ${nullable(input.timezone)},
      session_count = ${input.sessionCount},
      session_length_minutes = ${input.sessionLengthMinutes},
      capacity = ${input.capacity},
      is_free = ${input.isFree},
      price_cents = ${input.isFree ? null : input.priceCents},
      price_note = ${input.priceNote},
      curriculum_summary = ${input.curriculumSummary},
      learning_goals = ${input.learningGoals},
      student_experience = ${input.studentExperience},
      image_url = ${input.imageUrl},
      signup_explanation = ${input.signupExplanation},
      interest_list_enabled = ${input.interestListEnabled},
      interest_list_explanation = ${input.interestListExplanation},
      confirmation_message = ${input.confirmationMessage},
      cta_label_override = ${input.ctaLabelOverride},
      seo_title = ${input.seoTitle},
      seo_description = ${input.seoDescription},
      social_image_url = ${input.socialImageUrl},
      featured = ${input.featured},
      display_order = ${input.displayOrder},
      track_curriculum_id = ${input.trackCurriculumId},
      updated_at = ${now()}
    WHERE id = ${programId}
  `;
  await sqlLearn`
    UPDATE site_pages SET path = ${`/programs/p/${slug}`}, name = ${input.publicTitle || input.internalName}, updated_at = ${now()}
     WHERE kind = 'program' AND entity_id = ${programId}
  `;
}

export async function setProgramStatus(
  programId: string,
  statuses: { publicationStatus?: PublicationStatus; registrationStatus?: RegistrationStatus },
): Promise<void> {
  await requireWebsiteEditor();
  if (statuses.publicationStatus && !PUBLICATION_STATUSES.includes(statuses.publicationStatus)) {
    throw new ContentValidationError("Unknown publication status.");
  }
  if (statuses.registrationStatus && !REGISTRATION_STATUSES.includes(statuses.registrationStatus)) {
    throw new ContentValidationError("Unknown registration status.");
  }
  if (statuses.publicationStatus === "published") {
    const rows = await sqlLearn`SELECT public_title, name, short_description, public_slug FROM programs WHERE id = ${programId} LIMIT 1`;
    const row = rows[0];
    if (!row) throw new ContentValidationError("That program no longer exists.");
    if (!row.public_slug) throw new ContentValidationError("Give the program a web address before publishing it.");
    if (!String(row.public_title ?? row.name ?? "").trim()) throw new ContentValidationError("Give the program a public title before publishing it.");
    if (!String(row.short_description ?? "").trim()) throw new ContentValidationError("Add a short description before publishing — it is what the program card shows.");
  }
  await sqlLearn`
    UPDATE programs SET
      publication_status = COALESCE(${statuses.publicationStatus ?? null}, publication_status),
      registration_status = COALESCE(${statuses.registrationStatus ?? null}, registration_status),
      updated_at = ${now()}
    WHERE id = ${programId}
  `;
}

/* ------------------------------------------------------------
 * FAQs
 * ---------------------------------------------------------- */

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  status: PublicationStatus;
  ordinal: number;
  placements: { scopeKind: "page" | "track" | "program"; scopeKey: string }[];
}

export async function listAdminFaqs(): Promise<AdminFaq[]> {
  await requireWebsiteEditor();
  const rows = await sqlLearn`SELECT * FROM site_faqs ORDER BY ordinal ASC, created_at ASC`;
  const placements = await sqlLearn`SELECT faq_id, scope_kind, scope_key FROM site_faq_placements ORDER BY ordinal ASC`;
  const byFaq = new Map<string, { scopeKind: "page" | "track" | "program"; scopeKey: string }[]>();
  for (const row of placements) {
    const list = byFaq.get(String(row.faq_id)) ?? [];
    list.push({ scopeKind: row.scope_kind, scopeKey: String(row.scope_key) });
    byFaq.set(String(row.faq_id), list);
  }
  return [...rows].map((row) => ({
    id: String(row.id),
    question: String(row.question),
    answer: String(row.answer),
    status: toPublicationStatus(row.status),
    ordinal: Number(row.ordinal) || 0,
    placements: byFaq.get(String(row.id)) ?? [],
  }));
}

export async function saveFaq(input: {
  id?: string;
  question: string;
  answer: string;
  status: PublicationStatus;
  placements: { scopeKind: "page" | "track" | "program"; scopeKey: string }[];
}): Promise<string> {
  const user = await requireWebsiteEditor();
  if (!input.question.trim()) throw new ContentValidationError("A FAQ needs a question.");
  if (!input.answer.trim()) throw new ContentValidationError("A FAQ needs an answer.");
  const faqId = input.id ?? id("faq");

  await withTransaction(async (tx) => {
    if (input.id) {
      await tx`
        UPDATE site_faqs SET question = ${input.question}, answer = ${input.answer}, status = ${input.status},
               updated_at = ${now()}, updated_by_user_id = ${user.id}
         WHERE id = ${faqId}
      `;
    } else {
      const maxRows = await tx`SELECT COALESCE(MAX(ordinal), 0) AS n FROM site_faqs`;
      await tx`
        INSERT INTO site_faqs (id, question, answer, status, ordinal, created_at, updated_at, updated_by_user_id)
        VALUES (${faqId}, ${input.question}, ${input.answer}, ${input.status},
                ${(Number(maxRows[0]?.n) || 0) + 1}, ${now()}, ${now()}, ${user.id})
      `;
    }
    await tx`DELETE FROM site_faq_placements WHERE faq_id = ${faqId}`;
    let ordinal = 0;
    for (const placement of input.placements) {
      if (!placement.scopeKey.trim()) continue;
      await tx`
        INSERT INTO site_faq_placements (id, faq_id, scope_kind, scope_key, ordinal, created_at)
        VALUES (${id("fqp")}, ${faqId}, ${placement.scopeKind}, ${placement.scopeKey}, ${ordinal}, ${now()})
        ON CONFLICT (faq_id, scope_kind, scope_key) DO NOTHING
      `;
      ordinal += 1;
    }
  });
  return faqId;
}

export async function moveFaq(faqId: string, direction: "up" | "down"): Promise<void> {
  await requireWebsiteEditor();
  await withTransaction(async (tx) => {
    const rows = await tx`SELECT id FROM site_faqs ORDER BY ordinal ASC, created_at ASC`;
    const list = [...rows].map((row) => String(row.id));
    const from = list.indexOf(faqId);
    if (from === -1) return;
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    for (let index = 0; index < list.length; index += 1) {
      await tx`UPDATE site_faqs SET ordinal = ${index}, updated_at = ${now()} WHERE id = ${list[index]}`;
    }
  });
}

export async function deleteFaq(faqId: string): Promise<void> {
  await requireWebsiteEditor();
  await sqlLearn`DELETE FROM site_faqs WHERE id = ${faqId}`;
}

/* ------------------------------------------------------------
 * Press coverage
 * ---------------------------------------------------------- */

export interface AdminPublication {
  id: string;
  name: string;
  logoUrl: string;
  articleTitle: string;
  articleUrl: string;
  publicationDate: string;
  status: PublicationStatus;
  ordinal: number;
}

export interface PublicationInput {
  id?: string;
  name: string;
  logoUrl: string;
  articleTitle: string;
  articleUrl: string;
  publicationDate: string;
  status: PublicationStatus;
}

export async function listAdminPublications(): Promise<AdminPublication[]> {
  await requireWebsiteEditor();
  const rows = await sqlLearn`
    SELECT * FROM site_publications
     ORDER BY ordinal ASC, publication_date DESC NULLS LAST, name ASC
  `;
  return [...rows].map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    logoUrl: String(row.logo_url ?? ""),
    articleTitle: String(row.article_title ?? ""),
    articleUrl: String(row.article_url ?? ""),
    publicationDate: toIsoDate(row.publication_date),
    status: toPublicationStatus(row.status),
    ordinal: Number(row.ordinal) || 0,
  }));
}

function isCompleteWebUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function savePublication(input: PublicationInput): Promise<string> {
  const user = await requireWebsiteEditor();
  const name = input.name.trim();
  const articleTitle = input.articleTitle.trim();
  const articleUrl = input.articleUrl.trim();
  const logoUrl = input.logoUrl.trim();
  const publicationDate = input.publicationDate.trim();

  if (!name) throw new ContentValidationError("Add the publication name.");
  if (!articleTitle) throw new ContentValidationError("Add the article title.");
  if (!isCompleteWebUrl(articleUrl)) throw new ContentValidationError("Article link must be a complete http(s) web address.");
  if (!isSafeEditorialImageUrl(logoUrl)) throw new ContentValidationError("Logo must be a site path or a complete http(s) web address.");
  if (publicationDate && !isIsoCalendarDate(publicationDate)) {
    throw new ContentValidationError("Publication date must be a real calendar date.");
  }
  if (!PUBLICATION_STATUSES.includes(input.status)) throw new ContentValidationError("Unknown publication status.");

  const publicationId = input.id ?? id("pub");
  await withTransaction(async (tx) => {
    if (input.id) {
      const existing = await tx`SELECT id FROM site_publications WHERE id = ${publicationId} FOR UPDATE`;
      if (!existing[0]) throw new ContentValidationError("That press record no longer exists.");
      await tx`
        UPDATE site_publications
           SET name = ${name}, logo_url = ${logoUrl || null}, article_title = ${articleTitle},
               article_url = ${articleUrl}, publication_date = ${publicationDate || null},
               status = ${input.status}, updated_at = ${now()}, updated_by_user_id = ${user.id}
         WHERE id = ${publicationId}
      `;
    } else {
      const maxRows = await tx`SELECT COALESCE(MAX(ordinal), -1) AS n FROM site_publications`;
      await tx`
        INSERT INTO site_publications (
          id, name, logo_url, article_title, article_url, publication_date,
          status, ordinal, created_at, updated_at, updated_by_user_id
        ) VALUES (
          ${publicationId}, ${name}, ${logoUrl || null}, ${articleTitle}, ${articleUrl}, ${publicationDate || null},
          ${input.status}, ${(Number(maxRows[0]?.n) || 0) + 1}, ${now()}, ${now()}, ${user.id}
        )
      `;
    }
  });
  return publicationId;
}

export async function movePublication(publicationId: string, direction: "up" | "down"): Promise<void> {
  await requireWebsiteEditor();
  await withTransaction(async (tx) => {
    const rows = await tx`SELECT id FROM site_publications ORDER BY ordinal ASC, created_at ASC FOR UPDATE`;
    const list = [...rows].map((row) => String(row.id));
    const from = list.indexOf(publicationId);
    if (from === -1) return;
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    for (let index = 0; index < list.length; index += 1) {
      await tx`UPDATE site_publications SET ordinal = ${index}, updated_at = ${now()} WHERE id = ${list[index]}`;
    }
  });
}

export async function archivePublication(publicationId: string): Promise<void> {
  const user = await requireWebsiteEditor();
  await sqlLearn`
    UPDATE site_publications
       SET status = 'archived', updated_at = ${now()}, updated_by_user_id = ${user.id}
     WHERE id = ${publicationId}
  `;
}

/* ------------------------------------------------------------
 * Announcements
 * ---------------------------------------------------------- */

export interface AdminAnnouncement {
  id: string;
  message: string;
  linkHref: string;
  linkLabel: string;
  startsAt: number | null;
  endsAt: number | null;
  placement: "site" | "page";
  pageSlug: string;
  audience: string;
  status: PublicationStatus;
  isLive: boolean;
}

export async function listAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  await requireWebsiteEditor();
  const rows = await sqlLearn`SELECT * FROM site_announcements ORDER BY ordinal ASC, created_at DESC`;
  const stamp = now();
  return [...rows].map((row) => {
    const startsAt = row.starts_at === null || row.starts_at === undefined ? null : Number(row.starts_at);
    const endsAt = row.ends_at === null || row.ends_at === undefined ? null : Number(row.ends_at);
    return {
      id: String(row.id),
      message: String(row.message),
      linkHref: row.link_href ?? "",
      linkLabel: row.link_label ?? "",
      startsAt,
      endsAt,
      placement: row.placement,
      pageSlug: row.page_slug ?? "",
      audience: row.audience ?? "everyone",
      status: toPublicationStatus(row.status),
      isLive:
        row.status === "published" &&
        (startsAt === null || startsAt <= stamp) &&
        (endsAt === null || endsAt >= stamp),
    };
  });
}

export async function saveAnnouncement(input: {
  id?: string;
  message: string;
  linkHref: string;
  linkLabel: string;
  startsAt: number | null;
  endsAt: number | null;
  placement: "site" | "page";
  pageSlug: string;
  audience: string;
  status: PublicationStatus;
}): Promise<string> {
  const user = await requireWebsiteEditor();
  if (!input.message.trim()) throw new ContentValidationError("An announcement needs a message.");
  if (input.startsAt !== null && input.endsAt !== null && input.endsAt < input.startsAt) {
    throw new ContentValidationError("The end date is before the start date.");
  }
  if (input.placement === "page" && !input.pageSlug.trim()) {
    throw new ContentValidationError("Choose which page this announcement belongs to.");
  }
  const announcementId = input.id ?? id("ann");
  if (input.id) {
    await sqlLearn`
      UPDATE site_announcements SET message = ${input.message}, link_href = ${input.linkHref || null},
             link_label = ${input.linkLabel || null}, starts_at = ${input.startsAt}, ends_at = ${input.endsAt},
             placement = ${input.placement}, page_slug = ${input.placement === "page" ? input.pageSlug : null},
             audience = ${input.audience}, status = ${input.status},
             updated_at = ${now()}, updated_by_user_id = ${user.id}
       WHERE id = ${announcementId}
    `;
  } else {
    await sqlLearn`
      INSERT INTO site_announcements (id, message, link_href, link_label, starts_at, ends_at, placement, page_slug, audience, status, ordinal, created_at, updated_at, updated_by_user_id)
      VALUES (${announcementId}, ${input.message}, ${input.linkHref || null}, ${input.linkLabel || null},
              ${input.startsAt}, ${input.endsAt}, ${input.placement},
              ${input.placement === "page" ? input.pageSlug : null}, ${input.audience}, ${input.status},
              0, ${now()}, ${now()}, ${user.id})
    `;
  }
  return announcementId;
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  await requireWebsiteEditor();
  await sqlLearn`DELETE FROM site_announcements WHERE id = ${announcementId}`;
}

/* ------------------------------------------------------------
 * Document creation (used by tracks, programs, and the bootstrap script)
 * ---------------------------------------------------------- */

export interface NewDocument {
  id: string;
  kind: "page" | "track" | "program" | "system";
  slug: string;
  path: string | null;
  name: string;
  entityId?: string | null;
  isSystem?: boolean;
  ordinal?: number;
  userId?: string | null;
}

async function insertDocument(tx: any, input: NewDocument): Promise<void> {
  await tx`
    INSERT INTO site_pages (id, kind, slug, path, entity_id, name, status, is_system, ordinal, created_at, updated_at, updated_by_user_id)
    VALUES (${input.id}, ${input.kind}, ${input.slug}, ${input.path}, ${input.entityId ?? null}, ${input.name},
            'draft', ${input.isSystem ?? false}, ${input.ordinal ?? 0}, ${now()}, ${now()}, ${input.userId ?? null})
    ON CONFLICT (slug) DO NOTHING
  `;
}

export async function createPage(input: { name: string; slug: string; path: string }): Promise<string> {
  const user = await requireWebsiteEditor();
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new ContentValidationError("A page needs a name.");
  const path = input.path.startsWith("/") ? input.path.replace(/\/+$/, "") || "/" : `/${slug}`;
  const clash = await sqlLearn`SELECT 1 FROM site_pages WHERE slug = ${slug} OR path = ${path} LIMIT 1`;
  if (clash.length > 0) throw new ContentValidationError("A page already uses that name or address.");

  const pageId = id("spg");
  await withTransaction(async (tx) => {
    await insertDocument(tx, { id: pageId, kind: "page", slug, path, name: input.name, userId: user.id });
  });
  return pageId;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
