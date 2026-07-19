"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Modal } from "@/components/ds";
import { useAppState } from "@/components/app/AppState";
import { type InvitationStatus } from "@/lib/account";
import { createInvitation as createInvitationAction, setInvitationStatus as setInvitationStatusAction } from "@/app/actions/lms";

type BadgeStatus = "positive" | "warning" | "negative" | "info" | "neutral" | "locked";
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
  const router = useRouter();
  const { data, invitations, invStatusOf, askConfirm, showToast, getCohort } = useAppState();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [issuedTokens, setIssuedTokens] = useState<Record<string, string>>({});

  const cohortOptions = data.cohorts.filter((cohort) => cohort.status === "active");
  function openForm() {
    setEmail("");
    setCohortId("");
    setFormError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || formBusy) return;
    setFormBusy(true);
    setFormError(null);
    try {
      const cohort = getCohort(cohortId);
      const created = await createInvitationAction({
        role: "student",
        email: email.trim(),
        orgId: cohort?.orgId ?? "",
        cohortId,
      });
      if (created.token) {
        const issuedToken = created.token;
        setIssuedTokens((current) => {
          const next = { ...current };
          for (const invitation of invitations) {
            if (invitation.email.toLowerCase() === created.email.toLowerCase()) delete next[invitation.id];
          }
          next[created.id] = issuedToken;
          return next;
        });
      }
      showToast(
        created.invitationDelivery === "queued"
          ? "Invitation created — email delivery queued; copy fallback ready"
          : "Invitation created — copy the link now; email delivery needs configuration",
        created.invitationDelivery === "queued" ? "positive" : "warning",
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The invitation could not be created. Refresh and try again.");
    } finally {
      setFormBusy(false);
    }
  }

  async function updateInvitation(id: string, status: "pending" | "revoked") {
    setBusyInvitationId(id);
    try {
      const result = await setInvitationStatusAction(id, status);
      setIssuedTokens((current) => {
        const next = { ...current };
        if (result.token) {
          const emailForInvitation = invitations.find((invitation) => invitation.id === id)?.email.toLowerCase();
          for (const invitation of invitations) {
            if (emailForInvitation && invitation.email.toLowerCase() === emailForInvitation) delete next[invitation.id];
          }
          next[id] = result.token;
        }
        if (status === "revoked") delete next[id];
        return next;
      });
      showToast(
        status === "revoked"
          ? "Invitation revoked"
          : result.invitationDelivery === "queued"
            ? "Fresh link created — email delivery queued; copy fallback ready"
            : "Fresh link created — copy it now; email delivery needs configuration",
        status === "revoked" || result.invitationDelivery === "manual_copy_required" ? "warning" : "positive",
      );
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The invitation could not be updated.", "negative");
    } finally {
      setBusyInvitationId(null);
    }
  }

  async function copyInvitationLink(token: string) {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      const link = `${window.location.origin}/accept-invitation#token=${encodeURIComponent(token)}`;
      await navigator.clipboard.writeText(link);
      showToast("Invitation link copied");
    } catch {
      showToast("The link could not be copied. Try again in a secure browser window.", "negative");
    }
  }

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const valid = validEmail && !!cohortId;

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Bring people into BOW</span>
            <h1 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Invitations</h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={busyInvitationId !== null || formBusy} onClick={openForm} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 20px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: busyInvitationId !== null || formBusy ? "not-allowed" : "pointer", opacity: busyInvitationId !== null || formBusy ? 0.55 : 1 }}>Invite Students</button>
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
                const canResend = status !== "accepted";
                const canRevoke = status === "pending";
                const token = status === "pending" ? issuedTokens[iv.id] ?? iv.token : undefined;
                const rowBusy = busyInvitationId === iv.id;
                const anyRowBusy = busyInvitationId !== null;
                return (
                  <tr key={iv.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                    <td style={{ padding: "13px 16px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{iv.email}</td>
                    <td style={{ padding: "13px 8px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-ink)" }}>{iv.role === "instructor" ? "Instructor" : "Student"}</td>
                    <td style={{ padding: "13px 8px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>{iv.cohortId ? getCohort(iv.cohortId)?.name ?? "—" : "—"}</td>
                    <td style={{ padding: "13px 8px", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{iv.expires}</td>
                    <td style={{ padding: "13px 8px" }}><Badge status={statusBadge[status]}>{statusLabel[status]}</Badge></td>
                    <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={async () => token && void (await copyInvitationLink(token))}
                        disabled={!token || anyRowBusy}
                        title={token ? "Copy the newly issued link" : "For security, links are shown only when created or resent"}
                        style={{ ...smallBtn, border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-slate)", opacity: token && !anyRowBusy ? 1 : 0.5, cursor: token && !anyRowBusy ? "pointer" : "not-allowed" }}
                      >
                        {token ? "Copy link" : "Link hidden"}
                      </button>
                      {(canResend || canRevoke) && (
                        <>
                          {canResend && <button type="button" disabled={anyRowBusy} onClick={async () => void (await updateInvitation(iv.id, "pending"))} style={{ ...smallBtn, border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-ink)", marginLeft: 4, opacity: anyRowBusy ? 0.5 : 1 }}>{rowBusy ? "Working…" : "Resend"}</button>}
                          {canRevoke && (
                            <button
                              type="button"
                              disabled={anyRowBusy}
                              onClick={() => askConfirm({ title: "Revoke this invitation?", body: `The link to ${iv.email} will stop working immediately.`, confirmLabel: "Revoke Invitation", tone: "negative", onConfirm: async () => void (await updateInvitation(iv.id, "revoked")) })}
                              style={{ ...smallBtn, border: "1px solid var(--bow-negative)", background: "transparent", color: "var(--bow-negative)", marginLeft: 4, opacity: anyRowBusy ? 0.5 : 1 }}
                            >
                              Revoke
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {invitations.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 28, textAlign: "center", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
                    No invitations have been issued yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create Invitation" dismissible={!formBusy}>
        <form onSubmit={async (event) => void (await submit(event))}>
          <label htmlFor="invitation-email" style={{ ...fieldLabel, marginBottom: 6 }}>Email</label>
          <input
            id="invitation-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={formBusy}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@email.com"
            style={input}
          />

          <label htmlFor="invitation-cohort" style={{ ...fieldLabel, margin: "16px 0 8px" }}>Active cohort</label>
          <select id="invitation-cohort" required disabled={formBusy} value={cohortId} onChange={(event) => setCohortId(event.target.value)} style={input}>
            <option value="">Choose a cohort</option>
            {cohortOptions.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
          </select>
          {cohortOptions.length === 0 && <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 12, color: "var(--bow-negative)" }}>Create or activate a cohort before inviting students.</p>}

          {formError && <p role="alert" style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-negative)" }}>{formError}</p>}
          <div style={{ marginTop: 22 }}>
            <Button type="submit" full disabled={!valid || formBusy}>
              {formBusy ? "Creating…" : "Create Invitation"}
            </Button>
          </div>
          <p style={{ margin: "12px 0 0", fontFamily: "var(--font-interface)", fontSize: 11.5, color: "var(--bow-slate)", lineHeight: 1.5 }}>Creates a 14-day student invitation and queues email delivery when configured. “Queued” does not promise provider delivery, so the secure copy fallback is shown once after creation or resend. Instructor invitations come from an approved hiring record.</p>
        </form>
      </Modal>
    </div>
  );
}
