import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

/**
 * The podcast page.
 *
 * This route remains as an honest holding page until real, complete audio is
 * available. It is intentionally absent from the primary navigation.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("podcast", { path: "/podcast" });
}

export default function PodcastPage() {
  return <ContentPage slug="podcast" screenLabel="Podcast" />;
}
