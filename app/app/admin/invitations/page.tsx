"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ds";
import { useAppState } from "@/components/app/AppState";
import {
  invitations,
  cohorts,
  organizations,
  getCohort,
  type InvitationStatus,
} from "@/lib/account";

type BadgeStatus = "positive" | "warning" | "negative" | "info" | "neutral" | "locked";
type InviteRole = "student" | "instructor";

const statusLabel: Record<InvitationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};

const statusBadge: Record<InvitationStatus, BadgeStatus> = {
  pending: "warning",
  accepted: "positive",
  expired: "neutral",
  revoked: "negative",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "12px 8px",
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
  fontWeight: 600,
};

const smallBtn: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 10.5,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  padding: "6px 10px",
  borderRadius: 4,
  cursor: "pointer",
};

const fieldLabel: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
  display: "block",
};

const input: CSSProperties = {
  width: "100%",
  background: "var(--bow-paper)",
  border: "1px solid var(--border-rule)",
  color: "var(--bow-ink)",
  padding: 12,
  borderRadius: 4,
  fontFamily: "var(--font-interface)",
  fontSize: 14,
};

export default function AdminInvitationsPage() {
  const { invStatusOf, setInvStatus, askConfirm, showToast } = useAppState();

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<InviteRole>("student");
  const [email, setEmail] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [orgId, setOrgId] = useState("");

  const cohortOptions = cohorts.filter((c) => c.status !== "completed");
  const orgOptions = organizations.filter((o) => o.type !== "BOW");

  function openForm(r: InviteRole) {
    setRole(r);
    setEmail("");
    setCohortId("");
    setOrgId("");
    setOpen(true);
  }

  function submit() {
    // TODO: wire to backend
    setOpen(false);
    showToast("Invitation link created (prototype)");
  }

  const valid = role === "student" ? !!email && !!cohortId : !!email && !!orgId;

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Bring people into BOW</span>
            <h1 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Invitations</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => openForm("student")} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 20px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Invite Students</button>
            <button onClick={() => openForm("instructor")} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 20px", border: "1px solid var(--bow-ink)", background: "transparent", color: "var(--bow-ink)", borderRadius: 4, cursor: "pointer" }}>Invite Instructor</button>
          </div>
        </div>

        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <th style={{ ...th, padding: "12px 16px" }}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Cohort</th>
                <th style={th}>Expires</th>
                <th style={th}>Status</th>
                <th style={{ ...th, padding: "12px 16px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((iv) => {
                const status = invStatusOf(iv);
                const canAct = status === "pending" || status === "expired";
                return (
                  <tr key={iv.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                    <td style={{ padding: "13px 16px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{iv.email}</td>
                    <td style={{ padding: "13px 8px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-ink)" }}>{iv.role === "instructor" ? "Instructor" : "Student"}</td>
                    <td style={{ padding: "13px 8px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>{iv.cohortId ? getCohort(iv.cohortId)?.name ?? "—" : "—"}</td>
                    <td style={{ padding: "13px 8px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{iv.expires}</td>
                    <td style={{ padding: "13px 8px" }}><Badge status={statusBadge[status]}>{statusLabel[status]}</Badge></td>
                    <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => showToast("Invitation link copied")} style={{ ...smallBtn, border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-slate)" }}>Copy link</button>
                      {canAct && (
                        <>
                          <button onClick={() => setInvStatus(iv.id, "pending")} style={{ ...smallBtn, border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-ink)", marginLeft: 4 }}>Resend</button>
                          <button
                            onClick={() => askConfirm({ title: "Revoke this invitation?", body: `The link to ${iv.email} will stop working immediately.`, confirmLabel: "Revoke Invitation", tone: "negative", onConfirm: () => setInvStatus(iv.id, "revoked") })}
                            style={{ ...smallBtn, border: "1px solid var(--bow-negative)", background: "transparent", color: "var(--bow-negative)", marginLeft: 4 }}
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* simplified create invitation */}
      {open && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 4500, background: "rgba(10,10,11,0.62)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "36px 18px", overflowY: "auto" }} onClick={() => setOpen(false)}>
          <div style={{ background: "var(--bow-white)", maxWidth: 480, width: "100%", borderRadius: 6, borderTop: "4px solid var(--bow-blue)", padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>Create Invitation</span>
              <span onClick={() => setOpen(false)} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)", cursor: "pointer" }}>Cancel ✕</span>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {(["student", "instructor"] as InviteRole[]).map((r) => {
                const sel = role === r;
                return (
                  <button key={r} onClick={() => setRole(r)} style={{ flex: 1, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", padding: 9, borderRadius: 4, cursor: "pointer", background: sel ? "var(--bow-blue)" : "var(--bow-white)", color: sel ? "#fff" : "var(--bow-slate)", border: "1px solid var(--border-rule)" }}>{r === "student" ? "Student" : "Instructor"}</button>
                );
              })}
            </div>

            <label style={{ ...fieldLabel, marginBottom: 6 }}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={input} />

            {role === "student" ? (
              <>
                <label style={{ ...fieldLabel, margin: "16px 0 8px" }}>Cohort</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {cohortOptions.map((c) => {
                    const sel = cohortId === c.id;
                    return (
                      <button key={c.id} onClick={() => setCohortId(c.id)} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 12.5, padding: "8px 12px", borderRadius: 4, cursor: "pointer", background: sel ? "var(--bow-blue)" : "var(--bow-white)", color: sel ? "#fff" : "var(--bow-ink)", border: `1px solid ${sel ? "var(--bow-blue)" : "var(--border-rule)"}` }}>{c.name}</button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <label style={{ ...fieldLabel, margin: "16px 0 8px" }}>Organization</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {orgOptions.map((o) => {
                    const sel = orgId === o.id;
                    return (
                      <button key={o.id} onClick={() => setOrgId(o.id)} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 12.5, padding: "8px 12px", borderRadius: 4, cursor: "pointer", background: sel ? "var(--bow-blue)" : "var(--bow-white)", color: sel ? "#fff" : "var(--bow-ink)", border: `1px solid ${sel ? "var(--bow-blue)" : "var(--border-rule)"}` }}>{o.name}</button>
                    );
                  })}
                </div>
              </>
            )}

            <button onClick={submit} disabled={!valid} style={{ width: "100%", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: 14, border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.55, marginTop: 22 }}>Create Invitation</button>
            <p style={{ margin: "12px 0 0", fontFamily: "var(--font-interface)", fontSize: 11.5, color: "var(--bow-slate)", lineHeight: 1.5 }}>Prototype: generates a demo link. No email is sent and no account is created.</p>
          </div>
        </div>
      )}
    </div>
  );
}
