"use server";

/* ============================================================
 * Server actions for BOW HQ → Website.
 *
 * Thin wrappers: every one of these delegates to lib/cms/admin.ts, which calls
 * `requireWebsiteEditor()` before touching a row. The authorization is in the
 * data layer rather than here on purpose — a new caller cannot forget it, and
 * a server action being publicly addressable is therefore not a hole.
 *
 * Each action returns `{ ok }` rather than throwing, so the client can show the
 * founder a sentence instead of an error boundary, and revalidates both the
 * admin screen and the public route it affects.
 * ============================================================ */

import { revalidatePath } from "next/cache";
import {
  ContentValidationError,
  archivePage,
  archivePublication,
  createPage,
  createTrack,
  deleteAnnouncement,
  deleteFaq,
  discardDraft,
  moveFaq,
  movePublication,
  publishPage,
  restoreVersion,
  saveAnnouncement,
  saveFaq,
  savePageDraft,
  savePublication,
  saveProgramContent,
  saveTrack,
  setProgramStatus,
  setTrackPublication,
  unpublishPage,
  type PageDraftInput,
  type PublicationInput,
  type ProgramContentInput,
  type TrackInput,
} from "@/lib/cms/admin";
import type { PublicationStatus, RegistrationStatus } from "@/lib/cms/status";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; problems?: string[] };

/**
 * One place that turns a thrown error into a sentence. A validation problem is
 * the founder's to fix and is quoted verbatim; anything else is ours, and is
 * logged server-side rather than shown as a stack trace.
 */
async function run(fn: () => Promise<void | ActionResult>, revalidate: string[] = []): Promise<ActionResult> {
  try {
    const result = await fn();
    for (const path of ["/app/website", ...revalidate]) revalidatePath(path);
    return result ?? { ok: true };
  } catch (error) {
    if (error instanceof ContentValidationError) return { ok: false, error: error.message };
    // `redirect()` throws a control-flow signal that must not be swallowed.
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[website] action failed:", error);
    return { ok: false, error: "That didn’t save. Nothing was changed — try again in a moment." };
  }
}

/* ---------- pages ---------- */

export async function savePageDraftAction(pageId: string, input: PageDraftInput): Promise<ActionResult> {
  return run(async () => {
    await savePageDraft(pageId, input);
    return { ok: true as const, message: "Draft saved. The public page has not changed." };
  }, [`/app/website/pages/${pageId}`]);
}

export async function publishPageAction(pageId: string, publicPath?: string | null): Promise<ActionResult> {
  return run(async () => {
    const result = await publishPage(pageId);
    if (!result.ok) {
      return {
        ok: false as const,
        error: "This page isn’t ready to publish yet.",
        problems: result.problems,
      };
    }
    return { ok: true as const, message: "Published. The public site is showing it now." };
  }, [`/app/website/pages/${pageId}`, ...(publicPath ? [publicPath] : []), "/"]);
}

export async function unpublishPageAction(pageId: string, publicPath?: string | null): Promise<ActionResult> {
  return run(async () => {
    await unpublishPage(pageId);
    return { ok: true as const, message: "Unpublished. It’s off the public site; nothing was deleted." };
  }, [`/app/website/pages/${pageId}`, ...(publicPath ? [publicPath] : []), "/"]);
}

export async function archivePageAction(pageId: string): Promise<ActionResult> {
  return run(async () => {
    await archivePage(pageId);
  }, ["/app/website/pages"]);
}

export async function discardDraftAction(pageId: string): Promise<ActionResult> {
  return run(async () => {
    await discardDraft(pageId);
    return { ok: true as const, message: "Draft discarded. You’re back to the published version." };
  }, [`/app/website/pages/${pageId}`]);
}

export async function restoreVersionAction(pageId: string, versionId: string): Promise<ActionResult> {
  return run(async () => {
    await restoreVersion(pageId, versionId);
    return { ok: true as const, message: "Restored into a draft. Review it, then publish." };
  }, [`/app/website/pages/${pageId}`]);
}

