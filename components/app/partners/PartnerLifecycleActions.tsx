"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  transitionPartnerLifecycle,
  type PartnerLifecycleStatus,
} from "@/app/actions/partners";
import { Badge, Button } from "@/components/ds";

interface LifecycleImpact {
  currentPrograms: number;
  activeOrEnrollingCohorts: number;
  currentClasses: number;
}

interface LifecycleOption {
  nextStatus: PartnerLifecycleStatus;
  label: string;
  description: string;
  reasonLabel: string;
  reasonRequired: boolean;
  tone: "positive" | "warning" | "negative";
}

const STATUS_LABELS: Record<PartnerLifecycleStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};

const STATUS_TONES: Record<PartnerLifecycleStatus, "positive" | "warning" | "neutral" | "locked"> = {
  prospect: "neutral",
  active: "positive",
  paused: "warning",
  closed: "locked",
};

function lifecycleOptions(status: PartnerLifecycleStatus): LifecycleOption[] {
  if (status === "prospect") {
    return [
      {
        nextStatus: "active",
        label: "Activate Partner",
        description: "Confirm that this organization is an active BOW operating partner.",
        reasonLabel: "Activation note (optional)",
        reasonRequired: false,
        tone: "positive",
      },
      {
        nextStatus: "closed",
        label: "Close Prospect",
        description: "Permanently retire this opportunity when BOW will not move forward.",
        reasonLabel: "Why is BOW closing this prospect?",
        reasonRequired: true,
        tone: "negative",
      },
    ];
  }
  if (status === "active") {
    return [
      {
        nextStatus: "paused",
        label: "Pause Partnership",
        description: "Stop partner access and surface owned readiness Work without erasing delivery history.",
        reasonLabel: "Why is this partnership being paused?",
        reasonRequired: true,
        tone: "warning",
      },
      {
        nextStatus: "closed",
        label: "Close Partnership",
        description: "Permanently close the partner only after every operating delivery record is historical.",
        reasonLabel: "Why is BOW closing this partnership?",
        reasonRequired: true,
        tone: "negative",
      },
    ];
  }
  if (status === "paused") {
    return [
      {
        nextStatus: "active",
        label: "Resume Partnership",
        description: "Restore the partner as operational and resolve lifecycle-generated Program Work.",
        reasonLabel: "What changed? (optional)",
        reasonRequired: false,
        tone: "positive",
      },
      {
        nextStatus: "closed",
        label: "Close Partnership",
        description: "Permanently close the partner only after every operating delivery record is historical.",
        reasonLabel: "Why is BOW closing this partnership?",
        reasonRequired: true,
        tone: "negative",
      },
    ];
  }
  return [];
}

function resultMessage(
  nextStatus: PartnerLifecycleStatus,
  counts: {
    riskWorkCreated?: number;
    riskWorkResolved?: number;
    sessionsRevoked?: number;
    invitationsRevoked?: number;
    profileConsentsRevoked?: number;
    passwordResetTokensConsumed?: number;
  },
): string {
  const details: string[] = [];
  if (counts.riskWorkCreated) details.push(`${counts.riskWorkCreated} readiness Work item${counts.riskWorkCreated === 1 ? "" : "s"} created`);
  if (counts.riskWorkResolved) details.push(`${counts.riskWorkResolved} readiness Work item${counts.riskWorkResolved === 1 ? "" : "s"} resolved`);
  if (counts.sessionsRevoked) details.push(`${counts.sessionsRevoked} session${counts.sessionsRevoked === 1 ? "" : "s"} revoked`);
  if (counts.invitationsRevoked) details.push(`${counts.invitationsRevoked} invitation${counts.invitationsRevoked === 1 ? "" : "s"} revoked`);
  if (counts.passwordResetTokensConsumed) details.push(`${counts.passwordResetTokensConsumed} password-reset link${counts.passwordResetTokensConsumed === 1 ? "" : "s"} revoked`);
  if (counts.profileConsentsRevoked) details.push(`${counts.profileConsentsRevoked} public profile${counts.profileConsentsRevoked === 1 ? "" : "s"} withdrawn`);
  return `Partner marked ${STATUS_LABELS[nextStatus].toLowerCase()}.${details.length ? ` ${details.join("; ")}.` : ""}`;
}

