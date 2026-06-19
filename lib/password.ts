/* ============================================================
 * Password hashing — Node's built-in scrypt (no native deps).
 *
 * Stored format: "scrypt:<saltHex>:<hashHex>". Verification is
 * constant-time. This module is server-only; never import it into
 * a client component.
 * ============================================================ */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const target = Buffer.from(hashHex, "hex");
  let derived: Buffer;
  try {
    derived = scryptSync(password, salt, target.length);
  } catch {
    return false;
  }
  return derived.length === target.length && timingSafeEqual(derived, target);
}
