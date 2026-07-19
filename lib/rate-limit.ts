import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
  blockMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function opaqueKey(scope: string, subject: string): string {
  const digest = createHash("sha256").update(`${scope}\0${subject}`).digest("hex");
  return `${scope}:${digest}`;
}

/**
 * Consume one attempt using SQLite's single-writer lock. The database stores
 * only a one-way digest of the identity/address and the check remains correct
 * across restarts and multiple Node processes sharing the durable database.
 */
export function consumeRateLimit(
  scope: string,
  subject: string,
  policy: RateLimitPolicy,
): RateLimitResult {
  const db = getDb();
  const now = Date.now();
  const key = opaqueKey(scope, subject);
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare(
      "SELECT window_started_at, attempts, blocked_until FROM security_rate_limits WHERE key = ?",
    ).get(key) as { window_started_at: number; attempts: number; blocked_until: number } | undefined;
    if (row && row.blocked_until > now) {
      db.prepare("UPDATE security_rate_limits SET updated_at = ? WHERE key = ?").run(now, key);
      db.exec("COMMIT");
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((row.blocked_until - now) / 1000)) };
    }

    const withinWindow = Boolean(row && now - row.window_started_at < policy.windowMs);
    const windowStartedAt = withinWindow && row ? row.window_started_at : now;
    const attempts = withinWindow && row ? row.attempts + 1 : 1;
    const blockedUntil = attempts > policy.limit ? now + policy.blockMs : 0;
    db.prepare(
      `INSERT INTO security_rate_limits (key, window_started_at, attempts, blocked_until, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         window_started_at = excluded.window_started_at,
         attempts = excluded.attempts,
         blocked_until = excluded.blocked_until,
         updated_at = excluded.updated_at`,
    ).run(key, windowStartedAt, attempts, blockedUntil, now);
    // Bounded housekeeping keeps abandoned identities from accumulating.
    db.prepare("DELETE FROM security_rate_limits WHERE updated_at < ?").run(now - 30 * 24 * 60 * 60 * 1000);
    db.exec("COMMIT");
    return {
      allowed: blockedUntil === 0,
      retryAfterSeconds: blockedUntil ? Math.max(1, Math.ceil((blockedUntil - now) / 1000)) : 0,
    };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original limiter failure.
    }
    throw error;
  }
}

export function clearRateLimit(scope: string, subject: string): void {
  getDb().prepare("DELETE FROM security_rate_limits WHERE key = ?").run(opaqueKey(scope, subject));
}

const TRUSTED_CLIENT_IP_HEADERS = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"] as const;

/**
 * Read only the one forwarding header that the deployment explicitly trusts.
 * Trying several headers lets a client spoof whichever higher-priority header
 * the reverse proxy forgot to remove, which makes the network limit trivial to
 * rotate. The proxy must replace the configured header with one canonical IP.
 */
export async function clientAddressBucket(): Promise<string | null> {
  const configuredHeader = (process.env.BOW_TRUSTED_CLIENT_IP_HEADER ?? "").trim().toLowerCase();
  if (!configuredHeader) return null;
  if (!(TRUSTED_CLIENT_IP_HEADERS as readonly string[]).includes(configuredHeader)) {
    throw new Error("BOW_TRUSTED_CLIENT_IP_HEADER must name a supported forwarding header.");
  }

  const requestHeaders = await headers();
  const value = requestHeaders.get(configuredHeader)?.trim();
  if (!value || value.length > 64 || value.includes(",") || isIP(value) === 0) {
    throw new Error("The trusted reverse proxy did not supply one canonical client IP.");
  }
  return value.toLowerCase();
}
