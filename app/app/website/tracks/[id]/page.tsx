import Link from "next/link";
import TrackEditor from "@/components/admin/website/TrackEditor";
import { getAdminTrack } from "@/lib/cms/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const track = await getAdminTrack(id);
  return { title: track ? `Edit — ${track.publicTitle || track.internalTitle}` : "Edit track" };
}

export default async function EditTrackScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const track = await getAdminTrack(id);

  if (!track) {
    return (
      <div style={{ padding: "40px 0" }}>
        <h1 style={{ fontFamily: "var(--font-editorial)", fontSize: 26 }}>That track doesn’t exist any more.</h1>
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
          <Link href="/app/website/tracks" className="bow-link">Back to Tracks</Link>
        </p>
      </div>
    );
  }

  return <TrackEditor track={track} />;
}
