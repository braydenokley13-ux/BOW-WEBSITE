import ContentPage from "@/components/site/ContentPage";
import ContactForm from "@/components/site/ContactForm";
import { contentMetadata } from "@/lib/cms/metadata";

/**
 * Contact. The heading, the explanation, and the contact details are all
 * sections on the `contact` document; only the form is code.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("contact", { path: "/contact" });
}

export default function ContactPage() {
  return (
    <ContentPage
      slug="contact"
      screenLabel="Contact"
      extras={
        <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(32px,5vw,64px) clamp(18px,4vw,40px) clamp(56px,8vw,110px)" }}>
          <div className="bow-container-wide">
            <ContactForm />
          </div>
        </section>
      }
    />
  );
}
