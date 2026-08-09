import { redirect } from "next/navigation";
import { contentMetadata } from "@/lib/cms/metadata";

/**
 * Detailed Track 101/201/301 pages are retired from the public marketing site.
 * Curriculum records and the internal curriculum application remain intact.
 */
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return contentMetadata(null, {
    title: "Programs",
    description: "Explore the BOW online financial literacy and economics program.",
    path: "/programs",
    noindex: true,
  });
}

export default function LegacyTrackPage() {
  redirect("/programs");
}
