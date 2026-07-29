import ContentPage from "@/components/site/ContentPage";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("get-involved-families", { path: "/get-involved/families" });
}

export default function Page() {
  return <ContentPage slug="get-involved-families" screenLabel="For Families" />;
}
