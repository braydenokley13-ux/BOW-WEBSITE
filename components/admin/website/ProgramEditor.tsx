"use client";

import Link from "next/link";
import RecordEditor from "@/components/admin/website/RecordEditor";
import { saveProgramContentAction, setProgramStatusAction } from "@/app/actions/website";
import type { ProgramContentInput } from "@/lib/cms/admin";
import type { FieldSpec } from "@/lib/cms/fields";
import type { PublicationStatus, RegistrationStatus } from "@/lib/cms/status";

/**
 * The public face of a program.
 *
 * The internal operating record (staffing, readiness, roster) stays in
 * /app/programs — this screen edits only what a visitor reads and what the
 * signup button does.
 */
function groups(trackOptions: { value: string; label: string }[]): { heading: string; fields: FieldSpec[] }[] {
  return [
    {
      heading: "What it’s called",
      fields: [
        { name: "publicTitle", label: "Public title", type: "text", help: "What visitors see. Leave blank to use the internal name." },
        { name: "internalName", label: "Internal name", type: "text", help: "How it appears in your own program lists." },
        { name: "slug", label: "Web address", type: "text", help: "The page lives at /programs/p/<this>." },
        {
          name: "trackCurriculumId",
          label: "Part of which track",
          type: "select",
          options: [{ value: "", label: "Not linked to a track" }, ...trackOptions],
        },
      ],
    },
    {
      heading: "What it says",
      fields: [
        { name: "shortDescription", label: "Short description", type: "textarea", help: "One or two sentences. This is the program card." },
        { name: "longDescription", label: "Full description", type: "richtext" },
        { name: "curriculumSummary", label: "What you’ll cover", type: "richtext" },
        { name: "learningGoals", label: "What students take away", type: "richtext" },
        { name: "studentExperience", label: "What a session looks like", type: "richtext" },
        { name: "imageUrl", label: "Image", type: "image" },
      ],
    },
    {
      heading: "Who, where, and when",
      fields: [
        { name: "gradeRange", label: "Grade range", type: "text", placeholder: "5–8" },
        { name: "audience", label: "Who it’s for", type: "text" },
        {
          name: "deliveryFormat",
          label: "Format",
          type: "select",
          options: [
            { value: "in_person", label: "In person" },
            { value: "online", label: "Online" },
            { value: "hybrid", label: "Hybrid" },
          ],
        },
        { name: "isOnline", label: "Runs online", type: "boolean" },
        { name: "locationLabel", label: "Where", type: "text", placeholder: "Lincoln High School, Brooklyn" },
        { name: "startDate", label: "Start date", type: "text", placeholder: "2026-09-14" },
        { name: "endDate", label: "End date", type: "text", placeholder: "2026-11-16" },
        { name: "scheduleLabel", label: "Schedule", type: "text", placeholder: "Mondays after school" },
        { name: "startTime", label: "Start time", type: "text", placeholder: "16:00" },
        { name: "endTime", label: "End time", type: "text", placeholder: "17:30" },
        { name: "timezone", label: "Time zone", type: "text", placeholder: "America/New_York" },
        { name: "sessionCount", label: "Number of sessions", type: "number" },
        { name: "sessionLengthMinutes", label: "Minutes per session", type: "number" },
        { name: "capacity", label: "Capacity", type: "number", help: "When confirmed registrations reach this, the program shows as Full automatically." },
      ],
    },
    {
      heading: "Cost",
      fields: [
        { name: "isFree", label: "This program is free", type: "boolean" },
        { name: "priceCents", label: "Price in cents", type: "number", help: "2500 means $25. Ignored when the program is free." },
        { name: "priceNote", label: "Price note", type: "text", placeholder: "Scholarships available" },
      ],
    },
    {
      heading: "Signing up",
      fields: [
        { name: "ctaLabelOverride", label: "Button wording", type: "text", help: "Changes the words only. What the button does still follows the signup status above." },
        { name: "signupExplanation", label: "Registration explanation", type: "richtext", help: "Shown next to the registration form. Leave blank to use the site default." },
        { name: "interestListEnabled", label: "Offer the interest list", type: "boolean", help: "Lets visitors register interest when signup is closed or full." },
        { name: "interestListExplanation", label: "Interest-list explanation", type: "richtext" },
        { name: "confirmationMessage", label: "Confirmation message", type: "richtext", help: "What a family reads after registering." },
      ],
    },
    {
      heading: "Search, sharing, and order",
      fields: [
        { name: "seoTitle", label: "Search-result title", type: "text" },
        { name: "seoDescription", label: "Search-result description", type: "textarea" },
        { name: "socialImageUrl", label: "Sharing image", type: "image" },
        { name: "featured", label: "Feature this program", type: "boolean" },
        { name: "displayOrder", label: "Order", type: "number", help: "Lower numbers come first." },
      ],
    },
  ];
}

export default function ProgramEditor({
  program,
  trackOptions,
}: {
  program: ProgramContentInput & {
    id: string;
    publicationStatus: PublicationStatus;
    registrationStatus: RegistrationStatus;
    pageId: string | null;
  };
  trackOptions: { value: string; label: string }[];
}) {
  const { id, publicationStatus, registrationStatus, pageId, ...values } = program;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--text-secondary)" }}>
        Staffing, roster, and readiness for this program live in{" "}
        <Link href={`/app/programs`} className="bow-link">Programs</Link>. This screen edits what the public sees.
        {pageId ? (
          <>
            {" "}Extra page sections are in <Link href={`/app/website/pages/${pageId}`} className="bow-link">Pages</Link>.
          </>
        ) : null}
      </p>
      <RecordEditor<ProgramContentInput>
        title={values.publicTitle || values.internalName || "Program"}
        publicHref={values.slug ? `/programs/p/${values.slug}` : null}
        groups={groups(trackOptions)}
        initial={values}
        onSave={(next) => saveProgramContentAction(id, next)}
        publication={{ value: publicationStatus, onChange: (next) => setProgramStatusAction(id, { publicationStatus: next }) }}
        registration={{ value: registrationStatus, onChange: (next) => setProgramStatusAction(id, { registrationStatus: next }) }}
        interestListEnabled={values.interestListEnabled}
        ctaLabelOverride={values.ctaLabelOverride}
      />
    </div>
  );
}
