import Link from "next/link";
import InquiryForm from "@/components/site/InquiryForm";

export const metadata = {
  title: "Get Involved",
  description:
    "Step into the front office. Bring BOW to a school, camp, or youth organization, join as a student or family, or explore a partnership.",
};

export default function GetInvolvedPage() {
  return (
    <div data-screen-label="Get Involved">
      <section
        style={{
          background: "var(--bow-ink)",
          color: "#fff",
          padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)",
          minHeight: "80vh",
        }}
      >
        <InquiryForm />
        <p
          style={{
            maxWidth: 620,
            margin: "48px auto 0",
            fontFamily: "var(--font-interface)",
            fontSize: 14.5,
            color: "#9a9da6",
            textAlign: "center",
          }}
        >
          Want to teach for BOW instead?{" "}
          <Link href="/get-involved/apply" className="bow-link" style={{ color: "var(--bow-orange)", textDecoration: "underline" }}>
            Apply to teach →
          </Link>
        </p>
      </section>
    </div>
  );
}