export async function createPageAction(input: { name: string; slug: string; path: string }): Promise<ActionResult> {
  return run(async () => {
    await createPage(input);
  }, ["/app/website/pages"]);
}

/* ---------- tracks ---------- */

export async function createTrackAction(input: { publicTitle: string; slug: string }): Promise<ActionResult> {
  return run(async () => {
    await createTrack(input);
  }, ["/app/website/tracks"]);
}

export async function saveTrackAction(trackId: string, input: TrackInput): Promise<ActionResult> {
  return run(async () => {
    await saveTrack(trackId, input);
  }, [`/app/website/tracks/${trackId}`, "/programs"]);
}

export async function setTrackPublicationAction(trackId: string, status: PublicationStatus): Promise<ActionResult> {
  return run(async () => {
    await setTrackPublication(trackId, status);
    return {
      ok: true as const,
      message: status === "published" ? "Track published." : status === "draft" ? "Track unpublished — it’s private again." : "Track archived.",
    };
  }, [`/app/website/tracks/${trackId}`, "/programs", "/"]);
}

/* ---------- programs ---------- */

export async function saveProgramContentAction(programId: string, input: ProgramContentInput): Promise<ActionResult> {
  return run(async () => {
    await saveProgramContent(programId, input);
  }, [`/app/website/programs/${programId}`, "/programs"]);
}

export async function setProgramStatusAction(
  programId: string,
  statuses: { publicationStatus?: PublicationStatus; registrationStatus?: RegistrationStatus },
): Promise<ActionResult> {
  return run(async () => {
    await setProgramStatus(programId, statuses);
    return { ok: true as const, message: "Status updated. The public page and its button follow it immediately." };
  }, [`/app/website/programs/${programId}`, "/programs", "/"]);
}

/* ---------- FAQs ---------- */

export async function saveFaqAction(input: {
  id?: string;
  question: string;
  answer: string;
  status: PublicationStatus;
  placements: { scopeKind: "page" | "track" | "program"; scopeKey: string }[];
}): Promise<ActionResult> {
  return run(async () => {
    await saveFaq(input);
  }, ["/app/website/faqs"]);
}

export async function moveFaqAction(faqId: string, direction: "up" | "down"): Promise<ActionResult> {
  return run(async () => {
    await moveFaq(faqId, direction);
  }, ["/app/website/faqs"]);
}

export async function deleteFaqAction(faqId: string): Promise<ActionResult> {
  return run(async () => {
    await deleteFaq(faqId);
  }, ["/app/website/faqs"]);
}

/* ---------- press coverage ---------- */

export async function savePublicationAction(input: PublicationInput): Promise<ActionResult> {
  return run(async () => {
    await savePublication(input);
    return { ok: true as const, message: input.id ? "Press record updated." : "Press record added." };
  }, ["/app/website/press", "/"]);
}

export async function movePublicationAction(
  publicationId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  return run(async () => {
    await movePublication(publicationId, direction);
  }, ["/app/website/press", "/"]);
}

export async function archivePublicationAction(publicationId: string): Promise<ActionResult> {
  return run(async () => {
    await archivePublication(publicationId);
    return { ok: true as const, message: "Press record archived. It is no longer public." };
  }, ["/app/website/press", "/"]);
}

/* ---------- announcements ---------- */

export async function saveAnnouncementAction(input: {
  id?: string;
  message: string;
  linkHref: string;
  linkLabel: string;
  startsAt: number | null;
  endsAt: number | null;
  placement: "site" | "page";
  pageSlug: string;
  audience: string;
  status: PublicationStatus;
}): Promise<ActionResult> {
  return run(async () => {
    await saveAnnouncement(input);
  }, ["/app/website/announcements", "/"]);
}

export async function deleteAnnouncementAction(announcementId: string): Promise<ActionResult> {
  return run(async () => {
    await deleteAnnouncement(announcementId);
  }, ["/app/website/announcements", "/"]);
}
