import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("get-involved-youth-organizations", { path: "/get-involved/youth-organizations" });
}

export default function Page() {
  return <ContentPage slug="get-involved-youth-organizations" screenLabel="For Youth Organizations" />;
}
