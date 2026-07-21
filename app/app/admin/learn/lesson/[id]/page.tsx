import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { getLessonDraft } from "@/app/actions/learn-author";
import BuilderShell from "@/components/learn/builder/BuilderShell";

export const metadata = {
  title: "Playbook Studio · BOW HQ",
  robots: { index: false, follow: false },
};

export default async function LessonBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const result = await getLessonDraft(id);
  if (!result.ok) notFound();

  return (
    <BuilderShell
      lessonId={result.id}
      initialDoc={result.doc}
      initialRevision={result.draftRevision}
      publishedVersion={result.publishedVersion}
    />
  );
}
