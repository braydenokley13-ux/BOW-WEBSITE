import "server-only";

/**
 * Environment configuration checks for launch-critical behavior.
 *
 * Every area here has a silent-failure mode if misconfigured — a missing mail
 * key does not crash the app, it just stops mail from ever leaving; a missing
 * cron secret does not fail loudly, it opens the sweep endpoint to the public.
 * This module exists so those states are *visible* (to an admin diagnostics
 * read, a startup log line, a test) instead of discovered by a family who
 * never got an email. It never throws at import time — every check returns a
 * structured result so a page can render "degraded" instead of crashing.
 */

export type CheckStatus = "ok" | "missing" | "degraded";

export interface EnvCheck {
  area: string;
  status: CheckStatus;
  /** What breaks (or partially breaks) if this stays as-is. Empty when ok. */
  impact: string | null;
  /** Env var names this check looked at, for operator remediation. */
  variables: string[];
}

export interface EnvValidationResult {
  ok: boolean;
  checks: EnvCheck[];
}

function present(name: string): boolean {
  return Boolean((process.env[name] ?? "").trim());
}

function checkDatabase(): EnvCheck {
  const variables = ["POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"];
  const ok = variables.some(present);
  return {
    area: "database",
    status: ok ? "ok" : "missing",
    impact: ok ? null : "No Postgres connection string is configured; every read and write fails, not just this feature.",
    variables,
  };
}

function checkSupabaseAuth(): EnvCheck {
  const variables = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = variables.filter((name) => !present(name));
  if (missing.length === 0) {
    return { area: "supabase_auth", status: "ok", impact: null, variables };
  }
  // The service role key alone gates server-side identity provisioning
  // (parent/student activation); the public pair gates browser sign-in.
  // Either half missing is launch-critical, not a graceful degradation.
  return {
    area: "supabase_auth",
    status: "missing",
    impact: `Sign-in and/or account activation cannot work: missing ${missing.join(", ")}.`,
    variables,
  };
}

function checkEmailSender(): EnvCheck {
  const variables = ["RESEND_API_KEY", "BOW_EMAIL_FROM", "BOW_RESET_EMAIL_FROM"];
  const hasKey = present("RESEND_API_KEY");
  const hasSender = present("BOW_EMAIL_FROM") || present("BOW_RESET_EMAIL_FROM");
  if (hasKey && hasSender) {
    return { area: "email_sender", status: "ok", impact: null, variables };
  }
  const missing = [!hasKey ? "RESEND_API_KEY" : null, !hasSender ? "BOW_EMAIL_FROM" : null].filter(
    (v): v is string => Boolean(v),
  );
  return {
    area: "email_sender",
    status: "missing",
    // family-communications.ts records this as 'skipped' rather than
    // 'failed' per-message, so the per-message view alone can look calm even
    // though nothing is being delivered — this check is what actually says so.
    impact: `Transactional email cannot send (missing ${missing.join(", ")}). Every family notification, activation invite, and reset link will queue and never leave.`,
    variables,
  };
}

function checkPublicAppUrl(): EnvCheck {
  const variables = ["BOW_APP_URL", "NEXT_PUBLIC_SITE_URL"];
  const raw = (process.env.BOW_APP_URL ?? "").trim();
  if (!raw) {
    return {
      area: "public_app_url",
      status: "missing",
      impact: "No canonical app origin: emailed links (activation, offers, resets) cannot be built and email sending is disabled.",
      variables,
    };
  }
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const isPrivateOrLocal =
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
    if (url.protocol !== "https:" || isPrivateOrLocal || url.pathname !== "/" || url.search || url.hash) {
      return {
        area: "public_app_url",
        status: "degraded",
        impact: "BOW_APP_URL is set but is not a bare public https origin; email sending treats it as unset.",
        variables,
      };
    }
    return { area: "public_app_url", status: "ok", impact: null, variables };
  } catch {
    return {
      area: "public_app_url",
      status: "degraded",
      impact: "BOW_APP_URL is set but is not a valid URL; email sending treats it as unset.",
      variables,
    };
  }
}

function checkCronAuth(): EnvCheck {
  const variables = ["CRON_SECRET"];
  const isProduction = process.env.NODE_ENV === "production";
  if (present("CRON_SECRET")) {
    return { area: "cron_auth", status: "ok", impact: null, variables };
  }
  if (isProduction) {
    return {
      area: "cron_auth",
      status: "missing",
      impact: "app/api/cron/** rejects every request in production with no secret configured — reservation/waitlist sweeps and delivery never run.",
      variables,
    };
  }
  return {
    area: "cron_auth",
    status: "degraded",
    impact: "No CRON_SECRET set. Non-production requests are allowed unauthenticated for local development; this must not reach production unset.",
    variables,
  };
}

function checkTrustedClientIp(): EnvCheck {
  const variables = ["BOW_TRUSTED_CLIENT_IP_HEADER"];
  const raw = (process.env.BOW_TRUSTED_CLIENT_IP_HEADER ?? "").trim();
  if (!raw) {
    // Unset is a legitimate, safe default: identity-based rate limits stay
    // active and forwarding headers are ignored (fail closed), not a broken
    // configuration.
    return { area: "trusted_client_ip", status: "ok", impact: null, variables };
  }
  const isPlausibleHeaderName = /^[A-Za-z0-9-]+$/.test(raw);
  return {
    area: "trusted_client_ip",
    status: isPlausibleHeaderName ? "ok" : "degraded",
    impact: isPlausibleHeaderName
      ? null
      : "BOW_TRUSTED_CLIENT_IP_HEADER is set to a value that is not a plausible header name; confirm it names one header set by a trusted reverse proxy, not a client-forwardable chain.",
    variables,
  };
}

/**
 * No storage check is included: nothing in the family/program workflow this
 * sprint reads or writes file uploads through BLOB_READ_WRITE_TOKEN (that
 * token backs the editorial article pipeline only), so validating it here
 * would check a variable this feature set does not depend on.
 */
export function validateEnvironment(): EnvValidationResult {
  const checks: EnvCheck[] = [
    checkDatabase(),
    checkSupabaseAuth(),
    checkEmailSender(),
    checkPublicAppUrl(),
    checkCronAuth(),
    checkTrustedClientIp(),
  ];
  return { ok: checks.every((c) => c.status === "ok"), checks };
}
