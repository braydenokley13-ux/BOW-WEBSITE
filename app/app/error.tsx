"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Button, CapLine } from "@/components/ds";
import { classifyError, STAFF_REMEDIATION, type ContentReason } from "@/lib/cms/errors";

/* ============================================================
 * BOW HQ's last-resort error surface.
 *
 * This used to show one generic apology for everything — a missing database
 * table, an expired session, and a genuine bug all produced the same sentence,
 * so nobody could act on it. It now names the situation.
 *
 * The audience here is staff only (the whole /app segment is authenticated),
 * so it is safe and useful to show the reason code and Next's error digest:
 * that is the string that finds the matching entry in the server logs. It
 * still never renders the raw error message, SQL, or a stack trace.
 * ============================================================ */

const HEADLINES: Partial<Record<ContentReason, { title: string; body: string }>> = {
  schema_out_of_date: {
    title: "The database is behind this deployment.",
    body: "A table or column this screen needs hasn’t been created yet. Applying the pending migrations fixes it — no data is at risk.",
  },
  configuration_error: {
    title: "A required setting is missing.",
    body: "The app couldn’t reach the database with the credentials it was given. This is a deployment setting, not something you did.",
  },
  network_unavailable: {
    title: "We couldn’t reach the database.",
    body: "The connection was refused or timed out. This is usually brief — try again in a moment.",
  },
  insufficient_permissions: {
    title: "That read was refused.",
    body: "The database declined this query for the account the app is using.",
  },
};

export default function AppError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const { reason } = classifyError(error);
  const copy = HEADLINES[reason] ?? {
    title: "This screen didn’t load.",
    body: "Something failed on our side, not yours, and nothing you were working on was lost. Try again — if it keeps happening, the reference below identifies it in the logs.",
  };
  const remediation = STAFF_REMEDIATION[reason];

  return (
    <section
      className="bow-front-office"
      role="alert"
      style={{
        background: "var(--bow-ink)",
        color: "#fff",
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        padding: "clamp(48px,8vw,120px) clamp(18px,4vw,40px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          BOW HQ
        </span>
        <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,5.5vw,64px)", lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          {copy.title}
        </h1>
        <CapLine weight={7} step={18} stepAt={0.4} style={{ maxWidth: 320, margin: "20px 0" }} />
        <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.5vw,20px)", lineHeight: 1.55, color: "#b9bcc4", maxWidth: 560 }}>
          {copy.body}
        </p>

        {remediation ? (
          <p style={{ margin: "0 0 24px", padding: "12px 14px", borderLeft: "3px solid var(--bow-orange)", background: "var(--bow-dark-surface)", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "#c8cad0", maxWidth: 620 }}>
            {remediation}
          </p>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Button onClick={() => (unstable_retry ?? reset)?.()} variant="primary" size="lg">
            Try again
          </Button>
          <Button href="/app" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>
            Back to BOW HQ
          </Button>
        </div>

        <p style={{ marginTop: 26, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", color: "#6d7078" }}>
          Reference: {reason}
          {error.digest ? ` · ${error.digest}` : ""}
        </p>
      </div>
    </section>
  );
}
