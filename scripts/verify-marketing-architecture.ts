/* ============================================================
 * Read-only verification for the public marketing architecture.
 *
 * This command is deliberately separate from the writer. It proves that the
 * configured database has the required published pointers, fixed section
 * signatures, navigation, footer, and verified press rows.
 *
 * Usage: npm run content:verify
 * ============================================================ */

import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import {
  MARKETING_ARCHITECTURE_VERSION,
  UPGRADE_PAGES,
  VERIFIED_PUBLICATIONS,
  publishedArchitectureMatches,
} from "./upgrade-marketing-architecture";

loadEnvConfig(process.cwd());

function connectionUrl(): string {
  const value = (
    process.env.POSTGRES_URL_NON_POOLING
    ?? process.env.POSTGRES_URL
    ?? process.env.DATABASE_URL
    ?? ""
  ).trim();
  if (!value) throw new Error("[content:verify] Missing the configured Postgres URL.");
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[content:verify] ${message}`);
}

async function main(): Promise<void> {
  const sql = postgres(connectionUrl(), { prepare: false, max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe("SET TRANSACTION READ ONLY");

      const pages = await tx`
        SELECT p.id, p.slug, p.kind, p.path, p.status, p.architecture_version,
               p.cms_visible, p.published_version_id, p.draft_version_id,
               pv.state AS published_state,
               COALESCE(
                 array_agg(s.kind ORDER BY s.ordinal) FILTER (WHERE s.id IS NOT NULL),
                 ARRAY[]::text[]
               ) AS published_section_kinds,
               COALESCE(
                 jsonb_agg(s.data ORDER BY s.ordinal) FILTER (WHERE s.id IS NOT NULL),
                 '[]'::jsonb
               ) AS published_section_data
          FROM site_pages p
          LEFT JOIN site_page_versions pv ON pv.id = p.published_version_id
          LEFT JOIN site_page_sections s ON s.version_id = p.published_version_id
         WHERE p.slug IN ${tx(UPGRADE_PAGES.map((page) => page.slug))}
         GROUP BY p.id, p.slug, p.kind, p.path, p.status, p.architecture_version,
                  p.cms_visible, p.published_version_id, p.draft_version_id, pv.state
         ORDER BY p.slug
      `;

      const bySlug = new Map(pages.map((row) => [String(row.slug), row]));
      for (const expected of UPGRADE_PAGES) {
        const row = bySlug.get(expected.slug);
        assert(row, `missing required page: ${expected.slug}`);
        const sectionKinds = Array.isArray(row.published_section_kinds)
          ? row.published_section_kinds.map(String)
          : [];
        assert(
          publishedArchitectureMatches({
            status: String(row.status ?? ""),
            publishedVersionId: row.published_version_id ? String(row.published_version_id) : null,
            publishedState: row.published_state ? String(row.published_state) : null,
            publishedSectionKinds: sectionKinds,
          }, expected.sections.map((section) => section.kind)),
          `${expected.slug} does not have the required published section structure`,
        );
        assert(Number(row.architecture_version) >= MARKETING_ARCHITECTURE_VERSION, `${expected.slug} has an old architecture marker`);
        assert((row.path ?? null) === expected.path, `${expected.slug} has the wrong public path`);
        assert(Boolean(row.cms_visible) === expected.cmsVisible, `${expected.slug} has the wrong CMS visibility`);
        assert(!JSON.stringify(row.published_section_data).includes("—"), `${expected.slug} contains an em dash in published content`);
      }

      const navigationPage = bySlug.get("system-navigation");
      const navigationData = Array.isArray(navigationPage?.published_section_data)
        ? navigationPage.published_section_data[0] as { items?: { label?: string; href?: string }[]; primaryCtaLabel?: string; primaryCtaHref?: string }
        : null;
      const navPairs = navigationData?.items?.map((item) => `${item.label}:${item.href}`) ?? [];
      assert(JSON.stringify(navPairs) === JSON.stringify([
        "Home:/",
        "Programs:/programs",
        "Partner With BOW:/partner-with-bow",
        "About:/about",
        "Teach:/teach",
      ]), "primary navigation is stale");
      assert(navigationData?.primaryCtaLabel === "Bring BOW to Your Organization", "primary CTA label is stale");
      assert(navigationData?.primaryCtaHref === "/partner-with-bow", "primary CTA destination is stale");

      const footerPage = bySlug.get("system-footer");
      const footerData = Array.isArray(footerPage?.published_section_data)
        ? footerPage.published_section_data[0] as {
          tagline?: string;
          columns?: { heading?: string; links?: { label?: string; href?: string }[] }[];
        }
        : null;
      const footerPairs = footerData?.columns?.flatMap((column) =>
        (column.links ?? []).map((link) => `${column.heading}:${link.label}:${link.href}`)
      ) ?? [];
      assert(footerData?.tagline === "Sports-based financial literacy", "footer tagline is stale");
      assert(JSON.stringify(footerPairs) === JSON.stringify([
        "Program:Programs:/programs",
        "Program:Partner With BOW:/partner-with-bow",
        "BOW:About:/about",
        "BOW:Teach:/teach",
        "BOW:Contact:/contact",
        "Account:Sign In:/sign-in",
      ]), "footer navigation is stale");

      const publications = await tx`
        SELECT name, article_url, status
          FROM site_publications
         WHERE article_url IN ${tx(VERIFIED_PUBLICATIONS.map((publication) => publication.articleUrl))}
         ORDER BY ordinal ASC, article_url ASC
      `;
      assert(publications.length === VERIFIED_PUBLICATIONS.length, "one or more verified publication records are missing");
      assert(publications.every((row) => row.status === "published"), "one or more verified publication records are not published");

      const publicTracks = await tx`SELECT COUNT(*)::integer AS n FROM site_pages WHERE kind = 'track' AND status = 'published'`;
      assert(Number(publicTracks[0]?.n) === 0, "old Track marketing documents are still published");

      console.log(
        `[content:verify] PASS: ${UPGRADE_PAGES.length} architecture documents, `
        + `${publications.length} verified publications, current navigation/footer, no published Track pages.`,
      );
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
