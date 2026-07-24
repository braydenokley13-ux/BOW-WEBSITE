import "server-only";

/**
 * Small, server-only boundary for transactional email configuration and
 * delivery. Callers own their product-specific copy and post-delivery audit
 * behavior; this module only validates the shared origin/sender/provider.
 */

export interface TransactionalEmailInput {
  to: string;
  subject: string;
  text: string;
  /** Optional branded alternative part. The text part always remains the fallback. */
  html?: string;
}

const MAILBOX = "[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+";

function configuredSender(): string | null {
  // BOW_RESET_EMAIL_FROM remains a backwards-compatible fallback for
  // deployments configured before invitation delivery was introduced.
  const preferred = (process.env.BOW_EMAIL_FROM ?? "").trim();
  const legacy = (process.env.BOW_RESET_EMAIL_FROM ?? "").trim();
  const value = preferred || legacy;
  if (!value || /[\r\n]/.test(value)) return null;
  if (new RegExp(`^${MAILBOX}$`).test(value)) return value;
  if (new RegExp(`^[^<>]{1,80} <${MAILBOX}>$`).test(value)) return value;
  return null;
}

function parseAppOrigin(raw: string, requirePublicHttps: boolean): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const isPrivateOrLocal =
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "::1" ||
      host.includes(":") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
      !host.includes(".");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    if (requirePublicHttps && (url.protocol !== "https:" || isPrivateOrLocal || (url.port && url.port !== "443"))) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/** Canonical public application origin used in emailed credentials. */
export function publicAppOrigin(): string | null {
  return parseAppOrigin((process.env.BOW_APP_URL ?? "").trim(), true);
}

/** Local-only origin used exclusively by explicitly enabled development flows. */
export function developmentAppOrigin(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return parseAppOrigin((process.env.BOW_APP_URL ?? "").trim(), false);
}

/**
 * Synchronous readiness signal for operator copy. "true" means an attempt can
 * be queued, never that the provider has already accepted or delivered it.
 */
export function transactionalEmailReady(): boolean {
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  return Boolean(publicAppOrigin() && configuredSender() && apiKey && !/\s/.test(apiKey));
}

export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<boolean> {
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const from = configuredSender();
  const to = input.to.trim().toLowerCase();
  const subject = input.subject.trim();
  if (
    !apiKey ||
    /\s/.test(apiKey) ||
    !from ||
    !publicAppOrigin() ||
    to.length > 320 ||
    !/^\S+@\S+\.\S+$/.test(to) ||
    !subject ||
    subject.length > 160 ||
    /[\r\n]/.test(subject) ||
    !input.text ||
    input.text.length > 20_000 ||
    (input.html !== undefined && (!input.html || input.html.length > 200_000))
  ) {
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
