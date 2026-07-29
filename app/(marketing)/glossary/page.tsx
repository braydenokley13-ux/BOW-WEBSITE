import ContentPage from "@/components/site/ContentPage";
import { getGlossaryTerms } from "@/lib/glossary";
import GlossaryView from "@/components/site/GlossaryView";
import { contentMetadata } from "@/lib/cms/metadata";

/** Intro copy is content (slug `glossary`); the terms come from the database. */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("glossary", { path: "/glossary" });
}

export default function GlossaryPage() {
  return <ContentPage slug="glossary" screenLabel="Glossary" extras={<Terms />} />;
}

async function Terms() {
  const terms = await getGlossaryTerms();
  return (
    <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px)" }}>
      <div className="bow-container-wide">
        <GlossaryView terms={terms} />
      </div>
    </section>
  );
}
