"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createRegion,
  updateRegion,
  type RegionFormOptions,
  type RegionInput,
  type RegionRecord,
  type RegionStage,
} from "@/app/actions/regions";
import { Button } from "@/components/ds";
import { COMMON_TIME_ZONES } from "@/lib/timezone";

interface RegionFormProps {
  options: RegionFormOptions;
  initial?: RegionRecord | null;
  defaultLeaderUserId?: string | null;
}

const STAGE_LABELS: Record<RegionStage, string> = {
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};

const ALLOWED_TRANSITIONS: Record<RegionStage, RegionStage[]> = {
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: [],
};

export default function RegionForm({
  options,
  initial = null,
  defaultLeaderUserId = null,
}: RegionFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [leaderUserId, setLeaderUserId] = useState(initial?.leaderUserId ?? defaultLeaderUserId ?? "");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "America/New_York");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [stage, setStage] = useState<RegionStage>(initial?.stage ?? "active");
  const [transitionReason, setTransitionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageChanged = Boolean(initial && stage !== initial.stage);
  const needsLeader = stage === "active";
  const cannotSubmit = busy
    || name.trim().length < 2
    || !/^[A-Za-z][A-Za-z0-9_-]{1,19}$/.test(code.trim())
    || !timezone.trim()
    || (needsLeader && !leaderUserId)
    || (stageChanged && transitionReason.trim().length < 8);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const input: RegionInput = {
      name,
      code,
      leaderUserId: leaderUserId || null,
      timezone,
      stage,
      notes: notes || null,
      transitionReason: transitionReason || null,
    };

    try {
      const result = initial
        ? await updateRegion(initial.id, initial.updatedAt, initial.stage, input)
        : await createRegion(input);
      if (!result.ok) {
        setError(result.error ?? "The Region could not be saved.");
        setBusy(false);
        return;
      }
      const savedId = result.id ?? initial?.id;
      router.push(savedId ? `/app/regions/${savedId}` : "/app/regions");
      router.refresh();
    } catch {
      setError("The Region could not be saved because the connection was interrupted. Refresh before retrying so newer work is not overwritten.");
      setBusy(false);
    }
  };

  return (
    <form
      className="ops-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Regional identity</h2>
          <p className="ops-form-section__help">
            Use one durable Region for the cities and Locations operated by the same leadership structure.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field ops-field--wide">
            <label htmlFor="region-name">Region name</label>
            <input
              id="region-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={120}
              autoComplete="organization"
              placeholder="Mid-Atlantic"
              required
            />
            <span className="ops-field__help">Use the name leadership uses in planning and reporting.</span>
          </div>
          <div className="ops-field">
            <label htmlFor="region-code">Region code</label>
            <input
              id="region-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              minLength={2}
              maxLength={20}
              pattern="[A-Za-z][A-Za-z0-9_-]{1,19}"
              autoComplete="off"
              spellCheck={false}
              placeholder="MID_ATL"
              required
            />
            <span className="ops-field__help">2–20 characters. Start with a letter; use letters, numbers, hyphens, or underscores.</span>
          </div>
          <div className="ops-field">
            <label htmlFor="region-timezone">Default IANA timezone</label>
            <input
              id="region-timezone"
              list="region-timezone-options"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              maxLength={100}
              autoComplete="off"
              placeholder="America/New_York"
              required
            />
            <datalist id="region-timezone-options">
              {COMMON_TIME_ZONES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </datalist>
            <span className="ops-field__help">Locations may override this default when a Region crosses timezones.</span>
          </div>
        </div>
      </section>

      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Accountability</h2>
          <p className="ops-form-section__help">
            The regional leader owns cross-Location visibility, escalation, and the operating rhythm.
          </p>
        </div>
        <div className="ops-fields">
          <div className="ops-field ops-field--wide">
            <label htmlFor="region-leader">Regional leader</label>
            <select
              id="region-leader"
              value={leaderUserId}
              onChange={(event) => setLeaderUserId(event.target.value)}
              required={needsLeader}
            >
              <option value="">No leader assigned</option>
              {options.staff.map((staff) => (
                <option key={staff.id} value={staff.id}>{staff.name} · {staff.role}</option>
              ))}
            </select>
            <span className="ops-field__help">Active Regions require an active admin or growth team member.</span>
          </div>
          <div className="ops-field ops-field--wide">
            <label htmlFor="region-notes">Operating notes</label>
            <textarea
              id="region-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={5000}
              placeholder="Regional strategy, local constraints, leadership coverage, or expansion context."
            />
            <span className="ops-field__help">Preserve context another leader would need to operate this Region.</span>
          </div>
        </div>
      </section>

      <section className="ops-form-section">
        <div>
          <h2 className="ops-form-section__title">Lifecycle</h2>
          <p className="ops-form-section__help">
            Pause a Region when operations need recovery. Closing is permanent and preserves the historical record.
          </p>
        </div>
        <div className="ops-fields">
          {initial ? (
            <>
              <div className="ops-field ops-field--wide">
                <label htmlFor="region-stage">Operating stage</label>
                <select
                  id="region-stage"
                  value={stage}
                  onChange={(event) => {
                    setStage(event.target.value as RegionStage);
                    setTransitionReason("");
                  }}
                >
                  <option value={initial.stage}>Keep {STAGE_LABELS[initial.stage]}</option>
                  {ALLOWED_TRANSITIONS[initial.stage].map((nextStage) => (
                    <option key={nextStage} value={nextStage}>Move to {STAGE_LABELS[nextStage]}</option>
                  ))}
                </select>
              </div>
              {stageChanged && (
                <div className="ops-field ops-field--wide">
                  <label htmlFor="region-transition-reason">Reason for lifecycle change</label>
                  <textarea
                    id="region-transition-reason"
                    value={transitionReason}
                    onChange={(event) => setTransitionReason(event.target.value)}
                    minLength={8}
                    maxLength={1000}
                    required
                    placeholder="What changed, why this stage is accurate, and who owns the next move."
                  />
                  <span className="ops-field__help">Required for every lifecycle decision and preserved in the operating history.</span>
                </div>
              )}
              {stage === "closed" && stageChanged && (
                <div className="ops-alert" data-tone="warning" style={{ gridColumn: "1 / -1" }}>
                  <span className="ops-alert__title">Closing permanently locks this Region</span>
                  <p className="ops-body" style={{ marginTop: 5 }}>
                    Every Location in this Region must already be closed. The Region cannot be edited, reopened, or deleted afterward.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="ops-alert" data-tone="info" style={{ gridColumn: "1 / -1" }}>
              <span className="ops-alert__title">New Regions begin active</span>
              <p className="ops-body" style={{ marginTop: 5 }}>
                Assign the accountable leader now, then create the Region&apos;s first Location.
              </p>
            </div>
          )}
        </div>
      </section>

      {error && <p className="ops-error" role="alert" aria-live="assertive">{error}</p>}
      <div className="ops-form-footer">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" variant="emphasis" disabled={cannotSubmit}>
          {busy ? "Saving Region…" : initial ? "Save Region" : "Create Region"}
        </Button>
      </div>
    </form>
  );
}
