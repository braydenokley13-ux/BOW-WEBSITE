"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import { type Inquiry, type InquiryStatus } from "@/lib/account";
import { updateInquiryStatus } from "@/app/actions/inquiries";

type BadgeStatus = "positive" | "warning" | "negative" | "info" | "neutral" | "locked";

const statusLabel: Record<InquiryStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  contacted: "Contacted",
  converted_to_program: "Converted to Program",
  closed: "Closed",
  spam: "Spam",
};

const statusBadge: Record<InquiryStatus, BadgeStatus> = {
  new: "info",
  reviewing: "warning",
  contacted: "positive",
  converted_to_program: "positive",
  closed: "neutral",
  spam: "locked",
};

interface ConvertedProgram {
  id: string;
  name: string;
}

export default function DemandInboxClient({
  inquiries,
  convertedPrograms,
}: {
  inquiries: Inquiry[];
  convertedPrograms: Record<string, ConvertedProgram>;
}) {
  const router = useRouter();
  const [busyInquiryId, setBusyInquiryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "positive" | "negative"; message: string } | null>(null);

  async function updateStatus(id: string, currentStatus: InquiryStatus, nextStatus: InquiryStatus) {
    setBusyInquiryId(id);
    setNotice(null);
    try {
      const result = await updateInquiryStatus(id, currentStatus, nextStatus);
      if (!result.ok) {
        setNotice({ tone: "negative", message: result.error ?? "The inquiry could not be updated." });
        return;
      }
      setNotice({ tone: "positive", message: `Inquiry marked ${statusLabel[nextStatus].toLowerCase()}.` });
      router.refresh();
    } catch {
      setNotice({ tone: "negative", message: "The inquiry could not be updated. Refresh and try again." });
    } finally {
      setBusyInquiryId(null);
    }
  }

  async function copyEmail(email: string) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(email);
      setNotice({ tone: "positive", message: "Contact email copied." });
    } catch {
      setNotice({ tone: "negative", message: "The email could not be copied. Use the Email button instead." });
    }
  }

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">From the public demand funnel</span>
          <h1 className="ops-title">All inquiries</h1>
          <p className="ops-summary">
            Qualify public inquiries, contact the requester, and turn real demand into an owned Program launch plan.
          </p>
        </div>
      </header>

      {notice && (
        <section className="ops-alert" data-tone={notice.tone === "negative" ? undefined : "positive"} role={notice.tone === "negative" ? "alert" : "status"}>
          <span className="ops-alert__title">{notice.message}</span>
        </section>
      )}

      {inquiries.length === 0 ? (
        <section className="ops-empty">
          <h2 className="ops-empty__title">No public inquiries are waiting.</h2>
          <p className="ops-empty__body">New submissions will appear here.</p>
        </section>
      ) : (
        <div className="ops-stack" style={{ gap: 12 }}>
          {inquiries.map((iq) => {
            const status = iq.status;
            const busy = busyInquiryId !== null;
            const terminal = status === "converted_to_program" || status === "closed" || status === "spam";
            const convertedProgram = convertedPrograms[iq.id];
            return (
              <article id={`inquiry-${iq.id}`} key={iq.id} aria-busy={busyInquiryId === iq.id} className="ops-panel" style={{ scrollMarginTop: 84 }}>
                <div className="ops-section-head" style={{ marginBottom: 8 }}>
                  <div>
                    <span className="ops-record-name">{iq.name}</span>
                    <span className="ops-record-meta">{iq.type} · {iq.orgName || "Organization not provided"} · {iq.date}</span>
                  </div>
                  <Badge status={statusBadge[status]}>{statusLabel[status]}</Badge>
                </div>
                <p className="ops-body" style={{ marginBottom: 14 }}>{iq.summary}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {convertedProgram && (
                    <Button size="sm" variant="emphasis" href={`/app/programs/${convertedProgram.id}`}>
                      Open {convertedProgram.name}
                    </Button>
                  )}
                  {status === "converted_to_program" && !convertedProgram && (
                    <Button size="sm" variant="secondary" href="/app/programs">
                      Review Program Pipeline
                    </Button>
                  )}
                  {!terminal && status !== "reviewing" && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void updateStatus(iq.id, status, "reviewing")}>Start Review</Button>
                  )}
                  {!terminal && status !== "contacted" && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void updateStatus(iq.id, status, "contacted")}>Mark Contacted</Button>
                  )}
                  {!terminal && (
                    <Button size="sm" variant="emphasis" disabled={busy} href={`/app/programs/new?source=inquiry&sourceId=${encodeURIComponent(iq.id)}`}>
                      Create Program
                    </Button>
                  )}
                  {!terminal && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void updateStatus(iq.id, status, "closed")}>Close</Button>}
                  {!terminal && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void updateStatus(iq.id, status, "spam")}>Mark Spam</Button>}
                  {(status === "closed" || status === "spam") && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void updateStatus(iq.id, status, "reviewing")}>Restore to Review</Button>
                  )}
                  <Button size="sm" variant="secondary" href={`mailto:${encodeURIComponent(iq.email)}`}>Email</Button>
                  <Button size="sm" variant="secondary" aria-label={`Copy ${iq.name}'s email address`} disabled={busy} onClick={() => void copyEmail(iq.email)}>Copy Email</Button>
                </div>
                {status === "converted_to_program" && !convertedProgram && (
                  <p role="status" className="ops-record-meta" style={{ marginTop: 12, color: "var(--bow-warning-text)" }}>
                    This legacy conversion has no connected Program record. Reconcile it from the Program pipeline; the intake history stays immutable.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
