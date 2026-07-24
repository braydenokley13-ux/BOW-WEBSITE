import Link from "next/link";
import PartnershipInquiryForm from "@/components/site/PartnershipInquiryForm";

export const metadata = {
  title: "Partnership Inquiry",
  description: "Tell us about your organization and the partnership you have in mind.",
};

export default function PartnerInquiryPage() {
  return (
    <div data-screen-label="Partner Inquiry" style={{ background: "var(--bow-paper)", minHeight: "60vh" }}>
      <div className="bow-container" style={{ padding: "clamp(56px,8vw,120px) clamp(18px,4vw,40px)" }}>
        <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)", marginBottom: 28 }}>
          <Link href="/get-involved/partners" style={{ color: "var(--bow-blue)" }}>Partners</Link>
          <span aria-hidden="true">/</span>
          <span style={{ color: "var(--bow-ink)" }}>Partnership Inquiry</span>
        </nav>
        <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4vw,48px)", lineHeight: 1.05, letterSpacing: "-0.01em" }}>
          Start a partnership conversation.
        </h1>
        <p style={{ margin: "0 0 32px", fontFamily: "var(--font-interface)", fontSize: 15.5, color: "var(--bow-slate)", maxWidth: 560 }}>
          Tell us about your organization — we&rsquo;ll follow up within a few days.
        </p>
        <PartnershipInquiryForm />
      </div>
    </div>
  );
}
