import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, PageHeader, PageSection } from "@/components/ds";
import { getCurrentUser } from "@/lib/dal";
import { getDb, rowToCurriculum, rowToClass } from "@/lib/db";
import CurriculumForm from "@/components/app/curriculum/CurriculumForm";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function CurriculumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  const db = getDb();
  const row = (await db.prepare("SELECT * FROM curricula WHERE id = ?").get(id)) as any;
  if (!row) notFound();
  const curriculum = rowToCurriculum(row);
  const classes = ((await db.prepare("SELECT * FROM classes WHERE curriculum_id = ? ORDER BY updated_at DESC").all(id)) as any[]).map(rowToClass);

  return (
    <main className="ops-page">
      <PageHeader
        eyebrow="Curriculum"
        title={curriculum.title}
        context={curriculum.description ?? undefined}
        meta={[
          { label: "Status", value: <Badge status={curriculum.published ? "positive" : "neutral"}>{curriculum.published ? "Published" : "Draft"}</Badge> },
          ...(curriculum.ageRange ? [{ label: "Age range", value: curriculum.ageRange }] : []),
        ]}
      />

      <PageSection title="Classes built on this curriculum" noRule>
        {classes.length === 0 ? (
          <p className="ops-body">No classes yet.</p>
        ) : (
          <div className="ops-list">
            {classes.map((c) => (
              <article className="ops-list-row ops-list-row--compact" key={c.id}>
                <Link className="ops-record-name" style={{ fontSize: 15 }} href={`/app/classes/${c.id}`}>{c.title}</Link>
                <span className="ops-record-meta">{c.status}</span>
                <div />
              </article>
            ))}
          </div>
        )}
      </PageSection>

      {me?.role === "admin" && (
        <PageSection title="Edit">
          <CurriculumForm
            mode="edit"
            curriculumId={curriculum.id}
            initial={{ title: curriculum.title, description: curriculum.description ?? "", ageRange: curriculum.ageRange ?? "", published: curriculum.published }}
          />
        </PageSection>
      )}
    </main>
  );
}
