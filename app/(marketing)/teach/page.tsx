import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

/**
 * Instructor recruitment. Everything a prospective instructor reads is a
 * section on the `teach` document; the live opening it links to is chosen by
 * the founder as the section's button destination.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("teach", { path: "/teach" });
}

export default function TeachPage() {
  return <ContentPage slug="teach" screenLabel="Teach with BOW" />;
}
