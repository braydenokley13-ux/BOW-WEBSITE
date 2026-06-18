import InquiryForm from "@/components/site/InquiryForm";

export const metadata = {
  title: "Get Involved — BOW Sports Capital",
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
      </section>
    </div>
  );
}
