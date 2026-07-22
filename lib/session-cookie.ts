/**
 * Shared session-cookie name.
 *
 * Keep this module dependency-free: `proxy.ts` runs before route rendering and
 * must not pull the database-backed session implementation into its bundle.
 */
export const SESSION_COOKIE = "bow_session";
