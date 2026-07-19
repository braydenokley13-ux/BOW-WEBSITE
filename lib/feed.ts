/* ============================================================
 * BOW Daily Feed (Proposal 3) — data layer + session.
 *
 * The Daily Feed is a standalone experience: a visitor needs no
 * cohort, instructor, school, or verified identity. They choose a display
 * name, get a device-local `feed_users` row, and carry an opaque session
 * token in an HttpOnly cookie — exactly the way lib/session.ts works
 * for regular users, but against the `feed_sessions` table so the two
 * audiences never collide.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import {
  FEED_DECISIONS_TO_UNLOCK,
  feedStories as feedStorySeed,
  type FeedStory,
  type FeedUser,
} from "@/lib/account";
import { SIM } from "@/lib/simulation";

export const FEED_SESSION_COOKIE = "bow_feed_session";
export const FEED_SIMULATION_KEY = "track-101-asset-everyone-wants";
export const FEED_SIMULATION_EVIDENCE_VERSION = 1;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — low-stakes, no PII beyond a name
const digestFeedToken = (token: string): string => createHash("sha256").update(token).digest("hex");

class FeedEvidenceError extends Error {}

/* ---------------- mappers ---------------- */
/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToFeedUser(r: any): FeedUser {
  const completedAt = Number(r.sim_completed_at);
  const evidenceVersion = Number(r.certificate_evidence_version);
  const credentialComplete = Boolean(
    r.sim_completed
      && typeof r.certificate_id === "string"
      && r.certificate_id
      && Number.isSafeInteger(completedAt)
      && completedAt > 0
      && r.certificate_evidence_version != null
      && Number.isInteger(evidenceVersion)
      && evidenceVersion >= 0,
  );
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    createdAt: Number(r.created_at),
    decisionsCompleted: Number(r.decisions_completed) || 0,
    simCompleted: credentialComplete,
    certificateId: credentialComplete ? r.certificate_id : null,
    certificateCompletedAt: credentialComplete ? completedAt : null,
  };
}

