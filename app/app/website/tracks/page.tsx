import Link from "next/link";
import { Badge, Button, PageHeader } from "@/components/ds";
import { listAdminTracks } from "@/lib/cms/admin";
import NewTrackForm from "@/components/admin/website/NewTrackForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tracks" };

export default async function TracksScreen() {
  const tracks = await listAdminTracks();

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Tracks"
        context="The curriculum tracks a visitor can read about. A draft track is invisible to the public until you publish it."
      />

      <NewTrackForm />

      {tracks.length === 0 ? (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
          No tracks yet. Create one above.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--border-rule)", background: "var(--bow-white)", marginTop: 20 }}>
          {tracks.map((track) => (
            <div key={track.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) auto auto auto", gap: 14, alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border-rule)" }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/app/website/tracks/${track.id}`} className="bow-link" style={{ fontFamily: "var(--font-editorial)", fontSize: 17 }}>
                  {track.title || track.internalTitle}
                </Link>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  /programs/{track.slug}{track.gradeRange ? ` · ${track.gradeRange}` : ""}
                </div>
              </div>
              <Badge status={track.publicationStatus === "published" ? "positive" : track.publicationStatus === "archived" ? "neutral" : "warning"}>
                {track.publicationStatus === "published" ? "Published" : track.publicationStatus === "archived" ? "Archived" : "Draft"}
              </Badge>
              <Button href={`/app/website/tracks/${track.id}`} variant="secondary" size="sm">Edit</Button>
              {track.pageId ? <Button href={`/app/website/pages/${track.pageId}`} variant="secondary" size="sm">Page content</Button> : <span />}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
