"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ds";
import { FieldGroup } from "@/components/admin/website/Fields";
import type { FieldSpec } from "@/lib/cms/fields";
import type { ActionResult } from "@/app/actions/website";
import {
  PUBLICATION_STATUSES,
  PUBLICATION_STATUS_LABELS,
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_HELP,
  REGISTRATION_STATUS_LABELS,
  deriveCta,
  type PublicationStatus,
  type RegistrationStatus,
} from "@/lib/cms/status";

/* ============================================================
 * The editor for an offering — a track or a program.
 *
 * Two things share this component because they are the same job: a set of
 * plain fields, plus the status controls that decide what the public call to
 * action does. The status panel previews the resulting button live, so the
 * founder can see that "Full" produces a disabled "Program Full" with an
 * interest-list option before saving it.
 * ============================================================ */

export default function RecordEditor<T extends object>({
  title,
  publicHref,
  groups,
  initial,
  onSave,
  publication,
  registration,
  interestListEnabled,
  ctaLabelOverride,
}: {
  title: string;
  publicHref: string | null;
  groups: { heading: string; fields: FieldSpec[] }[];
  initial: T;
  onSave: (value: T) => Promise<ActionResult>;
  publication?: { value: PublicationStatus; onChange: (next: PublicationStatus) => Promise<ActionResult> };
  registration?: { value: RegistrationStatus; onChange: (next: RegistrationStatus) => Promise<ActionResult> };
  interestListEnabled?: boolean;
  ctaLabelOverride?: string;
}) {
  const [data, setData] = useState<T>(initial);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const call = (fn: () => Promise<ActionResult>, fallback: string) => {
    startTransition(async () => {
      const result = await fn();
      setNotice(result.ok ? { tone: "ok", text: result.message ?? fallback } : { tone: "bad", text: result.error });
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          background: "var(--bow-white)",
          border: "1px solid var(--border-rule)",
          borderRadius: "var(--radius-control)",
        }}
      >
        <div>
          <strong style={{ fontFamily: "var(--font-editorial)", fontSize: 20 }}>{title}</strong>
          {publication ? (
            <span style={{ marginLeft: 10 }}>
              <Badge status={publication.value === "published" ? "positive" : publication.value === "archived" ? "neutral" : "warning"}>
                {PUBLICATION_STATUS_LABELS[publication.value]}
              </Badge>
            </span>
          ) : null}
          {publicHref ? (
            <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{publicHref}</div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {publicHref ? (
            <Button href={`/api/website/preview?path=${encodeURIComponent(publicHref)}`} variant="secondary" size="sm">
              Preview
            </Button>
          ) : null}
          <Button onClick={() => call(() => onSave(data), "Saved.")} variant="primary" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </header>

      {notice ? (
        <div
          role="status"
          style={{
            padding: "12px 14px",
            borderRadius: "var(--radius-control)",
            border: `1px solid ${notice.tone === "ok" ? "var(--bow-positive)" : "var(--bow-negative)"}`,
            background: "var(--bow-white)",
            fontFamily: "var(--font-interface)",
            fontSize: 14.5,
          }}
        >
          {notice.text}
        </div>
      ) : null}

      {publication || registration ? (
        <section style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "18px 20px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            Status
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {publication ? (
              <div>
                <label htmlFor="publication-status" style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Visible publicly
                </label>
                <select
                  id="publication-status"
                  value={publication.value}
                  disabled={pending}
                  onChange={(event) => call(() => publication.onChange(event.target.value as PublicationStatus), "Status updated.")}
                  style={selectStyle}
                >
                  {PUBLICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>{PUBLICATION_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <p style={helpStyle}>Draft and archived records are invisible to visitors, to search engines, and in the sitemap.</p>
              </div>
            ) : null}

            {registration ? (
              <div>
                <label htmlFor="registration-status" style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Signup
                </label>
                <select
                  id="registration-status"
                  value={registration.value}
                  disabled={pending}
                  onChange={(event) => call(() => registration.onChange(event.target.value as RegistrationStatus), "Status updated.")}
                  style={selectStyle}
                >
                  {REGISTRATION_STATUSES.map((status) => (
                    <option key={status} value={status}>{REGISTRATION_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <p style={helpStyle}>{REGISTRATION_STATUS_HELP[registration.value]}</p>
                <CtaPreview
                  status={registration.value}
                  interestListEnabled={interestListEnabled !== false}
                  ctaLabelOverride={ctaLabelOverride}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {groups.map((group) => (
        <section key={group.heading} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "18px 20px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            {group.heading}
          </h2>
          <FieldGroup fields={group.fields} data={data as Record<string, unknown>} onChange={(next) => setData(next as T)} />
        </section>
      ))}

      <div>
        <Button onClick={() => call(() => onSave(data), "Saved.")} variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-interface)",
  fontSize: 14.5,
  padding: "9px 11px",
  border: "1px solid var(--border-rule)",
  borderRadius: "var(--radius-control)",
  background: "var(--bow-white)",
};

const helpStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontFamily: "var(--font-interface)",
  fontSize: 12.5,
  lineHeight: 1.45,
  color: "var(--text-secondary)",
};

/** Shows the founder the exact button a visitor will get for this status. */
function CtaPreview({
  status,
  interestListEnabled,
  ctaLabelOverride,
}: {
  status: RegistrationStatus;
  interestListEnabled: boolean;
  ctaLabelOverride?: string;
}) {
  const cta = deriveCta({
    registrationStatus: status,
    registerHref: "#",
    interestHref: "#",
    interestListEnabled,
    ctaLabelOverride,
  });

  return (
    <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
        Visitors will see
      </div>
      <div style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>
        {cta.behavior === "none" && !cta.secondary
          ? "No signup button."
          : cta.behavior === "disabled"
            ? `A greyed-out “${cta.label}” button.`
            : `An active “${cta.label}” button.`}
        {cta.secondary ? ` Plus “${cta.secondary.label}”.` : ""}
      </div>
    </div>
  );
}
