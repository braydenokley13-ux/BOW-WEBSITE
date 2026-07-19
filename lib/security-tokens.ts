import { createHash } from "node:crypto";

/** One-way digest for high-entropy bearer tokens stored in the database. */
export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
