import ContentPage from "@/components/site/ContentPage";
import Simulation from "@/components/site/Simulation";
import { contentMetadata } from "@/lib/cms/metadata";

/** Framing copy is content (slug `simulation`); the simulation itself is code. */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("simulation", { path: "/simulation" });
}

export default function SimulationPage() {
  return <ContentPage slug="simulation" screenLabel="Simulation" extras={<Simulation />} />;
}
