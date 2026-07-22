"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { closeWeeklyCycle, saveWeeklyCommitment } from "@/app/actions/people-operations";
import { Button } from "@/components/ds";
import type { WeeklyCycleView, WeeklyStatus } from "@/lib/people-operations";

export default function WeeklyCommitmentEditor({
  personId,
  personName,
  weekStart,
  cycle,
  tasks,
  outcomes,
  managerMode,
}: {
  personId: string;
  personName: string;
  weekStart: string;
  cycle: WeeklyCycleView | null;
  tasks: Array<{ id: string; title: string; workflowState: string; dueOn: string | null }>;
  outcomes: Array<{ id: string; title: string }>;
  managerMode: boolean;
}) {
  const router = useRouter();
  const [commitment, setCommitment] = useState(cycle?.commitment ?? "");
  const [expectedResult, setExpectedResult] = useState(cycle?.expectedResult ?? "");
  const [status, setStatus] = useState<WeeklyStatus>(cycle?.declaredStatus ?? "on_track");
  const [blocker, setBlocker] = useState(cycle?.blocker ?? "");
  const [helpNeeded, setHelpNeeded] = useState(cycle?.helpNeeded ?? "");
  const [outcomeId, setOutcomeId] = useState(cycle?.linkedOutcomeId ?? "");
  const [taskIds, setTaskIds] = useState<string[]>(cycle?.linkedTaskIds ?? []);
  const [closing, setClosing] = useState<"met" | "partially_met" | "missed">("met");
  const [closeReason, setCloseReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const toggleTask = (id: string) => setTaskIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const save = async () => {
    setBusy(true); setError(null); setSaved(null);
    const result = await saveWeeklyCommitment({
      personId, weekStart, commitment, expectedResult, linkedOutcomeId: outcomeId || null,
      linkedTaskIds: taskIds, status, blocker, helpNeeded, confirmAsManager: managerMode,
    });
    if (!result.ok) setError(result.error);
    else { setSaved("Weekly commitment saved."); router.refresh(); }
    setBusy(false);
  };
  const close = async () => {
    if (!cycle) return;
    setBusy(true); setError(null); setSaved(null);
    const result = await closeWeeklyCycle({ cycleId: cycle.id, assessment: closing, reason: closeReason });
    if (!result.ok) setError(result.error);
    else { setSaved("Week closed with an evidence-derived summary."); router.refresh(); }
    setBusy(false);
  };

  if (cycle?.status === "closed") {
    return (
      <div className="ops-alert" data-tone="positive">
        <p className="ops-alert__title">Week closed</p>
        <p className="ops-body">{cycle.commitment}</p>
        <p className="ops-field__help">
          {cycle.derivedSummary.approved} approved · {cycle.derivedSummary.submitted} submitted · {cycle.derivedSummary.overdue} overdue
        </p>
      </div>
    );
  }

  return (
    <div className="ops-form" style={{ gap: 14 }}>
      <div className="ops-fields">
        <div className="ops-field ops-field--wide">
          <label htmlFor={`weekly-commitment-${personId}`}>This week, success means</label>
          <input id={`weekly-commitment-${personId}`} value={commitment} maxLength={500} disabled={busy}
            placeholder={`The one result ${personName} must move forward`} onChange={(event) => setCommitment(event.target.value)} />
        </div>
        <div className="ops-field">
          <label htmlFor={`weekly-status-${personId}`}>Current status</label>
          <select id={`weekly-status-${personId}`} value={status} disabled={busy} onChange={(event) => setStatus(event.target.value as WeeklyStatus)}>
            <option value="on_track">On Track</option>
            <option value="blocked">Blocked</option>
            <option value="at_risk">At Risk</option>
          </select>
        </div>
      </div>
      <div className="ops-field">
        <label htmlFor={`weekly-result-${personId}`}>Expected result</label>
        <textarea id={`weekly-result-${personId}`} rows={2} maxLength={1000} disabled={busy} value={expectedResult}
          placeholder="What will exist or be measurably different by the end of the week?" onChange={(event) => setExpectedResult(event.target.value)} />
      </div>
      <div className="ops-fields">
        <div className="ops-field">
          <label htmlFor={`weekly-outcome-${personId}`}>Linked outcome (optional)</label>
          <select id={`weekly-outcome-${personId}`} value={outcomeId} disabled={busy} onChange={(event) => setOutcomeId(event.target.value)}>
            <option value="">No linked outcome</option>
            {outcomes.map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.title}</option>)}
          </select>
        </div>
        <div className="ops-field">
          <label htmlFor={`weekly-help-${personId}`}>Help needed</label>
          <input id={`weekly-help-${personId}`} value={helpNeeded} maxLength={1000} disabled={busy}
            placeholder="A decision, introduction, review…" onChange={(event) => setHelpNeeded(event.target.value)} />
        </div>
      </div>
      {status !== "on_track" && (
        <div className="ops-field">
          <label htmlFor={`weekly-blocker-${personId}`}>What is blocked or at risk?</label>
          <textarea id={`weekly-blocker-${personId}`} rows={2} maxLength={1000} required disabled={busy} value={blocker}
            onChange={(event) => setBlocker(event.target.value)} />
        </div>
      )}
      <fieldset style={{ border: "1px solid var(--border-rule)", padding: 12, borderRadius: "var(--radius-control)" }}>
        <legend className="ops-label" style={{ padding: "0 5px" }}>Work that proves this commitment</legend>
        {tasks.length === 0 ? <p className="ops-field__help">No open Work is assigned to this person yet.</p> : (
          <div style={{ display: "grid", gap: 8 }}>
            {tasks.map((task) => (
              <label key={task.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <input type="checkbox" checked={taskIds.includes(task.id)} disabled={busy} onChange={() => toggleTask(task.id)} />
                <span className="ops-body" style={{ color: "var(--bow-ink)" }}>
                  {task.title} <span className="ops-field__help">· {task.workflowState.replace(/_/g, " ")}{task.dueOn ? ` · due ${task.dueOn}` : ""}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
        <Button size="sm" variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : cycle ? "Update Week" : "Set This Week"}</Button>
        {cycle?.managerConfirmed && <span className="ops-success">Manager confirmed</span>}
        {saved && <span className="ops-success" role="status">{saved}</span>}
      </div>
      {cycle && (
        <div className="ops-alert" data-tone="info">
          <p className="ops-alert__title">Close the week</p>
          <div className="ops-fields" style={{ marginTop: 8 }}>
            <div className="ops-field">
              <label htmlFor={`weekly-close-${personId}`}>Outcome</label>
              <select id={`weekly-close-${personId}`} value={closing} disabled={busy} onChange={(event) => setClosing(event.target.value as typeof closing)}>
                <option value="met">Met</option>
                <option value="partially_met">Partially met</option>
                <option value="missed">Missed</option>
              </select>
            </div>
            <div className="ops-field ops-field--wide">
              <label htmlFor={`weekly-close-reason-${personId}`}>What happened?</label>
              <input id={`weekly-close-reason-${personId}`} value={closeReason} maxLength={1500} disabled={busy}
                placeholder="Required when partially met or missed" onChange={(event) => setCloseReason(event.target.value)} />
            </div>
          </div>
          <Button size="sm" variant="secondary" disabled={busy} onClick={close}>Close Week</Button>
        </div>
      )}
      {error && <p className="ops-error" role="alert">{error}</p>}
    </div>
  );
}
