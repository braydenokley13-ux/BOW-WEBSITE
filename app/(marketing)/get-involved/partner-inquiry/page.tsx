import ContentPage from "@/components/site/ContentPage";
import PartnershipInquiryForm from "@/components/site/PartnershipInquiryForm";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("get-involved-partner-inquiry", { path: "/get-involved/partner-inquiry" });
}

export default function PartnerInquiryPage() {
  return (
    <ContentPage
      slug="get-involved-partner-inquiry"
      screenLabel="Partnership Inquiry"
      extras={
        <section style={{ background: "var(--bow-paper)", padding: "clamp(24px,4vw,48px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)" }}>
          <div className="bow-container" style={{ maxWidth: 720 }}>
            <PartnershipInquiryForm />
          </div>
        </section>
      }
    />
  );
}
