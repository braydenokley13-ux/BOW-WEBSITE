import Link from "next/link";
import { Badge, Button, PageHeader } from "@/components/ds";
import { listAdminPrograms } from "@/lib/cms/admin";
import { PUBLICATION_STATUS_LABELS, REGISTRATION_STATUS_LABELS } from "@/lib/cms/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Programs" };

export default async function ProgramContentScreen() {
  const programs = await listAdminPrograms();

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Programs"
        context="The public face of every program: what it says, what it costs, and what its signup button does."
      />

      {programs.length === 0 ? (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
          No programs exist yet. Create one in <Link href="/app/programs" className="bow-link">Programs</Link>, then
          come back here to write its public page.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--border-rule)", background: "var(--bow-white)" }}>
          {programs.map((program) => (
            <div key={program.id} className="bow-row-wrap" style={{ gridTemplateColumns: "minmax(0,1.4fr) auto auto auto", gap: 14, alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border-rule)" }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/app/website/programs/${program.id}`} className="bow-link" style={{ fontFamily: "var(--font-editorial)", fontSize: 17 }}>
                  {program.title || program.internalName}
                </Link>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {program.slug ? `/programs/p/${program.slug}` : "no web address yet"}
                  {program.startDate ? ` · starts ${program.startDate}` : ""}
                </div>
              </div>
              <Badge status={program.publicationStatus === "published" ? "positive" : program.publicationStatus === "archived" ? "neutral" : "warning"}>
                {PUBLICATION_STATUS_LABELS[program.publicationStatus]}
              </Badge>
              <Badge status={program.registrationStatus === "registration_open" ? "positive" : program.registrationStatus === "full" ? "warning" : "info"}>
                {REGISTRATION_STATUS_LABELS[program.registrationStatus]}
              </Badge>
              <Button href={`/app/website/programs/${program.id}`} variant="secondary" size="sm">Edit</Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
