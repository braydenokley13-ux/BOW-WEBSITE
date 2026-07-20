import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ds";
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
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Curriculum</span>
          <h1 className="ops-title">{curriculum.title}</h1>
          <div className="ops-status-line">
            <Badge status={curriculum.published ? "positive" : "neutral"}>{curriculum.published ? "Published" : "Draft"}</Badge>
            {curriculum.ageRange && <Badge status="neutral">{curriculum.ageRange}</Badge>}
          </div>
          {curriculum.description && <p className="ops-summary">{curriculum.description}</p>}
        </div>
      </header>

      <section className="ops-panel ops-panel--flat" aria-labelledby="curriculum-classes-title">
        <div className="ops-section-head">
          <div><h2 id="curriculum-classes-title" className="ops-section-title">Classes built on this curriculum</h2></div>
        </div>
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
      </section>

      {me?.role === "admin" && (
        <section className="ops-panel ops-panel--flat" aria-labelledby="curriculum-edit-title">
          <div className="ops-section-head">
            <div><h2 id="curriculum-edit-title" className="ops-section-title">Edit</h2></div>
          </div>
          <CurriculumForm
            mode="edit"
            curriculumId={curriculum.id}
            initial={{ title: curriculum.title, description: curriculum.description ?? "", ageRange: curriculum.ageRange ?? "", published: curriculum.published }}
          />
        </section>
      )}
    </main>
  );
}
