/* ============================================================
 * Draft preview — who is allowed to see unpublished content.
 *
 * Preview is gated twice, and both gates are server-side:
 *
 *   1. Next's Draft Mode cookie must be set. It is unguessable and rotates on
 *      every build, and only `/api/website/preview` can set it — that route
 *      checks authorization before calling `enable()`.
 *   2. The request must *still* carry an admin session. A cookie that outlives
 *      the session it was issued for grants nothing, so a shared or leaked
 *      preview link is inert for anyone who is not signed in as a founder.
 *
 * Public rendering therefore cannot be talked into a draft read by a header, a
 * query string, or a stale cookie alone.
 *
 * Server-only.
 * ============================================================ */

import "server-only";

import { cache } from "react";
import { draftMode } from "next/headers";
import { getCurrentUser } from "@/lib/dal";

/** The single role that may edit and preview the public website. */
export const WEBSITE_EDITOR_ROLES = ["admin"] as const;

export const isWebsiteEditor = cache(async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    return Boolean(user && (WEBSITE_EDITOR_ROLES as readonly string[]).includes(user.role));
  } catch {
    // A signed-out visitor, or an unreachable session store, is simply not an
    // editor. This must never throw: it runs on every public page.
    return false;
  }
});

/**
 * True when this request should render drafts. Every public page passes the
 * result to the content layer; nothing else may construct a preview read.
 */
export const previewEnabled = cache(async (): Promise<boolean> => {
  let cookieSet = false;
  try {
    cookieSet = (await draftMode()).isEnabled;
  } catch {
    return false;
  }
  if (!cookieSet) return false;
  return isWebsiteEditor();
});

/**
 * Staff see a diagnostic line on error states. That is the same check as
 * preview authorization, minus the Draft Mode cookie — a founder debugging a
 * broken page has not necessarily entered preview mode.
 */
export const staffDiagnosticsEnabled = cache(async (): Promise<boolean> => isWebsiteEditor());
