"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/dal";
import { logActivity } from "@/lib/hiring";
import { revalidateEntity } from "@/lib/routes";
import type { InquiryStatus } from "@/lib/account";

const INQUIRY_STATUSES = ["new", "reviewing", "contacted", "converted_to_program", "closed", "spam"] as const;

const STAFF_TRANSITIONS: Record<InquiryStatus, readonly InquiryStatus[]> = {
  new: ["reviewing", "contacted", "closed", "spam"],
  reviewing: ["new", "contacted", "closed", "spam"],
  contacted: ["reviewing", "closed", "spam"],
  converted_to_program: [],
  closed: ["reviewing"],
  spam: ["reviewing"],
};

export interface InquiryStatusResult {
  ok: boolean;
  status?: InquiryStatus;
  error?: string;
}

class InquiryActionError extends Error {}

function isInquiryStatus(value: unknown): value is InquiryStatus {
  return typeof value === "string" && INQUIRY_STATUSES.includes(value as InquiryStatus);
}

function statusLabel(status: InquiryStatus): string {
  return status.replace(/_/g, " ");
}

/**
 * Staff-owned inquiry triage. The expected status makes stale browser tabs
 * fail visibly instead of overwriting a conversion or another staff member's
 * disposition. Program conversion remains owned by the Program transaction.
 */
export async function updateInquiryStatus(
  idValue: string,
  expectedStatusValue: InquiryStatus,
  nextStatusValue: InquiryStatus,
): Promise<InquiryStatusResult> {
  const me = await requireStaff();
  const id = typeof idValue === "string" ? idValue.trim() : "";
  if (!id || id.length > 100) return { ok: false, error: "Choose a valid inquiry." };
  if (!isInquiryStatus(expectedStatusValue) || !isInquiryStatus(nextStatusValue)) {
    return { ok: false, error: "Choose a valid inquiry status." };
  }
  if (!STAFF_TRANSITIONS[expectedStatusValue].includes(nextStatusValue)) {
    return {
      ok: false,
      error: expectedStatusValue === "converted_to_program"
        ? "Converted inquiries are historical intake records. Continue from the connected Program."
        : `This inquiry cannot move from ${statusLabel(expectedStatusValue)} to ${statusLabel(nextStatusValue)}.`,
    };
  }

  const db = getDb();
  let organizationIds: string[] = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    const inquiry = db.prepare(
      "SELECT id, organization_id, status FROM inquiries WHERE id = ?",
    ).get(id) as { id: string; organization_id: string | null; status: string } | undefined;
    if (!inquiry) throw new InquiryActionError("This inquiry no longer exists.");
    if (!isInquiryStatus(inquiry.status)) throw new InquiryActionError("This inquiry has an unsupported status.");
    if (inquiry.status !== expectedStatusValue) {
      throw new InquiryActionError(
        inquiry.status === "converted_to_program"
          ? "This inquiry was converted while the page was open. Continue from its connected Program."
          : `This inquiry is now ${statusLabel(inquiry.status)}. Refresh before changing it again.`,
      );
    }

    const updated = db.prepare(
      "UPDATE inquiries SET status = ? WHERE id = ? AND status = ?",
    ).run(nextStatusValue, id, expectedStatusValue);
    if (updated.changes !== 1) throw new InquiryActionError("This inquiry changed. Refresh and try again.");

    logActivity(
      "inquiry",
      id,
      "status_change",
      `Demand inquiry moved from ${statusLabel(expectedStatusValue)} to ${statusLabel(nextStatusValue)}.`,
      me.id,
    );

    organizationIds = (db.prepare(
      `SELECT ? AS id WHERE ? IS NOT NULL
       UNION
       SELECT p.partner_org_id AS id
         FROM programs p
        WHERE p.source_type = 'inquiry' AND p.source_id = ? AND p.partner_org_id IS NOT NULL`,
    ).all(inquiry.organization_id, inquiry.organization_id, id) as { id: string }[]).map((row) => row.id);

    db.exec("COMMIT");
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (error instanceof InquiryActionError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath("/app/inquiries");
  revalidatePath("/app");
  for (const organizationId of organizationIds) revalidateEntity("organization", organizationId);
  return { ok: true, status: nextStatusValue };
}
