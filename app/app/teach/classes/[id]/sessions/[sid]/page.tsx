import { redirect } from "next/navigation";

/**
 * Legacy instructor session address.
 *
 * The Session Sheet at `/app/session/[sid]` is the one surface now, and it
 * enforces the same membership check this page did: an instructor may only
 * open a class they have actually accepted, and anyone else gets a 404. It
 * also carries the preparation form this page owned.
 *
 * Redirected rather than deleted — instructors have this URL in their history,
 * and the sheet resolves the session by id.
 */
export default async function LegacyTeachSessionPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { sid } = await params;
  redirect(`/app/session/${sid}`);
}
