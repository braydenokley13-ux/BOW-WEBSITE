"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createFeedSession,
  destroyFeedSession,
  getCurrentFeedUser,
  getFeedStories,
  createFeedVisitor,
  recordFeedResponse,
  recordFeedSimulationDecisionEvidence,
  issueFeedCertificate,
} from "@/lib/feed";
import { clientAddressBucket, consumeRateLimit } from "@/lib/rate-limit";

export interface FeedSignupState {
  error?: string;
}

/**
 * Daily Feed entry is device-local and anonymous. Email-only identity recovery
 * allowed anyone who knew an address to claim another visitor's progress, so
 * the preview now creates a fresh opaque visitor and keeps it in a secure cookie.
 */
export async function signUpForFeed(_prev: FeedSignupState, formData: FormData): Promise<FeedSignupState> {
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (displayName.length < 2) return { error: "Enter a display name (at least 2 characters)." };
  if (displayName.length > 80) return { error: "Keep the display name under 80 characters." };
  const address = await clientAddressBucket();
  if (address) {
    const limit = (await consumeRateLimit("feed-visitor-network", address, {
          limit: 20,
          windowMs: 24 * 60 * 60 * 1000,
          blockMs: 24 * 60 * 60 * 1000,
        }));
    if (!limit.allowed) return { error: "Too many preview profiles were created from this network. Try again later." };
  }

  const user = (await createFeedVisitor(displayName));
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
  if (text.length > 2000) return { ok: false };
  const limit = (await consumeRateLimit("feed-decision-visitor", me.id, {
      limit: 120,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }));
  if (!limit.allowed) return { ok: false };

  const story = (await getFeedStories()).find((s) => s.id === storyId);
  if (!story) return { ok: false };

  const decisionsCompleted = (await recordFeedResponse(me.id, storyId, text));
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
  completedAt?: number;
}

export interface FeedSimulationDecisionState {
  ok: boolean;
  error?: string;
}

/** Persist one server-validated simulation choice before revealing its result. */
export async function recordFeedSimulationDecision(
  stepIndex: number,
  choiceId: string,
): Promise<FeedSimulationDecisionState> {
  const me = await getCurrentFeedUser();
  if (!me) return { ok: false, error: "Your Feed session expired. Refresh and start again." };
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > 20) {
    return { ok: false, error: "That simulation round is not valid." };
  }
  const cleanChoiceId = typeof choiceId === "string" ? choiceId.trim() : "";
  if (!cleanChoiceId || cleanChoiceId.length > 80) {
    return { ok: false, error: "Choose one of the available decisions." };
  }
  const limit = (await consumeRateLimit("feed-simulation-decision-visitor", me.id, {
      limit: 60,
      windowMs: 60 * 60 * 1000,
      blockMs: 60 * 60 * 1000,
    }));
  if (!limit.allowed) return { ok: false, error: "Too many simulation decisions were submitted. Try again later." };

  const recorded = (await recordFeedSimulationDecisionEvidence(me.id, stepIndex, cleanChoiceId));
  return recorded
    ? { ok: true }
    : { ok: false, error: "Complete each Feed decision and simulation round in order before continuing." };
}

/** Issue the Track 101 preview credential from server-held completion evidence. */
export async function completeFeedSimulation(): Promise<FeedCertificateState> {
  const me = await getCurrentFeedUser();
  if (!me) return { ok: false };
  const limit = (await consumeRateLimit("feed-certificate-visitor", me.id, {
      limit: 10,
      windowMs: 24 * 60 * 60 * 1000,
      blockMs: 24 * 60 * 60 * 1000,
    }));
  if (!limit.allowed) return { ok: false };
  const issued = (await issueFeedCertificate(me.id));
  if (!issued) return { ok: false };
  revalidatePath("/feed");
  return { ok: true, certificateId: issued.certificateId, completedAt: issued.completedAt };
}

/** Sign out of the Daily Feed. */
export async function signOutFeed(): Promise<void> {
  await destroyFeedSession();
  redirect("/feed");
}
