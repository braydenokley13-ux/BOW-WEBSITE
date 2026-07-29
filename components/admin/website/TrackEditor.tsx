"use client";

import Link from "next/link";
import RecordEditor from "@/components/admin/website/RecordEditor";
import { saveTrackAction, setTrackPublicationAction } from "@/app/actions/website";
import type { TrackInput } from "@/lib/cms/admin";
import type { PublicationStatus } from "@/lib/cms/status";

/** Fields for a track. Grouped the way a founder thinks about them. */
const GROUPS = [
  {
    heading: "What it’s called",
    fields: [
      { name: "publicTitle", label: "Public title", type: "text" as const, help: "The large numeral or name a visitor sees, e.g. 101." },
      { name: "internalTitle", label: "Internal name", type: "text" as const, help: "How it appears in your own lists. Not shown publicly." },
      { name: "slug", label: "Web address", type: "text" as const, help: "The track lives at /programs/<this>. Changing it breaks existing links." },
      { name: "kicker", label: "Kicker", type: "text" as const, placeholder: "Track 101 · Introductory" },
      { name: "badgeLabel", label: "Badge", type: "text" as const, help: "A short highlight, e.g. Recommended Start. Optional." },
    ],
  },
  {
    heading: "What it says",
    fields: [
      { name: "headline", label: "Headline", type: "text" as const },
      { name: "shortDescription", label: "Short description", type: "textarea" as const, help: "Used on cards and comparison grids." },
      { name: "longDescription", label: "Full description", type: "richtext" as const },
      { name: "curriculumSummary", label: "Curriculum summary", type: "textarea" as const },
      { name: "studentExperience", label: "What a session looks like", type: "richtext" as const },
    ],
  },
  {
    heading: "Who it’s for",
    fields: [
      { name: "gradeRange", label: "Grade range", type: "text" as const, placeholder: "Grades 5–6" },
      { name: "audience", label: "Audience", type: "text" as const },
    ],
  },
  {
    heading: "Button and imagery",
    fields: [
      { name: "ctaLabel", label: "Button text", type: "text" as const },
      { name: "ctaHref", label: "Button goes to", type: "text" as const, placeholder: "/programs" },
      { name: "imageUrl", label: "Image", type: "image" as const },
    ],
  },
  {
    heading: "Search and sharing",
    fields: [
      { name: "seoTitle", label: "Search-result title", type: "text" as const },
      { name: "seoDescription", label: "Search-result description", type: "textarea" as const },
      { name: "socialImageUrl", label: "Sharing image", type: "image" as const },
      { name: "featured", label: "Feature this track", type: "boolean" as const, help: "Featured tracks are emphasised in comparison grids." },
      { name: "displayOrder", label: "Order", type: "number" as const, help: "Lower numbers come first." },
    ],
  },
];

export default function TrackEditor({
  track,
}: {
  track: TrackInput & { id: string; publicationStatus: PublicationStatus; pageId: string | null };
}) {
  const { id, publicationStatus, pageId, ...values } = track;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {pageId ? (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--text-secondary)" }}>
          The body of this track’s page — its sections — is edited in{" "}
          <Link href={`/app/website/pages/${pageId}`} className="bow-link">Pages</Link>.
        </p>
      ) : null}
      <RecordEditor<TrackInput>
        title={values.publicTitle || values.internalTitle || "Track"}
        publicHref={values.slug ? `/programs/${values.slug}` : null}
        groups={GROUPS}
        initial={values}
        onSave={(next) => saveTrackAction(id, next)}
        publication={{ value: publicationStatus, onChange: (next) => setTrackPublicationAction(id, next) }}
      />
    </div>
  );
}
