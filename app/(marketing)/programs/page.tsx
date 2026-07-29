import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

/**
 * Programs overview. The live program cards and the track comparison are both
 * sections on this document, so which offerings appear — and in what order —
 * follows the publication status set on each program and track record.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("programs", { path: "/programs" });
}

export default function ProgramsPage() {
  return <ContentPage slug="programs" screenLabel="Programs" />;
}
