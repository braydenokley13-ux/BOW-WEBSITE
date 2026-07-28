import Link from "next/link";
import type { RequirementRow } from "@/lib/family-portal";

const KIND_EXPLANATION: Record<string, string> = {
  emergency_contact: "Who to call in an emergency. Visible to BOW staff running the program.",
  medical: "Medical information staff need to keep your child safe. Never shared beyond program staff.",
  accessibility: "Accommodations your child needs. Shared with staff and, when relevant, the instructor.",
  photo_consent: "Whether BOW may use photos/video of your child in program materials.",
  agreement: "A program policy your family is agreeing to.",
  waiver: "A liability waiver required to participate.",
  student_interests: "Helps instructors tailor the program to your child.",
  prior_experience: "Helps staff place your child at the right level.",
  school: "Your child's school, used for scheduling and eligibility.",
  grade_verification: "Confirms grade-level eligibility for this program.",
  logistics_ack: "Confirms you've seen logistics details (pickup, drop-off, location).",
  short_response: "A short answer requested by the program.",
  choice: "A selection requested by the program.",
  file_upload: "A document the program needs on file.",
};

/**
 * Groups render as sections, not a flat table — so "why is this being
 * asked" (KIND_EXPLANATION) and "who can see it" are always next to the
 * item, never buried behind a raw column name a parent shouldn't have to
 * decode.
 */
export default function RequirementList({
  title,
  items,
  collapsedByDefault,
}: {
  title: string;
  items: RequirementRow[];
  collapsedByDefault?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <details open={!collapsedByDefault} style={{ marginBottom: 12 }}>
      <summary style={{ fontFamily: "var(--font-interface)", fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "4px 0" }}>
        {title} ({items.length})
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {items.map((req) => (
          <div key={req.id} style={{ background: "#fff", border: "1px solid #e4e2dc", borderRadius: 6, padding: "12px 14px" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{req.studentName} · {req.programName}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--bow-slate, #3f4147)" }}>{req.prompt}</p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--bow-slate, #6b6e75)" }}>
              {KIND_EXPLANATION[req.kind] ?? "Requested by the program."} {visibilityNote(req.visibility)}
            </p>
            {req.status !== "approved" && req.status !== "waived" && (
              <Link href={`/family/requirements/${req.id}`} style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 700, color: "var(--bow-orange, #d4531f)" }}>
                {req.status === "submitted" ? "Awaiting review" : "Complete now"} →
              </Link>
            )}
            {req.status === "submitted" && (
              <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--bow-slate, #6b6e75)" }}>Submitted — awaiting staff approval.</span>
            )}
            {req.status === "needs_correction" && req.reviewNote && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8a3820" }}>Staff note: {req.reviewNote}</p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function visibilityNote(visibility: string): string {
  if (visibility === "admin") return "Seen by BOW staff only.";
  if (visibility === "admin_instructor") return "Seen by BOW staff and this program's instructor.";
  return "A summary is shared with the instructor; details stay with BOW staff.";
}
