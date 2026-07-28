import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { PageHeader, PageSection, DataTable } from "@/components/ds";
import { sweepExpirations } from "@/lib/enrollment";
import { loadProgramSummary } from "@/lib/program-admin";
import WaitlistOfferButton from "@/components/admin/enrollment/WaitlistOfferButton";

interface WaitlistRow {
  id: string;
  student_id: string;
  student_name: string;
  grade: string | null;
  guardian_name: string | null;
  waitlist_seq: number | null;
  created_at: number;
  offer_status: string | null;
  offer_expires_at: number | null;
}

const COLUMN_ORDER = ["waiting", "offer ready", "offer sent", "offer expiring", "accepted", "declined", "expired", "ineligible", "withdrawn"] as const;

function columnFor(row: WaitlistRow, now: number): (typeof COLUMN_ORDER)[number] {
  if (row.offer_status === "sent") {
    return row.offer_expires_at && row.offer_expires_at - now < 48 * 60 * 60 * 1000 ? "offer expiring" : "offer sent";
  }
  if (row.offer_status === "accepted") return "accepted";
  if (row.offer_status === "declined") return "declined";
  if (row.offer_status === "expired") return "expired";
  return "waiting";
}

/** Grouping is time-sensitive (offer-expiring vs offer-sent), so it is kept
 * out of the component body — this is plain data shaping, not render logic. */
function groupIntoColumns(rows: WaitlistRow[]): Map<string, WaitlistRow[]> {
  const now = Date.now();
  const columns = new Map<string, WaitlistRow[]>();
  for (const key of COLUMN_ORDER) columns.set(key, []);
  for (const row of rows) columns.get(columnFor(row, now))!.push(row);
  return columns;
}

function fmt(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function WaitlistBoardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  await sweepExpirations();

  const summary = await loadProgramSummary(id);
  if (!summary) notFound();

  const db = getDb();
  const program = (await db.prepare("SELECT waitlist_mode FROM programs WHERE id = ?").get(id)) as { waitlist_mode: string } | undefined;

  const rows = (await db
    .prepare(
      `SELECT r.id, r.student_id, s.name AS student_name, s.grade, g.name AS guardian_name, r.waitlist_seq, r.created_at,
              wo.status AS offer_status, wo.expires_at AS offer_expires_at
         FROM program_registrations r
         JOIN students s ON s.id = r.student_id
         LEFT JOIN people g ON g.id = r.guardian_person_id
         LEFT JOIN LATERAL (
           SELECT status, expires_at FROM waitlist_offers WHERE registration_id = r.id ORDER BY created_at DESC LIMIT 1
         ) wo ON true
        WHERE r.program_id = ? AND (r.status = 'waitlisted' OR (r.status = 'offer_sent'))
        ORDER BY r.waitlist_seq NULLS LAST, r.created_at`,
    )
    .all(id)) as unknown as WaitlistRow[];

  const columns = groupIntoColumns(rows);

  return (
    <div>
      <PageHeader
        eyebrow="Programs · Waitlist"
        title={summary.name}
        context={`Waitlist mode: ${program?.waitlist_mode ?? "disabled"}. Ordering is first-waitlisted, first-offered — never shown to families as a position.`}
        action={
          <Link href={`/app/programs/${id}/enrollment`} className="bow-button bow-button--secondary bow-button--sm">
            Back to enrollment
          </Link>
        }
      />

      {program?.waitlist_mode === "manual" && (
        <PageSection title="Waiting — select a family to offer a seat" noRule>
          <DataTable
            columns={["Child", "Grade", "Guardian", "Waiting since", ""]}
            minWidth={720}
            isEmpty={(columns.get("waiting") ?? []).length === 0}
            emptyLabel="No families are waiting."
          >
            {(columns.get("waiting") ?? []).map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <td style={{ padding: "10px 12px" }}>{row.student_name}</td>
                <td style={{ padding: "10px 12px" }}>{row.grade ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>{row.guardian_name ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>{fmt(row.created_at)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <WaitlistOfferButton registrationId={row.id} studentName={row.student_name} />
                </td>
              </tr>
            ))}
          </DataTable>
        </PageSection>
      )}

      <PageSection title="Board">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {COLUMN_ORDER.map((key) => (
            <div key={key} style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: 10, minHeight: 80 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--bow-slate)", marginBottom: 6 }}>
                {key} ({(columns.get(key) ?? []).length})
              </div>
              {(columns.get(key) ?? []).map((row) => (
                <div key={row.id} style={{ fontSize: 13, padding: "4px 0", borderTop: "1px solid var(--border-rule)" }}>
                  {row.student_name}
                  {row.offer_expires_at && key.startsWith("offer") && (
                    <div style={{ fontSize: 11, color: "var(--bow-slate)" }}>Expires {fmt(row.offer_expires_at)}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </PageSection>
    </div>
  );
}