function rowToFeedStory(r: any): FeedStory {
  return {
    id: r.id,
    ordinal: Number(r.ordinal),
    headline: r.headline,
    framing: r.framing,
    prompt: r.prompt,
    concept: r.concept,
    outcome: r.outcome,
    explanation: r.explanation,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ---------------- stories ---------------- */

/** The ordered Daily Feed stories (DB first, falling back to the seed). */
export function getFeedStories(): FeedStory[] {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const rows = getDb().prepare("SELECT * FROM feed_stories ORDER BY ordinal ASC").all() as any[];
  if (rows.length === 0) return [...feedStorySeed].sort((a, b) => a.ordinal - b.ordinal);
  return rows.map(rowToFeedStory);
}

/* ---------------- session ---------------- */

export async function createFeedSession(feedUserId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const tokenDigest = digestFeedToken(token);
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  getDb()
    .prepare("INSERT INTO feed_sessions (token, feed_user_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenDigest, feedUserId, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(FEED_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroyFeedSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(FEED_SESSION_COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM feed_sessions WHERE token = ?").run(digestFeedToken(token));
  cookieStore.delete(FEED_SESSION_COOKIE);
}

/** Resolve the current feed visitor from the session cookie, or null. */
export async function getCurrentFeedUser(): Promise<FeedUser | null> {
  const token = (await cookies()).get(FEED_SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenDigest = digestFeedToken(token);

  const db = getDb();
  const row = db
    .prepare(
      "SELECT u.*, s.expires_at AS __exp, s.token AS __session_token FROM feed_sessions s JOIN feed_users u ON u.id = s.feed_user_id WHERE s.token = ?",
    )
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .get(tokenDigest) as any;

  if (!row) return null;
  if (Number(row.__exp) < Date.now()) {
    db.prepare("DELETE FROM feed_sessions WHERE token = ?").run(tokenDigest);
    return null;
  }
  return rowToFeedUser(row);
}

/* ---------------- mutations (called by server actions) ---------------- */

/** Create a new device-local preview visitor. No email is used as authentication. */
export function createFeedVisitor(displayName: string): FeedUser {
  const db = getDb();
  const cleanName = displayName.trim().slice(0, 60);
  const id = `feed-${randomUUID()}`;
  const anonymousAddress = `${id}@anonymous.invalid`;
  const createdAt = Date.now();
  db.prepare(
    "INSERT INTO feed_users (id, email, display_name, created_at, decisions_completed, sim_completed, certificate_id) VALUES (?, ?, ?, ?, 0, 0, NULL)",
  ).run(id, anonymousAddress, cleanName, createdAt);
  return {
    id,
    email: anonymousAddress,
    displayName: cleanName,
    createdAt,
    decisionsCompleted: 0,
    simCompleted: false,
    certificateId: null,
    certificateCompletedAt: null,
  };
}

export function getFeedUserById(id: string): FeedUser | null {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const row = getDb().prepare("SELECT * FROM feed_users WHERE id = ?").get(id) as any;
  return row ? rowToFeedUser(row) : null;
}

/** Story ids this visitor has already answered. */
export function getAnsweredStoryIds(feedUserId: string): string[] {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const rows = getDb().prepare("SELECT story_id FROM feed_responses WHERE feed_user_id = ?").all(feedUserId) as any[];
  return rows.map((r) => r.story_id as string);
}

/**
 * Save a visitor's response to a story (idempotent per story). Returns the new
 * total of distinct decisions completed.
 */
export function recordFeedResponse(feedUserId: string, storyId: string, response: string): number {
  const db = getDb();
  const id = `fr-${randomUUID().slice(0, 12)}`;
  db.prepare(
    "INSERT OR IGNORE INTO feed_responses (id, feed_user_id, story_id, response, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, feedUserId, storyId, response.trim(), Date.now());

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM feed_responses WHERE feed_user_id = ?").get(feedUserId) as any;
  const count = Number(n) || 0;
  db.prepare("UPDATE feed_users SET decisions_completed = ? WHERE id = ?").run(count, feedUserId);
  return count;
}

function countVerifiedFeedDecisions(feedUserId: string): number {
  const row = getDb().prepare(
    `SELECT COUNT(DISTINCT fr.story_id) AS n
       FROM feed_responses fr
       JOIN feed_stories fs ON fs.id = fr.story_id
      WHERE fr.feed_user_id = ?`,
  ).get(feedUserId) as { n: number };
  return Number(row.n) || 0;
}

function isIssuedCredential(row: {
  sim_completed: number;
  certificate_id: string | null;
  sim_completed_at: number | null;
  certificate_evidence_version: number | null;
}): boolean {
  return row.sim_completed === 1
    && Boolean(row.certificate_id)
    && Number.isSafeInteger(Number(row.sim_completed_at))
    && Number(row.sim_completed_at) > 0
    && row.certificate_evidence_version != null
    && Number.isInteger(Number(row.certificate_evidence_version))
    && Number(row.certificate_evidence_version) >= 0;
}

/**
 * Persist one validated simulation choice. The writer lock makes the sequence
 * check and evidence write one decision: a caller cannot skip directly to a
 * later round or race two different rounds into an apparently complete run.
 */
export function recordFeedSimulationDecisionEvidence(
  feedUserId: string,
  stepIndex: number,
  choiceId: string,
): boolean {
  const step = SIM[stepIndex];
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || !step) return false;
  if (!step.options.some((option) => option.id === choiceId)) return false;

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const user = db.prepare(
      `SELECT sim_completed, certificate_id, sim_completed_at, certificate_evidence_version
         FROM feed_users WHERE id = ?`,
    ).get(feedUserId) as {
      sim_completed: number;
      certificate_id: string | null;
      sim_completed_at: number | null;
      certificate_evidence_version: number | null;
    } | undefined;
    if (!user) throw new FeedEvidenceError("visitor_missing");
    if (isIssuedCredential(user)) {
      db.exec("COMMIT");
      return true;
    }
    if (countVerifiedFeedDecisions(feedUserId) < FEED_DECISIONS_TO_UNLOCK) {
      throw new FeedEvidenceError("feed_decisions_incomplete");
    }

    const recorded = db.prepare(
      `SELECT step_index
         FROM feed_simulation_responses
        WHERE feed_user_id = ? AND simulation_key = ? AND evidence_version = ?`,
    ).all(feedUserId, FEED_SIMULATION_KEY, FEED_SIMULATION_EVIDENCE_VERSION) as { step_index: number }[];
    const recordedSteps = new Set(recorded.map((row) => Number(row.step_index)));
    for (let prior = 0; prior < stepIndex; prior += 1) {
      if (!recordedSteps.has(prior)) throw new FeedEvidenceError("simulation_out_of_sequence");
    }

    // Replaying or changing an earlier round starts a new coherent suffix.
    // Later choices from an abandoned partial run must not satisfy issuance.
    db.prepare(
      `DELETE FROM feed_simulation_responses
        WHERE feed_user_id = ? AND simulation_key = ? AND evidence_version = ?
          AND step_index > ?`,
    ).run(feedUserId, FEED_SIMULATION_KEY, FEED_SIMULATION_EVIDENCE_VERSION, stepIndex);

    db.prepare(
      `INSERT INTO feed_simulation_responses
        (feed_user_id, simulation_key, evidence_version, step_index, choice_id, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(feed_user_id, simulation_key, evidence_version, step_index)
       DO UPDATE SET choice_id = excluded.choice_id, recorded_at = excluded.recorded_at`,
    ).run(
      feedUserId,
      FEED_SIMULATION_KEY,
      FEED_SIMULATION_EVIDENCE_VERSION,
      stepIndex,
      choiceId,
      Date.now(),
    );
    db.exec("COMMIT");
    return true;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (error instanceof FeedEvidenceError) return false;
    throw error;
  }
}

export interface FeedCertificateIssuance {
  certificateId: string;
  completedAt: number;
}

/**
 * Issue the credential once, atomically, from server-held evidence. Existing
 * issued credentials are returned unchanged; certificate identity and date
 * are additionally protected by a database trigger created during migration.
 */
export function issueFeedCertificate(feedUserId: string): FeedCertificateIssuance | null {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const user = db.prepare(
      `SELECT sim_completed, certificate_id, sim_completed_at, certificate_evidence_version
         FROM feed_users WHERE id = ?`,
    ).get(feedUserId) as {
      sim_completed: number;
      certificate_id: string | null;
      sim_completed_at: number | null;
      certificate_evidence_version: number | null;
    } | undefined;
    if (!user) throw new FeedEvidenceError("visitor_missing");
    if (isIssuedCredential(user)) {
      db.exec("COMMIT");
      return { certificateId: user.certificate_id as string, completedAt: Number(user.sim_completed_at) };
    }
    if (countVerifiedFeedDecisions(feedUserId) < FEED_DECISIONS_TO_UNLOCK) {
      throw new FeedEvidenceError("feed_decisions_incomplete");
    }

    const evidence = db.prepare(
      `SELECT step_index, choice_id
         FROM feed_simulation_responses
        WHERE feed_user_id = ? AND simulation_key = ? AND evidence_version = ?
        ORDER BY step_index`,
    ).all(feedUserId, FEED_SIMULATION_KEY, FEED_SIMULATION_EVIDENCE_VERSION) as {
      step_index: number;
      choice_id: string;
    }[];
    const choicesByStep = new Map(evidence.map((row) => [Number(row.step_index), row.choice_id]));
    const completeEvidence = SIM.every((simulationStep, index) => {
      const choice = choicesByStep.get(index);
      return Boolean(choice && simulationStep.options.some((option) => option.id === choice));
    });
    if (!completeEvidence || choicesByStep.size !== SIM.length) {
      throw new FeedEvidenceError("simulation_incomplete");
    }

    const certificateId = user.certificate_id ?? randomUUID();
    const completedAt = Number(user.sim_completed_at) > 0 ? Number(user.sim_completed_at) : Date.now();
    const updated = db.prepare(
      `UPDATE feed_users
          SET sim_completed = 1,
              certificate_id = COALESCE(certificate_id, ?),
              sim_completed_at = COALESCE(sim_completed_at, ?),
              certificate_evidence_version = ?
        WHERE id = ?`,
    ).run(certificateId, completedAt, FEED_SIMULATION_EVIDENCE_VERSION, feedUserId);
    if (updated.changes !== 1) throw new FeedEvidenceError("visitor_changed");

    const issued = db.prepare(
      "SELECT certificate_id, sim_completed_at FROM feed_users WHERE id = ?",
    ).get(feedUserId) as { certificate_id: string | null; sim_completed_at: number | null } | undefined;
    if (!issued?.certificate_id || !Number.isSafeInteger(Number(issued.sim_completed_at)) || Number(issued.sim_completed_at) <= 0) {
      throw new Error("Feed certificate issuance did not persist its immutable metadata.");
    }
    db.exec("COMMIT");
    return { certificateId: issued.certificate_id, completedAt: Number(issued.sim_completed_at) };
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    if (error instanceof FeedEvidenceError) return null;
    throw error;
  }
}
