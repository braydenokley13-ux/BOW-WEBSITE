import { redirect } from "next/navigation";

/**
 * Legacy staff session address.
 *
 * A session has one surface now — the Session Sheet at `/app/session/[sid]` —
 * which carries the attendance grid, the report, and (for staff) the plan
 * editor this page used to own. Keeping a second page pointed at the same two
 * server actions was a duplicated workflow with two chances to drift.
 *
 * Redirected rather than deleted: links to this URL exist in bookmarks and in
 * older activity records, and the sheet resolves the session by id anyway.
 */
export default async function LegacyStaffSessionPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { sid } = await params;
  redirect(`/app/session/${sid}`);
}
