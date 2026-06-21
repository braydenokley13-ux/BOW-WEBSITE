"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createFeedSession,
  destroyFeedSession,
  getCurrentFeedUser,
  getFeedStories,
  upsertFeedUser,
  recordFeedResponse,
  setFeedSimComplete,
  ensureCertificateId,
} from "@/lib/feed";

export interface FeedSignupState {
  error?: string;
}

/**
 * Daily Feed sign-up: no cohort, no instructor, no school. Just an email and a
 * display name. Creates a minimal feed user, sets a session cookie the same way
 * regular users get one, and drops the visitor straight into the feed.
 */
export async function signUpForFeed(_prev: FeedSignupState, formData: FormData): Promise<FeedSignupState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!/.+@.+\..+/.test(email)) return { error: "Enter a valid email address." };
  if (displayName.length < 2) return { error: "Enter a display name (at least 2 characters)." };

  const user = upsertFeedUser(email, displayName);
  await createFeedSession(user.id);
  redirect("/feed");
}

export interface FeedDecisionResult {
  ok: boolean;
  outcome?: string;
  explanation?: string;
  concept?: string;
  decisionsCompleted?: number;
}

/** Save a decision response and reveal the real outcome + the BOW concept it illustrates. */
export async function submitFeedDecision(storyId: string, response: string): Promise<FeedDecisionResult> {
  const me = await getCurrentFeedUser();
  if (!me) return { ok: false };
  const text = response.trim();
  if (!text) return { ok: false };

  const story = getFeedStories().find((s) => s.id === storyId);
  if (!story) return { ok: false };

  const decisionsCompleted = recordFeedResponse(me.id, storyId, text);
  revalidatePath("/feed");
  return {
    ok: true,
    outcome: story.outcome,
    explanation: story.explanation,
    concept: story.concept,
    decisionsCompleted,
  };
}

export interface FeedCertificateState {
  ok: boolean;
  certificateId?: string;
}

/** Mark the Track 101 preview simulation complete and issue the certificate id. */
export async function completeFeedSimulation(): Promise<FeedCertificateState> {
  const me = await getCurrentFeedUser();
  if (!me) return { ok: false };
  setFeedSimComplete(me.id);
  const certificateId = ensureCertificateId(me.id);
  revalidatePath("/feed");
  return { ok: true, certificateId };
}

/** Sign out of the Daily Feed. */
export async function signOutFeed(): Promise<void> {
  await destroyFeedSession();
  redirect("/feed");
}
