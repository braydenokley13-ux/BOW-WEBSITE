import type { Metadata } from "next";
import { CapLine } from "@/components/ds";
import ContactForm from "@/components/site/ContactForm";

const TITLE = "Contact BOW Sports Capital";
const DESCRIPTION =
  "Bring BOW Sports Capital to your students. Reach out about a league, school, camp, or youth-organization partnership.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/contact" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function ContactPage() {
  return (
    <div data-screen-label="Contact">
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px) clamp(56px,8vw,110px)", minHeight: "80vh" }}>
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            Partnerships
          </span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.0, letterSpacing: "-0.015em", maxWidth: "16ch", textWrap: "balance" }}>
            Bring BOW to your students.
          </h1>
          <p style={{ margin: "20px 0 0", maxWidth: 640, fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.6, color: "#c8cad0" }}>
            Self-paced. Standards-aligned to AP Micro and AP Macro. Measurable engagement for every student. Tell us about your program and we’ll be in touch.
          </p>
          <CapLine weight={6} step={14} stepAt={0.42} style={{ maxWidth: 240, margin: "26px 0 36px" }} />
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
