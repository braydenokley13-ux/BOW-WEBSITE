import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import { Button } from "@/components/ds";
import CopyLink from "@/components/app/post-class/CopyLink";

export const metadata = { title: "Your class is live" };

/**
 * The completion moment.
 *
 * Publishing ends with something finished, not with a redirect into an admin
 * screen. The share link is the point — a class nobody can find is not really
 * posted — so it is the largest thing on the page and it is already selected
 * for copying.
 *
 * A real route rather than component state, so a refresh or a back-button
 * still lands somewhere that makes sense.
 */
export default async function PublishedPage({ params }: { params: Promise<{ classId: string }> }) {
  await requireStaff();
  const { classId } = await params;

  const row = (await getDb()
    .prepare(
      `SELECT c.id, c.title, c.start_date,
              p.public_slug, p.is_public,
              (SELECT COUNT(*) FROM class_sessions s WHERE s.class_id = c.id) AS session_count
         FROM classes c
         JOIN programs p ON p.id = c.program_id
        WHERE c.id = ?`,
    )
    .get(classId)) as
    | { id: string; title: string; start_date: string | null; public_slug: string | null; is_public: boolean; session_count: number }
    | undefined;

  if (!row) notFound();

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bowsportscapital.com").replace(/\/+$/, "");
  const publicUrl = row.public_slug ? `${origin}/programs/p/${row.public_slug}` : null;
  const firstSession = row.start_date
    ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
        new Date(`${row.start_date}T12:00:00Z`),
      )
    : null;

  return (
    <div style={{ maxWidth: 620, paddingTop: 30 }}>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--bow-positive)",
        }}
      >
        Published just now
      </p>
      <h1
        style={{
          margin: "14px 0 0",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(38px, 6vw, 56px)",
          lineHeight: 0.98,
          textTransform: "uppercase",
          color: "var(--bow-ink)",
        }}
      >
        Your class
        <br />
        is live.
      </h1>

      <p style={{ margin: "18px 0 24px", fontSize: 15.5, lineHeight: 1.6, color: "var(--bow-ink)" }}>
        {row.title} — {row.session_count} session{row.session_count === 1 ? "" : "s"}
        {firstSession ? `, starting ${firstSession}` : ""}.
      </p>

      {publicUrl ? (
        <CopyLink url={publicUrl} />
      ) : (
        <p
          style={{
            padding: "13px 16px",
            background: "var(--bow-warning-tint)",
            borderRadius: "var(--radius-card)",
            fontSize: 13.5,
            color: "var(--bow-ink)",
            margin: "0 0 22px",
          }}
        >
          This class is link-only, so it is not listed on the public site. Open the class record to share it.
        </p>
      )}

      <p style={{ margin: "0 0 26px", fontSize: 13.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
        Families can register right now.
        {firstSession ? ` First session ${firstSession} — it's on your Home until then.` : ""}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button href={`/app/classes/${row.id}`} variant="primary">
          View your class
        </Button>
        <Button href="/app/post-class" variant="secondary">
          Post another
        </Button>
      </div>
    </div>
  );
}
