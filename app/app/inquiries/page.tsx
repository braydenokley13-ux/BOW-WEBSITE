import DemandInboxClient from "@/components/app/inquiries/AdminInquiriesClient";
import { requireStaff } from "@/lib/dal";
import { getDb } from "@/lib/db";
import type { Inquiry, InquiryStatus } from "@/lib/account";

const INQUIRY_STATUSES = new Set<InquiryStatus>([
  "new",
  "reviewing",
  "contacted",
  "converted_to_program",
  "closed",
  "spam",
]);

export default async function InquiriesPage() {
  await requireStaff();
  const db = getDb();
  const rows = (await db.prepare(
      `SELECT id, name, email, type, org_name, date, status, summary
       FROM inquiries
      ORDER BY CASE status
        WHEN 'new' THEN 0
        WHEN 'reviewing' THEN 1
        WHEN 'contacted' THEN 2
        WHEN 'converted_to_program' THEN 3
        WHEN 'closed' THEN 4
        WHEN 'spam' THEN 5
        ELSE 6
      END, rowid DESC`,
    ).all()) as {
    id: string;
    name: string;
    email: string;
    type: string;
    org_name: string;
    date: string;
    status: string;
    summary: string;
  }[];
  const inquiries: Inquiry[] = rows.flatMap((row) => INQUIRY_STATUSES.has(row.status as InquiryStatus)
    ? [{
      id: row.id,
      name: row.name,
      email: row.email,
      type: row.type,
      orgName: row.org_name,
      date: row.date,
      status: row.status as InquiryStatus,
      summary: row.summary,
    }]
    : []);

  const programs = (await db.prepare(
      `SELECT source_id, id, name
       FROM programs
      WHERE source_type = 'inquiry' AND source_id IS NOT NULL
      ORDER BY created_at DESC`,
    ).all()) as { source_id: string; id: string; name: string }[];
  const convertedPrograms: Record<string, { id: string; name: string }> = {};
  for (const program of programs) {
    if (!convertedPrograms[program.source_id]) {
      convertedPrograms[program.source_id] = { id: program.id, name: program.name };
    }
  }

  return <DemandInboxClient inquiries={inquiries} convertedPrograms={convertedPrograms} />;
}
