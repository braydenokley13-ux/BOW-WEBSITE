import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Static marketing routes. Lesson-detail routes (`/lessons/[slug]`) are appended
 * during the integration pass once the lesson dataset is in place.
 */
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
  return ROUTES.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
