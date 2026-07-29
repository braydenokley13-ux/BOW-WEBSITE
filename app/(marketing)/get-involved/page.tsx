import ContentPage from "@/components/site/ContentPage";
import InquiryForm from "@/components/site/InquiryForm";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("get-involved", { path: "/get-involved" });
}

export default function GetInvolvedPage() {
  return (
    <ContentPage
      slug="get-involved"
      screenLabel="Get Involved"
      extras={
        <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(32px,5vw,64px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)" }}>
          <InquiryForm />
        </section>
      }
    />
  );
}
