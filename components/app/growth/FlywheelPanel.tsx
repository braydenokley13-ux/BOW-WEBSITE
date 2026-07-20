"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignGrowthAction, promptReferralInvites } from "@/app/actions/flywheel";
import { Badge, Button } from "@/components/ds";
import OutcomeControls from "@/components/app/tasks/OutcomeControls";
import type { FlywheelSnapshot, GrowthAction } from "@/lib/flywheel-shared";

const SEVERITY_LABEL: Record<GrowthAction["severity"], string> = {
  act_now: "Act now",
  next_up: "Next up",
  watch: "Watch",
};

const SEVERITY_TONE: Record<GrowthAction["severity"], "negative" | "warning" | "neutral"> = {
  act_now: "negative",
  next_up: "warning",
  watch: "neutral",
};

/**
 * The founder's daily growth queue: ranked lifecycle triggers plus the leak
 * report. Every row states entity, reason, recommended action, age, and CTA.
 */
export default function FlywheelPanel({
  snapshot,
  staffUsers,
}: {
  snapshot: FlywheelSnapshot;
  staffUsers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [dueOn, setDueOn] = useState("");

  const run = async (key: string, work: () => Promise<{ ok: boolean; error?: string }>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyKey(key);
    setError(null);
    try {
      const result = await work();
      if (!result.ok) setError(result.error ?? "The action failed. Nothing changed.");
      else router.refresh();
    } catch {
      setError("The action failed. Nothing changed; try again.");
    } finally {
      inFlight.current = false;
      setBusyKey(null);
    }
  };

  return (
    <>
      <section className="ops-panel ops-panel--signal ops-anchor" aria-labelledby="flywheel-actions-heading">
        <div className="ops-section-head">
          <div>
            <span className="ops-label">Flywheel</span>
            <h2 className="ops-section-title" id="flywheel-actions-heading">Growth actions today</h2>
          </div>
          <span className="ops-section-note">
            Ranked lifecycle triggers — each one exists because a real record crossed a threshold.
          </span>
        </div>
        {error && <p className="ops-error" role="alert">{error}</p>}
        {snapshot.actions.length === 0 ? (
          <div className="ops-empty">
            <h3 className="ops-empty__title">No growth actions waiting.</h3>
            <p className="ops-empty__body">
              Completed programs, finished classes, warm demo requests, and referral moments surface here automatically.
            </p>
          </div>
        ) : (
          <div className="ops-list">
            {snapshot.actions.map((action) => (
              <article className="ops-list-row" key={action.key}>
                <div>
                  <Link className="ops-record-name" href={action.entityHref}>{action.entityLabel}</Link>
                  <span className="ops-record-meta">{action.reason}</span>
                </div>
                <Badge status={SEVERITY_TONE[action.severity]}>{SEVERITY_LABEL[action.severity]}</Badge>
                <p className="ops-body" style={{ margin: 0 }}>{action.action}</p>
                <div className="ops-row-actions">
                  {action.key === "referral-pool" ? (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busyKey === action.key}
                      onClick={() => run(action.key, () => promptReferralInvites())}
                    >
                      {busyKey === action.key ? "Creating…" : "Create invites"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" href={action.entityHref}>{action.ctaLabel}</Button>
                  )}
                  {action.taskId && (
                    <Button size="sm" variant="ghost" onClick={() => setOpenPanel(openPanel === action.key ? null : action.key)}>
                      {openPanel === action.key ? "Close" : "Record outcome"}
                    </Button>
                  )}
                  {action.assignable && (
                    <Button size="sm" variant="ghost" onClick={() => { setOwner(""); setDueOn(""); setOpenPanel(openPanel === action.key ? null : action.key); }}>
                      {openPanel === action.key ? "Close" : "Assign"}
                    </Button>
                  )}
                </div>
                {openPanel === action.key && action.taskId && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <OutcomeControls taskId={action.taskId} onDone={() => setOpenPanel(null)} />
                  </div>
                )}
                {openPanel === action.key && action.assignable && !action.taskId && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
                    <select
                      aria-label="Owner"
                      value={owner}
                      onChange={(event) => setOwner(event.currentTarget.value)}
                      style={{ minHeight: 34, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "4px 8px", fontFamily: "var(--font-interface)", fontSize: 13 }}
                    >
                      <option value="">Unowned (queue it)</option>
                      {staffUsers.map((user) => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                    <input
                      type="date"
                      aria-label="Due date"
                      value={dueOn}
                      onChange={(event) => setDueOn(event.currentTarget.value)}
                      style={{ minHeight: 34, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "4px 8px", fontFamily: "var(--font-interface)", fontSize: 13 }}
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busyKey === action.key}
                      onClick={() =>
                        run(action.key, () => assignGrowthAction({ key: action.key, ownerUserId: owner || null, dueOn: dueOn || null })).then(() => setOpenPanel(null))
                      }
                    >
                      {busyKey === action.key ? "Assigning…" : "Create Work item"}
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {snapshot.leaks.length > 0 && (
        <section className="ops-panel ops-panel--flat ops-anchor" aria-labelledby="flywheel-leaks-heading">
          <div className="ops-section-head">
            <div>
              <span className="ops-label">Flywheel leaks</span>
              <h2 className="ops-section-title" id="flywheel-leaks-heading">Where growth is being lost</h2>
            </div>
          </div>
          <div className="ops-meta-grid">
            {snapshot.leaks.map((leak) => (
              <div className="ops-meta" key={leak.key}>
                <span className="ops-label">{leak.label}</span>
                <span className="ops-value">
                  <Link className="ops-inline-link" href={leak.href}>{leak.count} record{leak.count === 1 ? "" : "s"}</Link>
                  {" — "}{leak.detail}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
