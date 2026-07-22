/**
 * Stage 11 — controlled cutover switch.
 *
 * A single env-driven flag gates the student route cutover from the legacy
 * cohort portal (`/app/student*`) to the new learn platform (`/dashboard`).
 * Default is ON so a fresh deploy ships the cutover. Production rollback is
 * a single env var flip (BOW_LEARN_CUTOVER=off) — no redeploy required,
 * since Vercel/host env changes take effect on the next request (Next.js
 * reads process.env per-request in server components/actions, no build-time
 * inlining for server-only reads).
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
export const CUTOVER_ENABLED = process.env.BOW_LEARN_CUTOVER !== "off";
