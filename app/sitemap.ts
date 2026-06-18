import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { lessons } from "@/lib/lessons";

/** Static marketing routes; lesson-detail routes are appended below. */
const ROUTES = [
  "/",
  "/programs",
  "/programs/track-101",
  "/programs/track-201",
  "/programs/track-301",
  "/lessons",
  "/simulation",
  "/podcast",
  "/highway-world",
  "/about",
  "/get-involved",
  "/get-involved/schools",
  "/get-involved/camps",
  "/get-involved/families",
  "/get-involved/youth-organizations",
  "/get-involved/partners",
  "/sign-up",
  "/sign-in",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = ROUTES.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
  const lessonEntries: MetadataRoute.Sitemap = lessons.map((l) => ({
    url: `${SITE.url}/lessons/${l.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...staticEntries, ...lessonEntries];
}
