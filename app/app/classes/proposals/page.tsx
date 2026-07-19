import { Badge, DataTable, SectionHeader, Tabs } from "@/components/ds";
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
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px clamp(16px,4vw,32px) 96px", display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader kicker="BOW HQ" title="Classes" level={1} />
      <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", maxWidth: 640 }}>
        Instructor-submitted class proposals awaiting review, decision, or conversion into a real class.
      </p>

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
                        <tr key={p.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
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
    </div>
  );
}
