import { Badge, DataTable, Tabs } from "@/components/ds";
import { getDb, rowToPerson } from "@/lib/db";
import { listClassProposals, listCurricula } from "@/lib/hiring";
import ProposalActions from "@/components/app/classes/ProposalActions";

const STATUS_BADGE: Record<string, "positive" | "warning" | "negative" | "info" | "neutral"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "positive",
  declined: "negative",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function ClassProposalsPage() {
  const proposals = (await listClassProposals()).filter((p) => p.status !== "draft");
  const curricula = (await listCurricula());
  const db = getDb();

  const instructorName = async (instructorId: string): Promise<string> => {
    const row = (await db.prepare("SELECT person_id FROM instructors WHERE id = ?").get(instructorId)) as { person_id: string } | undefined;
    if (!row) return instructorId;
    const person = (await db.prepare("SELECT * FROM people WHERE id = ?").get(row.person_id)) as any;
    return person ? rowToPerson(person).name : instructorId;
  };

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">BOW HQ · Classes</span>
          <h1 className="ops-title">Class proposals</h1>
          <p className="ops-summary">Instructor-submitted class proposals awaiting review, decision, or conversion into a real class.</p>
        </div>
      </header>

      <Tabs
        items={[
          { label: "Classes", href: "/app/classes" },
          { label: "Proposals", href: "/app/classes/proposals", count: proposals.filter((p) => p.status === "submitted").length },
        ]}
      />

      <DataTable
        columns={["Title", "Instructor", "Age group", "Format", "Status", ""]}
        isEmpty={proposals.length === 0}
        emptyLabel="No proposals submitted yet."
      >
        {(await Promise.all(proposals.map(async (p) => (
                        <tr key={p.id}>
                          <td style={{ padding: "11px 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{p.title}</td>
                          <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{(await instructorName(p.instructorId))}</td>
                          <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{p.ageGroup || "—"}</td>
                          <td style={{ padding: "11px 12px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{p.format || "—"}</td>
                          <td style={{ padding: "11px 12px" }}>
                            <Badge status={STATUS_BADGE[p.status] ?? "neutral"}>{p.status}</Badge>
                          </td>
                          <td style={{ padding: "11px 12px", textAlign: "right" }}>
                            <ProposalActions
                              proposalId={p.id}
                              status={p.status}
                              convertedClassId={p.convertedClassId}
                              convertedProgramId={
                                p.convertedClassId
                                  ? (((await db.prepare("SELECT program_id FROM classes WHERE id = ?").get(p.convertedClassId)) as { program_id: string | null } | undefined)?.program_id ?? null)
                                  : null
                              }
                              description={p.description}
                              curricula={curricula.map((c) => ({ id: c.id, title: c.title }))}
                            />
                          </td>
                        </tr>
                      ))))}
      </DataTable>
    </main>
  );
}
