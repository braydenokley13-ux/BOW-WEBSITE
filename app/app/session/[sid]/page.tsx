import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { getDb } from "@/lib/db";

/**
 * The canonical session address.
 *
 * Home and the class record both link here, so a session has one URL that does
 * not depend on knowing its class id or whether the viewer is staff or the
 * instructor teaching it.
 *
 * Until the Session Sheet lands (Checkpoint 4) this resolves the session's
 * class and hands over to the existing run surface for the viewer's role —
 * which keeps every link live rather than shipping a dead route. The redirect
 * is deliberately role-aware because the two existing pages enforce different
 * membership checks, and neither should be reachable by the wrong person.
 */
export default async function SessionPage({ params }: { params: Promise<{ sid: string }> }) {
  const me = await requireUser();
  const { sid } = await params;

  const row = (await getDb()
    .prepare("SELECT class_id FROM class_sessions WHERE id = ?")
    .get(sid)) as { class_id: string } | undefined;
  if (!row) notFound();

  if (me.role === "instructor") redirect(`/app/teach/classes/${row.class_id}/sessions/${sid}`);
  redirect(`/app/classes/${row.class_id}/sessions/${sid}`);
}