export default function PartnerLifecycleActions({
  organizationId,
  organizationName,
  currentStatus,
  impact,
  latestLifecycleEvent,
  protectedOrganization = false,
}: {
  organizationId: string;
  organizationName: string;
  currentStatus: PartnerLifecycleStatus;
  impact: LifecycleImpact;
  latestLifecycleEvent: string | null;
  protectedOrganization?: boolean;
}) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = useState<PartnerLifecycleStatus | null>(null);
  const [notice, setNotice] = useState<{ tone: "positive" | "negative"; message: string } | null>(null);
  const options = lifecycleOptions(currentStatus);
  const closeBlocked = impact.currentPrograms > 0
    || impact.activeOrEnrollingCohorts > 0
    || impact.currentClasses > 0;
  const closeBlockerSummary = [
    impact.currentPrograms > 0
      ? `${impact.currentPrograms} current Program${impact.currentPrograms === 1 ? "" : "s"}`
      : null,
    impact.activeOrEnrollingCohorts > 0
      ? `${impact.activeOrEnrollingCohorts} active or enrolling Cohort${impact.activeOrEnrollingCohorts === 1 ? "" : "s"}`
      : null,
    impact.currentClasses > 0
      ? `${impact.currentClasses} current Class${impact.currentClasses === 1 ? "" : "es"}`
      : null,
  ].filter((item): item is string => Boolean(item)).join(", ");

  async function submit(option: LifecycleOption, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingStatus) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const reason = String(formData.get("reason") ?? "").trim();
    setPendingStatus(option.nextStatus);
    setNotice(null);
    try {
      const result = await transitionPartnerLifecycle({
        organizationId,
        expectedStatus: currentStatus,
        nextStatus: option.nextStatus,
        reason,
        confirmPermanent: option.nextStatus === "closed" ? formData.get("confirmPermanent") === "yes" : undefined,
      });
      if (!result.ok) {
        setNotice({ tone: "negative", message: result.error ?? "The partner status could not be changed." });
        return;
      }
      setNotice({ tone: "positive", message: resultMessage(option.nextStatus, result) });
      form.reset();
      router.refresh();
    } catch {
      setNotice({ tone: "negative", message: "The partner status could not be changed. Refresh and try again." });
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <section aria-labelledby="partner-lifecycle-title" className="ops-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span className="ops-label">Organization lifecycle</span>
          <h2 id="partner-lifecycle-title" className="ops-section-title" style={{ margin: "5px 0 0" }}>
            {organizationName}
          </h2>
        </div>
        <Badge status={STATUS_TONES[currentStatus]}>{STATUS_LABELS[currentStatus]}</Badge>
      </div>

      <p className="ops-body" style={{ margin: "12px 0 0" }}>
        Pausing or closing signs out organization members, revokes pending invitations and password-reset links, and withdraws active public-profile sharing. Those credentials are not silently restored later.
      </p>
      <div className="ops-meta-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", marginTop: 14 }}>
        {[
          ["Current Programs", impact.currentPrograms],
          ["Live Cohorts", impact.activeOrEnrollingCohorts],
          ["Current Classes", impact.currentClasses],
        ].map(([label, value]) => (
          <div className="ops-meta" key={String(label)}>
            <span className="ops-label">{label}</span>
            <span className="ops-value--large">{value}</span>
          </div>
        ))}
      </div>
      {latestLifecycleEvent && (
        <div className="ops-alert" data-tone="info" style={{ marginTop: 14 }}>
          <span className="ops-label">Latest lifecycle reason</span>
          <p className="ops-body" style={{ margin: "4px 0 0", color: "var(--bow-ink)" }}>{latestLifecycleEvent}</p>
        </div>
      )}

      {notice && (
        <p role={notice.tone === "negative" ? "alert" : "status"} className={notice.tone === "negative" ? "ops-error" : "ops-success"} style={{ margin: "14px 0 0" }}>
          {notice.message}
        </p>
      )}

      {protectedOrganization ? (
        <p className="ops-body" style={{ margin: "16px 0 0" }}>
          BOW&apos;s core operating organization is protected from partner lifecycle changes.
        </p>
      ) : currentStatus === "closed" ? (
        <p className="ops-body" style={{ margin: "16px 0 0" }}>
          This partnership is permanent history. Create a new Organization record if BOW begins a genuinely new relationship.
        </p>
      ) : (
        <div className="ops-playbook-grid" style={{ marginTop: 18 }}>
          {options.map((option) => {
            const blocked = option.nextStatus === "closed" && closeBlocked;
            const borderColor = option.tone === "negative"
              ? "var(--bow-negative)"
              : option.tone === "warning"
                ? "var(--bow-warning)"
                : "var(--bow-positive)";
            return (
              <div key={option.nextStatus} className="ops-playbook" style={{ borderTopColor: borderColor, background: "var(--bow-white)" }}>
                <h3>{option.label}</h3>
                <p className="ops-body" style={{ margin: 0 }}>{option.description}</p>
                {blocked ? (
                  <p role="status" className="ops-body" style={{ margin: 0, color: "var(--bow-warning-text)" }}>
                    Close is blocked by {closeBlockerSummary}. Finish or retire that operating work first.
                  </p>
                ) : (
                  <form className="ops-field" onSubmit={(event) => void submit(option, event)}>
                    <label htmlFor={`partner-lifecycle-${option.nextStatus}`}>
                      {option.reasonLabel}
                    </label>
                    <textarea
                      id={`partner-lifecycle-${option.nextStatus}`}
                      name="reason"
                      required={option.reasonRequired}
                      maxLength={1000}
                      rows={3}
                      disabled={pendingStatus !== null}
                    />
                    {option.nextStatus === "closed" && (
                      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 2, fontFamily: "var(--font-interface)", fontSize: 12, lineHeight: 1.45, color: "var(--bow-ink)", textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}>
                        <input type="checkbox" name="confirmPermanent" value="yes" required disabled={pendingStatus !== null} style={{ marginTop: 2 }} />
                        I understand that Closed is permanent and this record cannot be reopened.
                      </label>
                    )}
                    <Button
                      type="submit"
                      disabled={pendingStatus !== null}
                      variant={option.tone === "positive" ? "primary" : "secondary"}
                      size="sm"
                      style={{ alignSelf: "flex-start", marginTop: 2, borderColor, color: option.tone === "warning" ? "var(--bow-warning-text)" : undefined }}
                    >
                      {pendingStatus === option.nextStatus ? "Saving…" : option.label}
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
