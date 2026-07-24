import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { getMapEditorData, listPublishedLessonsForMapPicker } from "@/app/actions/learn-author";
import MapEditor from "@/components/learn/builder/MapEditor";

export const metadata = {
  title: "Career Map Editor",
  description: "Build the student Career Map — department sections, lesson nodes, unlock rules.",
  robots: { index: false, follow: false },
};

export default async function MapEditorPage() {
  await requireAdmin();
  const [data, lessons] = await Promise.all([getMapEditorData(), listPublishedLessonsForMapPicker()]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>
      <Link href="/app/admin/learn" style={{ fontFamily: "var(--font-data)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bow-blue)", textDecoration: "none" }}>
        ← Playbook Studio
      </Link>
      <h1 style={{ margin: "10px 0 4px" }}>Career Map</h1>
      <p style={{ marginBottom: 24, color: "var(--bow-slate)" }}>
        The franchise-department map students see on their home. Sections are departments; nodes are lessons or
        bonus/checkpoint/reward stops. Drag to reorder within or between sections.
      </p>
      {data.ok && lessons.ok ? (
        <MapEditor data={data} publishedLessons={lessons.lessons} />
      ) : (
        <p role="alert" style={{ color: "var(--bow-negative)" }}>
          {!data.ok ? data.error : !lessons.ok ? lessons.error : "Something went wrong."}
        </p>
      )}
    </div>
  );
}
