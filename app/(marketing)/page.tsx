import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

/**
 * Home.
 *
 * Every word, statistic, track comparison, and button on this page is a
 * published section in `site_pages` (slug `home`), edited at
 * /app/website/pages. The route's whole job is to say which document to
 * render — the layouts themselves are unchanged and still come from the
 * design system.
 */

// The page reads published content per request, so a founder's publish is live
// immediately and a draft is never baked into a static build.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("home", { path: "/" });
}

export default function HomePage() {
  return <ContentPage slug="home" screenLabel="Home" />;
}
