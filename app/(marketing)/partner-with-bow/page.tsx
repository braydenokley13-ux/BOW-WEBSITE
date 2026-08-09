import ContentPage from "@/components/site/ContentPage";
import PartnershipInquiryForm from "@/components/site/PartnershipInquiryForm";
import { contentMetadata } from "@/lib/cms/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("partner-with-bow", { path: "/partner-with-bow" });
}

export default function PartnerWithBowPage() {
  return (
    <ContentPage
      slug="partner-with-bow"
      screenLabel="Partner With BOW"
      extras={
        <section
          id="partnership-inquiry"
          style={{ background: "var(--bow-paper)", padding: "clamp(40px,6vw,80px) clamp(18px,4vw,40px) clamp(56px,8vw,104px)", scrollMarginTop: 100 }}
        >
          <div className="bow-container" style={{ maxWidth: 760 }}>
            <div className="bow-section-intro" style={{ marginBottom: "var(--space-8)" }}>
              <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>Partnership inquiry</span>
              <h2 className="bow-headline">Bring BOW to your organization.</h2>
              <p className="bow-lead">Share the basics. BOW will follow up to discuss the fit before any program details are promised.</p>
            </div>
            <PartnershipInquiryForm />
          </div>
        </section>
      }
    />
  );
}
