import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("get-involved-partners", { path: "/get-involved/partners" });
}

export default function Page() {
  return <ContentPage slug="get-involved-partners" screenLabel="Partners" />;
}
