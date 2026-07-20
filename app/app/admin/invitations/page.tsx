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
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Bring people into BOW</span>
          <h1 className="ops-title">Invitations</h1>
        </div>
        <div className="ops-actions">
          <Button variant="ink" disabled={busyInvitationId !== null || formBusy} onClick={openForm}>Invite Students</Button>
        </div>
      </header>

      {invitations.length === 0 ? (
        <div className="ops-empty">
          <h2 className="ops-empty__title">No invitations have been issued yet.</h2>
          <p className="ops-empty__body">Invite a student into an active cohort to get started.</p>
        </div>
      ) : (
        <div className="ops-panel" style={{ padding: 0, overflowX: "auto" }}>
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
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => token && void copyInvitationLink(token)}
                          disabled={!token || anyRowBusy}
                          aria-label={token ? "Copy the newly issued link" : "For security, links are shown only when created or resent"}
                        >
                          {token ? "Copy link" : "Link hidden"}
                        </Button>
                        {canResend && (
                          <Button size="sm" variant="secondary" disabled={anyRowBusy} onClick={() => void updateInvitation(iv.id, "pending")}>
                            {rowBusy ? "Working…" : "Resend"}
                          </Button>
                        )}
                        {canRevoke && (
                          <Button
                            size="sm"
                            variant="secondary"
                            style={{ color: "var(--bow-negative)", borderColor: "var(--bow-negative)" }}
                            disabled={anyRowBusy}
                            onClick={() => askConfirm({ title: "Revoke this invitation?", body: `The link to ${iv.email} will stop working immediately.`, confirmLabel: "Revoke Invitation", tone: "negative", onConfirm: () => void updateInvitation(iv.id, "revoked") })}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create Invitation" dismissible={!formBusy}>
        <form onSubmit={(event) => void submit(event)} className="ops-form">
          <div className="ops-fields">
            <div className="ops-field ops-field--wide">
              <label htmlFor="invitation-email">Email</label>
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
              />
            </div>

            <div className="ops-field ops-field--wide">
              <label htmlFor="invitation-cohort">Active cohort</label>
              <select id="invitation-cohort" required disabled={formBusy} value={cohortId} onChange={(event) => setCohortId(event.target.value)}>
                <option value="">Choose a cohort</option>
                {cohortOptions.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
              </select>
              {cohortOptions.length === 0 && <span className="ops-error">Create or activate a cohort before inviting students.</span>}
            </div>
          </div>

          <div className="ops-form-footer">
            {formError && <p role="alert" className="ops-error" style={{ margin: 0 }}>{formError}</p>}
            <Button type="submit" full disabled={!valid || formBusy}>
              {formBusy ? "Creating…" : "Create Invitation"}
            </Button>
          </div>
          <p className="ops-field__help" style={{ margin: 0 }}>Creates a 14-day student invitation and queues email delivery when configured. &ldquo;Queued&rdquo; does not promise provider delivery, so the secure copy fallback is shown once after creation or resend. Instructor invitations come from an approved hiring record.</p>
        </form>
      </Modal>
    </main>
  );
}
