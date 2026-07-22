import Link from "next/link";
import { requireTeachingUser } from "@/lib/dal";
import { listPendingReviews } from "@/app/actions/learn-review";
import ReviewQueue from "@/components/learn/instructor/ReviewQueue";

export const metadata = {
  title: "Reflection Review Queue · BOW HQ",
  description: "Review and score pending student reflections.",
  robots: { index: false, follow: false },
};

export default async function ReviewQueuePage() {
  await requireTeachingUser();
  const rows = await listPendingReviews();

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link href="/app/instructor/learn" style={{ fontFamily: "var(--font-data)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bow-blue)", textDecoration: "none" }}>
          ← My cohort roster
        </Link>
        <h1 style={{ margin: "10px 0 4px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,40px)", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Reflection review queue
        </h1>
        <p style={{ margin: "0 0 24px", color: "var(--bow-slate)" }}>
          Open reflections your students submitted (manual_review long-text blocks). Award points up to the
          lesson-defined cap and leave a note — students see it on their results screen.
        </p>
        {"error" in rows ? (
          <p role="alert" style={{ color: "var(--bow-negative)" }}>{rows.error}</p>
        ) : (
          <ReviewQueue initialRows={rows} />
        )}
      </div>
    </div>
  );
}
