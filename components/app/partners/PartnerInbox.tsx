"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ds";
import { completeTask } from "@/app/actions/tasks";
import { changeWorkDueDate } from "@/app/actions/people-work";
import { createFollowUpFromDemoRequest } from "@/app/actions/partners";
import { convertInquiryToPartner } from "@/app/actions/partner-desk";
import { INBOX_KIND_LABEL, waitingLabel, type InboxItem } from "@/lib/partner-desk-shared";

interface PartnerChoice {
  id: string;
  name: string;
  location: string | null;
}

/**
 * The inbox — everyone waiting on a reply, longest wait first.
 *
 * A school that used the public form, a demo request and a follow-up somebody
 * already promised are the same job, so they are one list. Every row carries
 * the thing that resolves it; there is no dismiss, because marking a person
 * as read does not answer them.
 */
export default function PartnerInbox({ items, partners }: { items: InboxItem[]; partners: PartnerChoice[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState<InboxItem | null>(null);

  const run = (key: string, work: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyKey(key);
    setError(null);
    startTransition(async () => {
      const result = await work();
      setBusyKey(null);
      if (!result.ok) setError(result.error ?? "That did not work.");
      else router.refresh();
    });
  };

  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--bow-slate)" }}>
        Nobody is waiting on you. New inquiries and anything you have promised to follow up on land here.
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p role="alert" style={{ margin: "0 0 10px", fontSize: 13, color: "var(--bow-negative)" }}>
          {error}
        </p>
      ) : null}

      <div style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-card)", background: "var(--bow-white)" }}>
        {items.map((item, index) => {
          const busy = busyKey === item.key && pending;
          const late = item.waitingDays >= 3 || (item.kind === "follow_up" && item.waitingDays > 0);
          return (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "13px 16px",
                borderTop: index === 0 ? "none" : "1px solid var(--border-rule)",
                flexWrap: "wrap",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flex: "none",
                  marginTop: 6,
                  background: late ? "var(--bow-warning)" : "var(--bow-slate)",
                }}
              />
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--bow-ink)" }}>
                  {item.who}
                  {item.org && item.org !== item.who ? (
                    <span style={{ fontWeight: 400, color: "var(--bow-slate)" }}> · {item.org}</span>
                  ) : null}
                </span>
                {item.said ? (
                  <span style={{ display: "block", marginTop: 3, fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
                    {item.said}
                  </span>
                ) : null}
                <span
                  style={{
                    display: "block",
                    marginTop: 5,
                    fontFamily: "var(--font-data)",
                    fontSize: 10.5,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--bow-slate)",
                  }}
                >
                  {INBOX_KIND_LABEL[item.kind]} ·{" "}
                  {item.kind === "follow_up"
                    ? item.dueOn
                      ? `due ${waitingLabel(item.waitingDays)}`
                      : "no date set"
                    : `arrived ${waitingLabel(item.waitingDays)}`}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", flex: "none" }}>
                {item.email ? (
                  <a
                    href={`mailto:${encodeURIComponent(item.email)}`}
                    style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--bow-blue)" }}
                  >
                    EMAIL
                  </a>
                ) : null}

                {item.kind === "follow_up" && item.taskId ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(item.key, () =>
                          changeWorkDueDate(
                            item.taskId as string,
                            new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                            "Pushed three days from the Partners inbox.",
                          ),
                        )
                      }
                    >
                      Push 3 days
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => run(item.key, () => completeTask(item.taskId as string, "Done from the Partners inbox."))}
                    >
                      Done
                    </Button>
                  </>
                ) : null}

                {item.kind === "inquiry" && item.inquiryId ? (
                  item.organizationId ? (
                    <Button size="sm" variant="secondary" href={`/app/partners/${item.organizationId}`}>
                      Open partner
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => setConverting(item)}>
                      Make a partner
                    </Button>
                  )
                ) : null}

                {item.kind === "demo_request" && item.demoRequestId ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => run(item.key, () => createFollowUpFromDemoRequest(item.demoRequestId as string))}
                  >
                    Take it on
                  </Button>
                ) : null}

                {item.href ? (
                  <Link
                    href={item.href}
                    style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--bow-blue)" }}
                  >
                    VIEW
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {converting ? (
        <ConvertInquiry
          item={converting}
          partners={partners}
          onClose={() => setConverting(null)}
          onDone={(organizationId) => {
            setConverting(null);
            router.push(`/app/partners/${organizationId}`);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Turning an inquiry into a partner.
 *
 * The choice is explicit — this is a new school, or it is one already on the
 * list — because `organizations` and `partner_orgs` are already joined by a
 * name string and nothing new should decide identity by matching a name
 * somebody typed into a public form.
 */
function ConvertInquiry({
  item,
  partners,
  onClose,
  onDone,
}: {
  item: InboxItem;
  partners: PartnerChoice[];
  onClose: () => void;
  onDone: (organizationId: string) => void;
}) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState(item.org ?? "");
  const [location, setLocation] = useState("");
  const [existingId, setExistingId] = useState(partners[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await convertInquiryToPartner(
      item.inquiryId as string,
      mode === "new" ? { kind: "new", name, location } : { kind: "existing", organizationId: existingId },
    );
    setBusy(false);
    if (result.ok && result.organizationId) onDone(result.organizationId);
    else setError(result.error ?? "That did not work.");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Make ${item.who} a partner`}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,11,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 300,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--bow-white)",
          border: "1px solid var(--border-rule)",
          borderRadius: "var(--radius-card)",
          padding: 22,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Make this a partner
        </h2>
        <p style={{ margin: "8px 0 16px", fontSize: 13.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>
          {item.who} wrote in{item.org ? ` from ${item.org}` : ""}. Their details, what they said, and a follow-up in two
          days all carry over — nothing needs retyping.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <Button size="sm" variant={mode === "new" ? "primary" : "secondary"} onClick={() => setMode("new")}>
            New partner
          </Button>
          <Button
            size="sm"
            variant={mode === "existing" ? "primary" : "secondary"}
            disabled={partners.length === 0}
            onClick={() => setMode("existing")}
          >
            One we already know
          </Button>
        </div>

        {mode === "new" ? (
          <>
            <label htmlFor="convert-name" className="ops-label">
              School or organization
            </label>
            <input
              id="convert-name"
              className="bow-input"
              style={{ marginTop: 4 }}
              value={name}
              maxLength={160}
              onChange={(event) => setName(event.target.value)}
            />
            <label htmlFor="convert-location" className="ops-label" style={{ display: "block", marginTop: 12 }}>
              Where they are (optional)
            </label>
            <input
              id="convert-location"
              className="bow-input"
              style={{ marginTop: 4 }}
              value={location}
              maxLength={160}
              onChange={(event) => setLocation(event.target.value)}
            />
          </>
        ) : (
          <>
            <label htmlFor="convert-existing" className="ops-label">
              Attach to
            </label>
            <select
              id="convert-existing"
              className="bow-input"
              style={{ marginTop: 4 }}
              value={existingId}
              onChange={(event) => setExistingId(event.target.value)}
            >
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                  {partner.location ? ` — ${partner.location}` : ""}
                </option>
              ))}
            </select>
          </>
        )}

        {error ? (
          <p role="alert" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--bow-negative)" }}>
            {error}
          </p>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <Button variant="primary" disabled={busy} onClick={submit}>
            {busy ? "Saving…" : "Make a partner"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
