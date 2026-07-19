/* ============================================================
 * Password hashing — Node's built-in scrypt (no native deps).
 *
 * Stored format: "scrypt:<saltHex>:<hashHex>". Verification is
 * constant-time. This module is server-only; never import it into
 * a client component.
 * ============================================================ */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;
const PUBLIC_DEMO_PASSWORD = "bowdemo123";

/** Password published in historical local demo instructions; never accept it for a real account. */
export function isPublicDemoPassword(password: string): boolean {
  return password === PUBLIC_DEMO_PASSWORD;
}

/**
 * Fixed non-account hash used when an email is unknown. Running the same
 * scrypt verification path makes account-existence timing less distinguishable.
 */
export const DUMMY_PASSWORD_HASH =
  "scrypt:6cdaae17e7a1634b13f017d16b7044cb:acb2a54d3ae218780532a2c457abb9f655581ac0f8f8699ded4be9218c94af0b406c8e728340ad751452b18be3f4848e8d9fe289b45a3ba7029703d53b4cce00";

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
