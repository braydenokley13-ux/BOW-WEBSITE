import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("get-involved-camps", { path: "/get-involved/camps" });
}

export default function Page() {
  return <ContentPage slug="get-involved-camps" screenLabel="For Camps" />;
}
