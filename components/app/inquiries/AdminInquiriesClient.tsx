"use client";

import { useState, type CSSProperties } from "react";
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

const actionBtn: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "7px 13px",
  border: "1px solid var(--border-rule)",
  background: "transparent",
  color: "var(--bow-ink)",
  borderRadius: 4,
  cursor: "pointer",
  outlineOffset: 3,
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
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>From the public demand funnel</span>
        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Demand Inbox</h1>
        <p style={{ margin: "0 0 26px", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
          Qualify public inquiries, contact the requester, and turn real demand into an owned Program launch plan.
        </p>
        {notice && (
          <p
            role={notice.tone === "negative" ? "alert" : "status"}
            style={{
              margin: "0 0 18px",
              padding: "10px 12px",
              borderRadius: 4,
              border: `1px solid ${notice.tone === "negative" ? "var(--bow-negative)" : "var(--bow-positive)"}`,
              color: notice.tone === "negative" ? "var(--bow-negative)" : "var(--bow-positive)",
              fontFamily: "var(--font-interface)",
              fontSize: 13,
            }}
          >
            {notice.message}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {inquiries.map((iq) => {
            const status = iq.status;
            const busy = busyInquiryId !== null;
            const terminal = status === "converted_to_program" || status === "closed" || status === "spam";
            const convertedProgram = convertedPrograms[iq.id];
            return (
              <article id={`inquiry-${iq.id}`} key={iq.id} aria-busy={busyInquiryId === iq.id} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "18px 20px", scrollMarginTop: 84 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{iq.name}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginTop: 2 }}>{iq.type} · {iq.orgName || "Organization not provided"} · {iq.date}</span>
                  </div>
                  <Badge status={statusBadge[status]}>{statusLabel[status]}</Badge>
                </div>
                <p style={{ margin: "0 0 14px", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-ink)" }}>{iq.summary}</p>
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
                    <button type="button" disabled={busy} onClick={() => void updateStatus(iq.id, status, "reviewing")} style={{ ...actionBtn, opacity: busy ? 0.55 : 1 }}>Start Review</button>
                  )}
                  {!terminal && status !== "contacted" && (
                    <button type="button" disabled={busy} onClick={() => void updateStatus(iq.id, status, "contacted")} style={{ ...actionBtn, opacity: busy ? 0.55 : 1 }}>Mark Contacted</button>
                  )}
                  {!terminal && (
                    <Button size="sm" variant="emphasis" disabled={busy} href={`/app/programs/new?source=inquiry&sourceId=${encodeURIComponent(iq.id)}`}>
                      Create Program
                    </Button>
                  )}
                  {!terminal && <button type="button" disabled={busy} onClick={() => void updateStatus(iq.id, status, "closed")} style={{ ...actionBtn, opacity: busy ? 0.55 : 1 }}>Close</button>}
                  {!terminal && <button type="button" disabled={busy} onClick={() => void updateStatus(iq.id, status, "spam")} style={{ ...actionBtn, opacity: busy ? 0.55 : 1 }}>Mark Spam</button>}
                  {(status === "closed" || status === "spam") && (
                    <button type="button" disabled={busy} onClick={() => void updateStatus(iq.id, status, "reviewing")} style={{ ...actionBtn, opacity: busy ? 0.55 : 1 }}>Restore to Review</button>
                  )}
                  <a href={`mailto:${encodeURIComponent(iq.email)}`} style={{ ...actionBtn, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Email</a>
                  <button type="button" aria-label={`Copy ${iq.name}'s email address`} disabled={busy} onClick={() => void copyEmail(iq.email)} style={{ ...actionBtn, color: "var(--bow-slate)", opacity: busy ? 0.55 : 1 }}>Copy Email</button>
                </div>
                {status === "converted_to_program" && !convertedProgram && (
                  <p role="status" style={{ margin: "12px 0 0", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-warning-text)" }}>
                    This legacy conversion has no connected Program record. Reconcile it from the Program pipeline; the intake history stays immutable.
                  </p>
                )}
              </article>
            );
          })}
          {inquiries.length === 0 && (
            <div style={{ background: "var(--bow-white)", border: "1px dashed var(--border-rule)", borderRadius: 6, padding: 32, textAlign: "center" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>No public inquiries are waiting. New submissions will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
