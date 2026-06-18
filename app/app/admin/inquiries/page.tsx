"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/components/ds";
import { useAppState } from "@/components/app/AppState";
import { inquiries, type InquiryStatus } from "@/lib/account";

type BadgeStatus = "positive" | "warning" | "negative" | "info" | "neutral" | "locked";

const statusLabel: Record<InquiryStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  contacted: "Contacted",
  closed: "Closed",
  spam: "Spam",
};

const statusBadge: Record<InquiryStatus, BadgeStatus> = {
  new: "info",
  reviewing: "warning",
  contacted: "positive",
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
};

export default function AdminInquiriesPage() {
  const { inqStatusOf, setInqStatus, showToast } = useAppState();

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>From the Get Involved funnel</span>
        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Inquiries</h1>
        <p style={{ margin: "0 0 26px", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
          Prototype data — submissions are not yet stored on a server (<span style={{ fontFamily: "var(--font-data)", fontSize: 12 }}>PRODUCTION_ENDPOINT_TODO</span>).
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {inquiries.map((iq) => {
            const status = inqStatusOf(iq);
            return (
              <div key={iq.id} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{iq.name}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block", marginTop: 2 }}>{iq.type} · {iq.orgName} · {iq.date}</span>
                  </div>
                  <Badge status={statusBadge[status]}>{statusLabel[status]}</Badge>
                </div>
                <p style={{ margin: "0 0 14px", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-ink)" }}>{iq.summary}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setInqStatus(iq.id, "reviewing")} style={actionBtn}>Reviewing</button>
                  <button onClick={() => setInqStatus(iq.id, "contacted")} style={actionBtn}>Contacted</button>
                  <button onClick={() => setInqStatus(iq.id, "closed")} style={actionBtn}>Close</button>
                  <button onClick={() => showToast("Contact email copied")} style={{ ...actionBtn, color: "var(--bow-slate)" }}>Copy email</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
