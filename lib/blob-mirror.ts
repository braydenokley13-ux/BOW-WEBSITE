/* ============================================================
 * Blob mirror — durable JSON storage on Vercel Blob, no SDK.
 *
 * The SQLite file lives on a serverless filesystem that can reset on
 * any cold start (see research/07 — the project's own #1 risk). Data
 * that must OUTLIVE a deploy — ledger snapshots, reader-submitted
 * papers — is therefore mirrored here: writes go to SQLite first
 * (source of truth within a warm instance) and are copied to Blob;
 * on a cold start the store rehydrates from Blob before serving.
 *
 * Implemented against Blob's plain REST surface with fetch so the
 * repo keeps its zero-runtime-dependency stance. Every call is a
 * no-op without BLOB_READ_WRITE_TOKEN (local dev: SQLite alone is
 * durable enough), and every failure is caught and logged — a
 * mirror outage must never take down a page or a cron run.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

const API = "https://blob.vercel-storage.com";

function token(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN ?? null;
}

/** True when a Blob store is configured (i.e. mirroring is live). */
export function blobMirrorEnabled(): boolean {
  return token() !== null;
}

export interface BlobEntry {
  url: string;
  pathname: string;
  uploadedAt: string;
}

/** Upload (or overwrite) one JSON document at a fixed pathname. */
export async function blobPutJson(pathname: string, value: unknown): Promise<void> {
  const t = token();
  if (!t) return;
  try {
    const res = await fetch(`${API}/${pathname}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${t}`,
        "content-type": "application/json",
        // Fixed pathnames, deliberately: the mirror must be able to
        // find its own documents again, so no random suffixes, and
        // re-mirroring the same document replaces it.
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "1",
      },
      body: JSON.stringify(value),
    });
    if (!res.ok) console.warn(`[blob-mirror] PUT ${pathname} failed: ${res.status}`);
  } catch (err) {
    console.warn(`[blob-mirror] PUT ${pathname} failed:`, err);
  }
}

/** List mirrored documents under a prefix (oldest→newest by pathname sort). */
export async function blobList(prefix: string): Promise<BlobEntry[]> {
  const t = token();
  if (!t) return [];
  try {
    const entries: BlobEntry[] = [];
    let cursor: string | null = null;
    do {
      const params = new URLSearchParams({ prefix, limit: "1000" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`${API}?${params}`, { headers: { authorization: `Bearer ${t}` } });
      if (!res.ok) {
        console.warn(`[blob-mirror] list ${prefix} failed: ${res.status}`);
        return entries;
      }
      const data = (await res.json()) as { blobs?: BlobEntry[]; cursor?: string; hasMore?: boolean };
      entries.push(...(data.blobs ?? []));
      cursor = data.hasMore && data.cursor ? data.cursor : null;
    } while (cursor);
    return entries.sort((a, b) => a.pathname.localeCompare(b.pathname));
  } catch (err) {
    console.warn(`[blob-mirror] list ${prefix} failed:`, err);
    return [];
  }
}

/** Fetch one mirrored JSON document, or null on any failure. */
export async function blobGetJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Delete mirrored documents (used when pruning old ledger snapshots). */
export async function blobDelete(urls: string[]): Promise<void> {
  const t = token();
  if (!t || urls.length === 0) return;
  try {
    const res = await fetch(`${API}/delete`, {
      method: "POST",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) console.warn(`[blob-mirror] delete failed: ${res.status}`);
  } catch (err) {
    console.warn(`[blob-mirror] delete failed:`, err);
  }
}
