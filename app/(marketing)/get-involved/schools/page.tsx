import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("get-involved-schools", { path: "/get-involved/schools" });
}

export default function Page() {
  return <ContentPage slug="get-involved-schools" screenLabel="For Schools" />;
}
