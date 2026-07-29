import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("highway-world", { path: "/highway-world" });
}

export default function Page() {
  return <ContentPage slug="highway-world" screenLabel="Highway World" />;
}
