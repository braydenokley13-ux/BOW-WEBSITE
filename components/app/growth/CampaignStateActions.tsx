"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateGrowthCampaignState } from "@/app/actions/growth";
import { Button, Modal } from "@/components/ds";

type CampaignStatus = "draft" | "active" | "paused" | "completed" | "cancelled";

interface Props {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  spendCents: number;
  expectedUpdatedAt: number;
}

const transitions: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["draft", "active", "cancelled"],
  active: ["active", "paused", "completed", "cancelled"],
  paused: ["paused", "active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export default function CampaignStateActions({ campaignId, campaignName, status, spendCents, expectedUpdatedAt }: Props) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<CampaignStatus>(status);
  const [spendDollars, setSpendDollars] = useState((spendCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (transitions[status].length === 0) return null;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
    setNextStatus(status);
    setSpendDollars((spendCents / 100).toFixed(2));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const spendDollars = Number(form.get("spendDollars"));
      const result = await updateGrowthCampaignState({
        id: campaignId,
        expectedUpdatedAt,
        nextStatus,
        spendCents: Math.round(spendDollars * 100),
        spendNote: String(form.get("spendNote") ?? ""),
        decision: String(form.get("decision") ?? "") as "scale" | "iterate" | "hold" | "stop",
        learning: String(form.get("learning") ?? ""),
      });
      if (!result.ok) {
        setError(result.error ?? "BOW could not save this campaign decision.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("BOW could not save this campaign decision. Nothing changed; try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const needsDecision = nextStatus === "completed";
  const needsLearning = needsDecision || nextStatus === "cancelled";
  const spendChanged = Number.isFinite(Number(spendDollars))
    && Math.round(Number(spendDollars) * 100) !== spendCents;

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setNextStatus(status);
          setSpendDollars((spendCents / 100).toFixed(2));
          setError(null);
          setOpen(true);
        }}
      >
        Update
      </Button>
      <Modal open={open} onClose={close} title={`Update ${campaignName}`} maxWidth={600} dismissible={!busy}>
        <form className="ops-form" onSubmit={submit}>
          <fieldset className="ops-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="ops-field">
              <label htmlFor={`campaign-state-${campaignId}`}>Lifecycle state</label>
              <select id={`campaign-state-${campaignId}`} value={nextStatus} onChange={(event) => setNextStatus(event.target.value as CampaignStatus)}>
                {transitions[status].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="ops-field">
              <label htmlFor={`campaign-spend-${campaignId}`}>Spend to date (USD)</label>
              <input id={`campaign-spend-${campaignId}`} name="spendDollars" type="number" min={0} step="0.01" required value={spendDollars} onChange={(event) => setSpendDollars(event.target.value)} />
            </div>
            <div className="ops-field ops-field--wide">
              <label htmlFor={`campaign-spend-note-${campaignId}`}>Spend evidence or correction note</label>
              <textarea id={`campaign-spend-note-${campaignId}`} name="spendNote" required={spendChanged} minLength={10} maxLength={1000} rows={3} />
              <span className="ops-field__help">Required whenever spend changes. Name the invoice, expense, or correction so the audit trail explains the new total.</span>
            </div>
            {needsDecision && (
              <div className="ops-field ops-field--wide">
                <label htmlFor={`campaign-decision-${campaignId}`}>Operating decision</label>
                <select id={`campaign-decision-${campaignId}`} name="decision" required defaultValue="iterate">
                  <option value="scale">Scale</option>
                  <option value="iterate">Iterate</option>
                  <option value="hold">Hold</option>
                  <option value="stop">Stop</option>
                </select>
              </div>
            )}
            {needsLearning && (
              <div className="ops-field ops-field--wide">
                <label htmlFor={`campaign-learning-${campaignId}`}>{needsDecision ? "Reusable learning" : "Cancellation reason"}</label>
                <textarea
                  id={`campaign-learning-${campaignId}`}
                  name="learning"
                  required
                  minLength={needsDecision ? 20 : 10}
                  maxLength={3000}
                  rows={5}
                />
                <span className="ops-field__help">
                  The result is derived from canonical evidence at save time; it cannot be typed or inflated here.
                </span>
              </div>
            )}
          </fieldset>
          {error && <p className="ops-error" role="alert">{error}</p>}
          <div className="ops-form-footer">
            <Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save Campaign"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
