import Link from "next/link";
import ProgramEditor from "@/components/admin/website/ProgramEditor";
import { getAdminProgram, listAdminTracks } from "@/lib/cms/admin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getAdminProgram(id);
  return { title: program ? `Edit — ${program.publicTitle || program.internalName}` : "Edit program" };
}

export default async function EditProgramScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [program, tracks] = await Promise.all([getAdminProgram(id), listAdminTracks()]);

  if (!program) {
    return (
      <div style={{ padding: "40px 0" }}>
        <h1 style={{ fontFamily: "var(--font-editorial)", fontSize: 26 }}>That program doesn’t exist any more.</h1>
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
          <Link href="/app/website/programs" className="bow-link">Back to Programs</Link>
        </p>
      </div>
    );
  }

  return (
    <ProgramEditor
      program={program}
      trackOptions={tracks.map((track) => ({ value: track.id, label: track.title || track.internalTitle }))}
    />
  );
}
