import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("about", { path: "/about" });
}

export default function AboutPage() {
  return <ContentPage slug="about" screenLabel="About" />;
}
