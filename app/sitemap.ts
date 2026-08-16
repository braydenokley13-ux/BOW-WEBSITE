import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/cms/metadata";
import { listPublishedRoutes } from "@/lib/cms/read";
import { getAllPartnerOrgs } from "@/lib/partners";
import { getAnalyticsPlayers } from "@/lib/nba";
import { getPublishedArticles } from "@/lib/articles";
import { teamSlug } from "@/lib/nba-teams";

/**
 * The sitemap is generated from published content, not a hand-kept list.
 *
 * That is the point: a founder who unpublishes a page or drafts a track
 * removes it from search too, in the same action. Draft and archived content
 * has no route here because `listPublishedRoutes` filters in SQL.
 */
export const dynamic = "force-dynamic";

/** Routes that exist as files and always work, independent of content. */
const ALWAYS = ["/simulations", "/sign-up", "/sign-in", "/analytics", "/analytics/articles", "/analytics/teams", "/analytics/questions", "/analytics/notebook", "/feed"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entry = (path: string, priority: number, changeFrequency: "weekly" | "monthly"): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  // A sitemap must not 500 the whole route when one query fails; each source
  // degrades to nothing rather than taking the others down with it.
  const published = await listPublishedRoutes().catch(() => []);
  const paths = new Set<string>([...ALWAYS, ...published.map((route) => route.path)]);

  const contentEntries: MetadataRoute.Sitemap = [...paths].map((path) =>
    entry(path, path === "/" ? 1 : 0.7, "monthly"),
  );

  const partners = await getAllPartnerOrgs().catch(() => []);
  const players = await getAnalyticsPlayers().catch(() => []);
  const articles = await getPublishedArticles().catch(() => []);

  const partnerEntries: MetadataRoute.Sitemap = partners.map((p) => entry(`/partners/${p.slug}`, 0.5, "monthly"));
  const playerEntries: MetadataRoute.Sitemap = players.map((p) => entry(`/analytics/players/${p.slug}`, 0.5, "weekly"));
  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE_URL}/analytics/articles/${a.slug}`,
    lastModified: new Date(a.updatedAt || a.publishedAt || Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const teamEntries: MetadataRoute.Sitemap = [...new Set(players.map((p) => p.team))].map((team) =>
    entry(`/analytics/teams/${teamSlug(team)}`, 0.5, "weekly"),
  );

  return [...contentEntries, ...partnerEntries, ...playerEntries, ...articleEntries, ...teamEntries];
}
