import { Badge, Button, PageHeader } from "@/components/ds";
import { listCurricula } from "@/lib/hiring";

export default async function CurriculumPage() {
  const curricula = (await listCurricula());
  return (
    <main className="ops-page">
      <PageHeader
        eyebrow="Programs · Curriculum library"
        title="Curriculum"
        context={`Published curricula classes are built on. ${curricula.length} total.`}
        action={<Button href="/app/curriculum/new" variant="emphasis">New Curriculum</Button>}
      />

      {curricula.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No curricula yet.</h2>
          <p className="ops-empty__body">Create the first curriculum so classes have something published to build on.</p>
        </section>
      ) : (
        <section className="ops-panel ops-panel--flat" aria-label="Curriculum list">
          <div className="ops-list">
            {curricula.map((c) => (
              <article className="ops-list-row ops-list-row--compact" key={c.id}>
                <div>
                  <span className="ops-record-name" style={{ fontSize: 16 }}>{c.title}</span>
                  <span className="ops-record-meta">{c.ageRange ?? "—"}</span>
                </div>
                <div><Badge status={c.published ? "positive" : "neutral"}>{c.published ? "Published" : "Draft"}</Badge></div>
                <Button href={`/app/curriculum/${c.id}`} variant="secondary" size="sm">View</Button>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
