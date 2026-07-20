"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bulkAssignUnowned, createNextStep, escalateToFounder, rebalanceWork } from "@/app/actions/management";
import { Badge, Button } from "@/components/ds";
import type { ManagementIssue } from "@/lib/management";

const LEVEL_LABEL: Record<ManagementIssue["level"], string> = {
  act_now: "Act now",
  fix_week: "Fix this week",
  watch: "Watch",
};

const LEVEL_TONE: Record<ManagementIssue["level"], "negative" | "warning" | "neutral"> = {
  act_now: "negative",
  fix_week: "warning",
  watch: "neutral",
};

/**
 * The leadership queue: where growth is leaking and the one-click
 * intervention for each leak. Every row explains its own trigger —
 * no black-box ranking.
 */
export default function ManagementBriefing({
  issues,
  staffUsers,
}: {
  issues: ManagementIssue[];
  staffUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (key: string, work: () => Promise<{ ok: boolean; error?: string; count?: number }>, done: (count?: number) => string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      const result = await work();
      if (!result.ok) {
        setError(result.error ?? "The intervention failed. Nothing changed.");
        return;
      }
      setNotice(done(result.count));
      setOpenKey(null);
      router.refresh();
    } catch {
      setError("The intervention failed. Nothing changed; try again.");
    } finally {
      inFlight.current = false;
      setBusyKey(null);
    }
  };

  if (issues.length === 0) {
    return (
      <section className="ops-panel ops-panel--signal ops-anchor" aria-labelledby="mgmt-heading">
        <div className="ops-section-head">
          <div>
            <span className="ops-label">Management</span>
            <h2 className="ops-section-title" id="mgmt-heading">Where growth is leaking</h2>
          </div>
        </div>
        <div className="ops-empty">
          <h3 className="ops-empty__title">No management issues right now.</h3>
          <p className="ops-empty__body">
            Every loop has an owner, nothing is stalled past threshold, and no one is overloaded. This section stays empty until a rule trips — healthy loops make no noise.
          </p>
        </div>
      </section>
    );
  }

  const ownerPicker = (
    <select
      aria-label="Assign to"
      value={target}
      onChange={(event) => setTarget(event.currentTarget.value)}
      style={{ minHeight: 34, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "4px 8px", fontFamily: "var(--font-interface)", fontSize: 13 }}
    >
      <option value="">Choose a person…</option>
      {staffUsers.map((user) => (
        <option key={user.id} value={user.id}>{user.name}</option>
      ))}
    </select>
  );

  return (
    <section className="ops-panel ops-panel--signal ops-anchor" aria-labelledby="mgmt-heading">
      <div className="ops-section-head">
        <div>
          <span className="ops-label">Management</span>
          <h2 className="ops-section-title" id="mgmt-heading">Where growth is leaking</h2>
        </div>
        <span className="ops-section-note">
          Deterministic rules over execution data. Each item says why it appeared and what to do; it disappears when resolved.
        </span>
      </div>
      {error && <p className="ops-error" role="alert">{error}</p>}
      {notice && <p className="ops-success" role="status">{notice}</p>}
      <div className="ops-list">
        {issues.map((issue) => (
          <article className="ops-list-row" key={issue.key}>
            <div>
              <Link className="ops-record-name" href={issue.href}>{issue.title}</Link>
              <span className="ops-record-meta">{issue.why}</span>
            </div>
            <Badge status={LEVEL_TONE[issue.level]}>{LEVEL_LABEL[issue.level]}</Badge>
            <div>
              <p className="ops-body" style={{ margin: 0 }}>{issue.intervention}</p>
              <span className="ops-record-meta">{issue.evidence}</span>
            </div>
            <div className="ops-row-actions">
              <Button size="sm" variant="secondary" href={issue.href}>Inspect</Button>
              {issue.action && (
                <Button
                  size="sm"
                  variant={issue.level === "act_now" ? "primary" : "ghost"}
                  onClick={() => {
                    setTarget("");
                    setError(null);
                    if (issue.action!.kind === "escalate") {
                      run(issue.key, () => escalateToFounder({ entityType: issue.action!.kind === "escalate" ? issue.action!.entityType : "", entityId: issue.action!.kind === "escalate" ? issue.action!.entityId : "", reason: issue.title }), () => "Escalated to the founder queue.");
                    } else {
                      setOpenKey(openKey === issue.key ? null : issue.key);
                    }
                  }}
                  disabled={busyKey === issue.key}
                >
                  {issue.action.kind === "escalate" ? (busyKey === issue.key ? "Escalating…" : "Escalate") : openKey === issue.key ? "Close" : "Intervene"}
                </Button>
              )}
            </div>
            {openKey === issue.key && issue.action && issue.action.kind !== "escalate" && (
              <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
                {issue.action.kind === "bulk_assign_unowned" && (
                  <>
                    {ownerPicker}
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!target || busyKey === issue.key}
                      onClick={() => run(issue.key, () => bulkAssignUnowned({ ownerUserId: target }), (count) => `Assigned ${count ?? 0} items.`)}
                    >
                      {busyKey === issue.key ? "Assigning…" : "Assign up to 25 oldest"}
                    </Button>
                  </>
                )}
                {issue.action.kind === "rebalance" && (
                  <>
                    <span className="ops-record-meta">Move oldest overdue from {issue.action.fromName} to:</span>
                    {ownerPicker}
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={!target || busyKey === issue.key}
                      onClick={() => run(issue.key, () => rebalanceWork({ fromUserId: (issue.action as { fromUserId: string }).fromUserId, toUserId: target }), (count) => `Moved ${count ?? 0} items.`)}
                    >
                      {busyKey === issue.key ? "Moving…" : "Move up to 10"}
                    </Button>
                  </>
                )}
                {issue.action.kind === "next_step" && (
                  <>
                    {ownerPicker}
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busyKey === issue.key}
                      onClick={() => run(issue.key, () => createNextStep({ entityType: (issue.action as { entityType: string }).entityType, entityId: (issue.action as { entityId: string }).entityId, ownerUserId: target || null }), () => "Next step created (due in 2 days).")}
                    >
                      {busyKey === issue.key ? "Creating…" : "Create next step"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
