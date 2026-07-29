import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getAllPartnerOrgs } from "@/lib/partners";
import { getAnalyticsPlayers } from "@/lib/nba";
import { getPublishedArticles } from "@/lib/articles";
import { teamSlug } from "@/lib/nba-teams";

// Reads partner/player/article data from the database; must not run at build time.
export const dynamic = "force-dynamic";

/** Static marketing routes; lesson-detail routes are appended below. */
const ROUTES = [
  "/",
  "/programs",
  "/programs/track-101",
  "/programs/track-201",
  "/programs/track-301",
  "/analytics",
  "/analytics/articles",
  "/analytics/teams",
  "/analytics/questions",
  "/analytics/notebook",
  "/simulation",
  "/podcast",
  "/feed",
  "/highway-world",
  "/about",
  "/get-involved",
  "/get-involved/schools",
  "/get-involved/camps",
  "/get-involved/families",
  "/get-involved/youth-organizations",
  "/get-involved/partners",
  "/teach",
  "/sign-up",
  "/sign-in",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = ROUTES.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
  // Public partner / school landing pages — shared in outreach, so index them.
  const partnerEntries: MetadataRoute.Sitemap = (await getAllPartnerOrgs()).map((p) => ({
    url: `${SITE.url}/partners/${p.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
  // Analytics: player breakdown pages + every published article.
  const playerEntries: MetadataRoute.Sitemap = (await getAnalyticsPlayers()).map((p) => ({
    url: `${SITE.url}/analytics/players/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));
  const articleEntries: MetadataRoute.Sitemap = (await getPublishedArticles()).map((a) => ({
    url: `${SITE.url}/analytics/articles/${a.slug}`,
    lastModified: new Date(a.updatedAt || a.publishedAt || Date.now()),
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  // One entry per team that actually has tracked players — no point
  // indexing a cap-sheet page that would just 404.
  const teamsWithPlayers = new Set((await getAnalyticsPlayers()).map((p) => p.team));
  const teamEntries: MetadataRoute.Sitemap = [...teamsWithPlayers].map((team) => ({
    url: `${SITE.url}/analytics/teams/${teamSlug(team)}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));
  return [...staticEntries, ...partnerEntries, ...playerEntries, ...articleEntries, ...teamEntries];
}
