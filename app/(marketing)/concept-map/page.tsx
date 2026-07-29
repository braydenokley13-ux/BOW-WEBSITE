import ContentPage from "@/components/site/ContentPage";
import { getConceptMap } from "@/lib/concept-map";
import ConceptMapView from "@/components/site/ConceptMapView";
import { contentMetadata } from "@/lib/cms/metadata";

/** Intro copy is content (slug `concept-map`); the map itself is live data. */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("concept-map", { path: "/concept-map" });
}

export default function ConceptMapPage() {
  return <ContentPage slug="concept-map" screenLabel="Concept Map" extras={<Map />} />;
}

async function Map() {
  const entries = await getConceptMap();
  return (
    <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,5vw,72px) clamp(18px,4vw,40px)" }}>
      <div className="bow-container-wide">
        <ConceptMapView entries={entries} />
      </div>
    </section>
  );
}
