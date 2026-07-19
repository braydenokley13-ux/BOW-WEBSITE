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
 * no-op without a configured token (local dev: SQLite alone is
 * durable enough), and every failure is caught and logged — callers
 * receive a result so privacy-sensitive workflows can decide whether
 * it is safe to continue.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

const API = "https://blob.vercel-storage.com";

export type BlobAccess = "public" | "private";

export interface BlobStoreOptions {
  /** The access mode of the store associated with `token`. */
  access?: BlobAccess;
  /** Override the default public-store token. `null` explicitly disables the store. */
  token?: string | null;
}

export interface BlobOperationResult {
  ok: boolean;
  /** A missing token is an intentional local-development no-op, not a failure. */
  skipped: boolean;
  status?: number;
  error?: string;
}

export interface BlobListResult extends BlobOperationResult {
  entries: BlobEntry[];
}

function storeToken(options?: BlobStoreOptions): string | null {
  if (options && Object.prototype.hasOwnProperty.call(options, "token")) {
    const configured = options.token?.trim();
    return configured ? configured : null;
  }
  const configured = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return configured ? configured : null;
}

function storeAccess(options?: BlobStoreOptions): BlobAccess {
  return options?.access ?? "public";
}

function failure(status: number | undefined, error: string): BlobOperationResult {
  return { ok: false, skipped: false, status, error };
}

/** True when a Blob store is configured (i.e. mirroring is live). */
export function blobMirrorEnabled(options?: BlobStoreOptions): boolean {
  return storeToken(options) !== null;
}

export interface BlobEntry {
  url: string;
  pathname: string;
  uploadedAt: string;
}

/** Upload (or overwrite) one JSON document at a caller-selected pathname. */
export async function blobPutJson(
  pathname: string,
  value: unknown,
  options?: BlobStoreOptions,
): Promise<BlobOperationResult> {
  const t = storeToken(options);
  if (!t) return { ok: true, skipped: true };
  try {
    const res = await fetch(`${API}/${pathname}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${t}`,
        "content-type": "application/json",
        "x-vercel-blob-access": storeAccess(options),
        "x-content-type": "application/json",
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "1",
      },
      body: JSON.stringify(value),
    });
    if (!res.ok) {
      const message = `PUT ${pathname} failed: ${res.status}`;
      console.warn(`[blob-mirror] ${message}`);
      return failure(res.status, message);
    }
    return { ok: true, skipped: false, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[blob-mirror] PUT ${pathname} failed:`, err);
    return failure(undefined, message);
  }
}

/** List mirrored documents under a prefix, retaining failure information. */
export async function blobListDetailed(prefix: string, options?: BlobStoreOptions): Promise<BlobListResult> {
  const t = storeToken(options);
  if (!t) return { ok: true, skipped: true, entries: [] };
  try {
    const entries: BlobEntry[] = [];
    let cursor: string | null = null;
    do {
      const params = new URLSearchParams({ prefix, limit: "1000" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`${API}?${params}`, { headers: { authorization: `Bearer ${t}` } });
      if (!res.ok) {
        const message = `list ${prefix} failed: ${res.status}`;
        console.warn(`[blob-mirror] ${message}`);
        return { ...failure(res.status, message), entries };
      }
      const data = (await res.json()) as { blobs?: BlobEntry[]; cursor?: string; hasMore?: boolean };
      entries.push(...(data.blobs ?? []));
      cursor = data.hasMore && data.cursor ? data.cursor : null;
    } while (cursor);
    return {
      ok: true,
      skipped: false,
      entries: entries.sort((a, b) => a.pathname.localeCompare(b.pathname)),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[blob-mirror] list ${prefix} failed:`, err);
    return { ...failure(undefined, message), entries: [] };
  }
}

/** List mirrored documents under a prefix (oldest→newest by pathname sort). */
export async function blobList(prefix: string, options?: BlobStoreOptions): Promise<BlobEntry[]> {
  return (await blobListDetailed(prefix, options)).entries;
}

/** Fetch one mirrored JSON document, or null on any failure. */
export async function blobGetJson<T>(url: string, options?: BlobStoreOptions): Promise<T | null> {
  try {
    const t = storeToken(options);
    const headers = storeAccess(options) === "private" && t ? { authorization: `Bearer ${t}` } : undefined;
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Delete mirrored documents (used when pruning old ledger snapshots). */
export async function blobDelete(urls: string[], options?: BlobStoreOptions): Promise<BlobOperationResult> {
  const t = storeToken(options);
  if (!t) return { ok: true, skipped: true };
  if (urls.length === 0) return { ok: true, skipped: false };
  try {
    const res = await fetch(`${API}/delete`, {
      method: "POST",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ urls }),
    });
    if (!res.ok) {
      const message = `delete failed: ${res.status}`;
      console.warn(`[blob-mirror] ${message}`);
      return failure(res.status, message);
    }
    return { ok: true, skipped: false, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[blob-mirror] delete failed:`, err);
    return failure(undefined, message);
  }
}
