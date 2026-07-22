/**
 * Stage 11 — controlled cutover switch.
 *
 * A single env-driven flag gates the student route cutover from the legacy
 * cohort portal (`/app/student*`) to the new learn platform (`/dashboard`).
 * Default is OFF so a missing or malformed value cannot cut students over
 * accidentally. Once migration 009 is applied, the database-backed flag is
 * authoritative and can be changed safely from Playbook Studio without a
 * rebuild or deployment. The environment variable is a pre-migration
 * fallback only.
 *
 * When ON:
 *   - /app/student, /app/student/track, /app/student/lesson redirect to
 *     /dashboard (see those page.tsx files).
 *   - Student nav points at /dashboard as Home.
 * When OFF:
 *   - Legacy pages render as they did before Stage 11.
 *   - Student nav points at the legacy /app/student surface.
 *
 * This does not gate the new platform's existence — /dashboard and the
 * lesson player are unaffected by this flag either way, so a student who
 * already bookmarked /dashboard keeps working during rollback. The flag
 * only controls where the *legacy entry points* send people and what the
 * nav advertises as Home.
 */
export function isLearnCutoverEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "on";
}

/** Read inside the request, never at module initialization/build time. */
export async function getLearnCutoverEnabled(): Promise<boolean> {
  try {
    const { getDb } = await import("@/lib/db");
    const row = (await getDb().prepare(
      "SELECT enabled FROM app_feature_flags WHERE key = 'learn_cutover'",
    ).get()) as { enabled: boolean } | undefined;
    if (row) return Boolean(row.enabled);
  } catch (error) {
    // A deploy may briefly precede migration 009. Only the missing-table case
    // falls back; real database failures remain visible instead of silently
    // changing student routing.
    if (!(error && typeof error === "object" && "code" in error && error.code === "42P01")) throw error;
  }
  return isLearnCutoverEnabled(process.env.BOW_LEARN_CUTOVER);
}
