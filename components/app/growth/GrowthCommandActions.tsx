"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createGrowthAssignment,
  createGrowthCampaign,
  createGrowthContributor,
  createGrowthPlaybook,
  createOperatingGoal,
  recordStudentAcquisition,
  recordStudentProgramOutcome,
  recordStudentReferral,
  type GrowthActionResult,
} from "@/app/actions/growth";
import { Button, Modal } from "@/components/ds";
import {
  CAMPAIGN_METRICS,
  GROWTH_METRICS,
  type CampaignMetric,
  type GoalScopeType,
} from "@/lib/growth-contracts";
import type { GrowthCommandCenter, GrowthOption } from "@/lib/growth";
import GrowthEntityPicker from "@/components/app/growth/GrowthEntityPicker";

type ModalKind = "campaign" | "contributor" | "assignment" | "goal" | "evidence" | "playbook";
type EvidenceKind = "acquisition" | "referral" | "outcome";

interface Props {
  options: GrowthCommandCenter["options"];
  today: string;
  quarterEnd: string;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function number(form: FormData, name: string): number {
  return Number(text(form, name));
}

function dollarsToCents(form: FormData, name: string): number {
  return Math.round(number(form, name) * 100);
}

function OptionList({ options }: { options: GrowthOption[] }) {
  return options.map((option) => (
    <option key={option.id} value={option.id}>
      {option.label}{option.meta ? ` · ${option.meta.replace(/_/g, " ")}` : ""}
    </option>
  ));
}

function Field({ label, htmlFor, help, wide = false, children }: {
  label: string;
  htmlFor: string;
  help?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`ops-field${wide ? " ops-field--wide" : ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {help && <span className="ops-field__help">{help}</span>}
    </div>
  );
}

const modalTitles: Record<ModalKind, string> = {
  campaign: "Create Campaign",
  contributor: "Add Contributor",
  assignment: "Assign Growth Role",
  goal: "Set Operating Goal",
  evidence: "Record Growth Evidence",
  playbook: "Promote a Playbook",
};

export default function GrowthCommandActions({ options, today, quarterEnd }: Props) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [evidenceKind, setEvidenceKind] = useState<EvidenceKind>("acquisition");
  const [scopeType, setScopeType] = useState<GoalScopeType>("organization");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (kind: ModalKind) => {
    setError(null);
    setModal(kind);
  };

  const close = () => {
    if (busy) return;
    setError(null);
    setModal(null);
  };

  const run = async (work: () => Promise<GrowthActionResult>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await work();
      if (!result.ok) {
        setError(result.error ?? "BOW could not save this operating record.");
        return;
      }
      setModal(null);
      router.refresh();
    } catch {
      setError("BOW could not save this operating record. Nothing changed; try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const submitCampaign = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => createGrowthCampaign({
      name: text(form, "name"),
      channelId: text(form, "channelId"),
      ownerUserId: text(form, "ownerUserId"),
      regionId: text(form, "regionId"),
      locationId: text(form, "locationId"),
      hypothesis: text(form, "hypothesis"),
      status: text(form, "status") as "draft" | "active",
      startsOn: text(form, "startsOn"),
      endsOn: text(form, "endsOn"),
      targetMetric: text(form, "targetMetric") as CampaignMetric,
      targetValue: number(form, "targetValue"),
      budgetCents: dollarsToCents(form, "budgetDollars"),
    }));
  };

  const submitContributor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => createGrowthContributor({
      personId: text(form, "personId"),
      status: text(form, "status") as "candidate" | "active",
      sourceChannelId: text(form, "sourceChannelId"),
      joinedOn: text(form, "joinedOn"),
      notes: text(form, "notes"),
    }));
  };

  const submitAssignment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => createGrowthAssignment({
      contributorId: text(form, "contributorId"),
      role: text(form, "role") as "ambassador" | "growth_captain" | "market_lead" | "regional_lead",
      managerAssignmentId: text(form, "managerAssignmentId"),
      regionId: text(form, "regionId"),
      locationId: text(form, "locationId"),
      startsOn: text(form, "startsOn"),
      decisionReason: text(form, "decisionReason"),
    }));
  };

  const scopeOptions: Record<Exclude<GoalScopeType, "program">, GrowthOption[]> = {
    organization: options.organizations,
    region: options.regions,
    location: options.locations,
    campaign: options.campaigns,
    assignment: options.assignments,
  };
  const selectedScopeOptions = scopeType === "program" ? [] : scopeOptions[scopeType];

  const submitGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => createOperatingGoal({
      scopeType,
      scopeId: text(form, "scopeId"),
      metric: text(form, "metric") as (typeof GROWTH_METRICS)[number],
      targetValue: number(form, "targetValue"),
      startsOn: text(form, "startsOn"),
      endsOn: text(form, "endsOn"),
      ownerUserId: text(form, "ownerUserId"),
      notes: text(form, "notes"),
    }));
  };

  const submitEvidence = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (evidenceKind === "acquisition") {
      void run(() => recordStudentAcquisition({
        studentId: text(form, "studentId"),
        channelId: text(form, "channelId"),
        campaignId: text(form, "campaignId"),
        contributorId: text(form, "contributorId"),
        touchpointType: text(form, "touchpointType") as "inquiry" | "referral" | "outreach" | "event" | "partner_distribution" | "organic_social" | "paid" | "other",
        method: text(form, "method") as "direct" | "self_reported" | "referral" | "imported" | "operator_verified",
        evidenceNote: text(form, "evidenceNote"),
        detail: text(form, "detail"),
      }));
      return;
    }
    if (evidenceKind === "referral") {
      void run(() => recordStudentReferral({
        referrerPersonId: text(form, "referrerPersonId"),
        referredStudentId: text(form, "referredStudentId"),
        channelId: text(form, "channelId"),
        campaignId: text(form, "campaignId"),
        contributorId: text(form, "contributorId"),
        evidenceNote: text(form, "evidenceNote"),
      }));
      return;
    }
    void run(() => recordStudentProgramOutcome({
      studentId: text(form, "studentId"),
      programId: text(form, "programId"),
      outcomeType: text(form, "outcomeType") as "completed" | "progressed" | "graduated" | "withdrawn" | "transferred",
      occurredOn: text(form, "occurredOn"),
      evidenceNote: text(form, "evidenceNote"),
    }));
  };

  const submitPlaybook = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => createGrowthPlaybook({
      title: text(form, "title"),
      sourceCampaignId: text(form, "sourceCampaignId"),
      ownerUserId: text(form, "ownerUserId"),
      status: text(form, "status") as "draft" | "active",
      problem: text(form, "problem"),
      play: text(form, "play"),
      evidence: text(form, "evidence"),
      adoptionNotes: text(form, "adoptionNotes"),
    }));
  };

  const referralChannels = options.channels.filter((option) => option.meta === "referral");

  return (
    <>
      <div className="ops-actions" aria-label="Growth operating actions">
        <Button variant="emphasis" onClick={() => open("campaign")}>New Campaign</Button>
        <Button variant="secondary" onClick={() => open("contributor")}>Add Contributor</Button>
        <Button variant="secondary" onClick={() => open("assignment")} disabled={options.assignableContributors.length === 0}>Assign Role</Button>
        <Button variant="secondary" onClick={() => open("goal")}>Set Goal</Button>
        <Button variant="ink" onClick={() => open("evidence")}>Record Evidence</Button>
        <Button variant="ghost" onClick={() => open("playbook")} disabled={options.completedCampaigns.length === 0}>Promote Playbook</Button>
      </div>

      <Modal open={modal === "campaign"} onClose={close} title={modalTitles.campaign} maxWidth={760} dismissible={!busy}>
        <form className="ops-form" onSubmit={submitCampaign}>
          <fieldset className="ops-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <Field label="Campaign name" htmlFor="growth-campaign-name" wide>
              <input id="growth-campaign-name" name="name" required minLength={3} maxLength={160} autoComplete="off" />
            </Field>
            <Field label="Channel" htmlFor="growth-campaign-channel">
              <select id="growth-campaign-channel" name="channelId" required defaultValue=""><option value="" disabled>Select channel</option><OptionList options={options.channels} /></select>
            </Field>
            <Field label="Lifecycle" htmlFor="growth-campaign-status" help="Drafts may be unowned; active campaigns may not.">
              <select id="growth-campaign-status" name="status" defaultValue="draft"><option value="draft">Draft</option><option value="active">Active</option></select>
            </Field>
            <Field label="Accountable owner" htmlFor="growth-campaign-owner">
              <select id="growth-campaign-owner" name="ownerUserId" defaultValue=""><option value="">Unassigned draft</option><OptionList options={options.staff} /></select>
            </Field>
            <Field label="Region" htmlFor="growth-campaign-region">
              <select id="growth-campaign-region" name="regionId" defaultValue=""><option value="">Organization-wide / derive from Location</option><OptionList options={options.regions} /></select>
            </Field>
            <Field label="Location" htmlFor="growth-campaign-location">
              <select id="growth-campaign-location" name="locationId" defaultValue=""><option value="">No Location scope</option><OptionList options={options.locations} /></select>
            </Field>
            <Field label="Start" htmlFor="growth-campaign-start"><input id="growth-campaign-start" name="startsOn" type="date" required defaultValue={today} /></Field>
            <Field label="End" htmlFor="growth-campaign-end"><input id="growth-campaign-end" name="endsOn" type="date" required defaultValue={quarterEnd} /></Field>
            <Field label="Target metric" htmlFor="growth-campaign-metric">
              <select id="growth-campaign-metric" name="targetMetric" defaultValue="verified_participants">{CAMPAIGN_METRICS.map((metric) => <option key={metric} value={metric}>{metric.replace(/_/g, " ")}</option>)}</select>
            </Field>
            <Field label="Target" htmlFor="growth-campaign-target"><input id="growth-campaign-target" name="targetValue" type="number" min={1} step={1} required defaultValue={25} /></Field>
            <Field label="Budget (USD)" htmlFor="growth-campaign-budget"><input id="growth-campaign-budget" name="budgetDollars" type="number" min={0} step="0.01" required defaultValue={0} /></Field>
            <Field label="Testable hypothesis" htmlFor="growth-campaign-hypothesis" help="State what action should cause what measurable result, and for whom." wide>
              <textarea id="growth-campaign-hypothesis" name="hypothesis" required minLength={20} maxLength={2000} rows={4} />
            </Field>
          </fieldset>
          {error && <p className="ops-error" role="alert">{error}</p>}
          <div className="ops-form-footer"><Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" variant="emphasis" disabled={busy}>{busy ? "Creating…" : "Create Campaign"}</Button></div>
        </form>
      </Modal>

      <Modal open={modal === "contributor"} onClose={close} title={modalTitles.contributor} maxWidth={680} dismissible={!busy}>
        <form className="ops-form" onSubmit={submitContributor}>
          <fieldset className="ops-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <Field label="Person" htmlFor="growth-contributor-person" help="People remain the one persistent human identity." wide>
              <GrowthEntityPicker id="growth-contributor-person" name="personId" kind="prospective_contributor" placeholder="Search People by name or email" required />
            </Field>
            <Field label="Starting status" htmlFor="growth-contributor-status"><select id="growth-contributor-status" name="status" defaultValue="candidate"><option value="candidate">Candidate</option><option value="active">Active</option></select></Field>
            <Field label="Joined on" htmlFor="growth-contributor-joined"><input id="growth-contributor-joined" name="joinedOn" type="date" defaultValue={today} /></Field>
            <Field label="Source channel" htmlFor="growth-contributor-source"><select id="growth-contributor-source" name="sourceChannelId" defaultValue=""><option value="">Not recorded</option><OptionList options={options.channels} /></select></Field>
            <Field label="Notes" htmlFor="growth-contributor-notes" wide><textarea id="growth-contributor-notes" name="notes" maxLength={2000} rows={4} /></Field>
          </fieldset>
          {error && <p className="ops-error" role="alert">{error}</p>}
          <div className="ops-form-footer"><Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add Contributor"}</Button></div>
        </form>
      </Modal>

      <Modal open={modal === "assignment"} onClose={close} title={modalTitles.assignment} maxWidth={720} dismissible={!busy}>
        <form className="ops-form" onSubmit={submitAssignment}>
          <fieldset className="ops-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <Field label="Contributor" htmlFor="growth-assignment-contributor"><select id="growth-assignment-contributor" name="contributorId" required defaultValue=""><option value="" disabled>Select contributor</option><OptionList options={options.assignableContributors} /></select></Field>
            <Field label="Role" htmlFor="growth-assignment-role"><select id="growth-assignment-role" name="role" defaultValue="ambassador"><option value="ambassador">Ambassador</option><option value="growth_captain">Growth Captain</option><option value="market_lead">Market Lead</option><option value="regional_lead">Regional Lead</option></select></Field>
            <Field label="Manager assignment" htmlFor="growth-assignment-manager" help="Only Regional Leads stand at the top of the contributor hierarchy." wide>
              <select id="growth-assignment-manager" name="managerAssignmentId" defaultValue=""><option value="">No manager — Regional Lead only</option><OptionList options={options.assignments} /></select>
            </Field>
            <Field label="Region" htmlFor="growth-assignment-region"><select id="growth-assignment-region" name="regionId" defaultValue=""><option value="">Inherit from manager</option><OptionList options={options.regions} /></select></Field>
            <Field label="Location" htmlFor="growth-assignment-location"><select id="growth-assignment-location" name="locationId" defaultValue=""><option value="">No Location / inherit</option><OptionList options={options.locations} /></select></Field>
            <Field label="Starts on" htmlFor="growth-assignment-start"><input id="growth-assignment-start" name="startsOn" type="date" required defaultValue={today} /></Field>
            <Field label="Decision reason" htmlFor="growth-assignment-reason" help="Explain why this person, role, scope, and reporting line are right." wide><textarea id="growth-assignment-reason" name="decisionReason" required minLength={10} maxLength={1000} rows={4} /></Field>
          </fieldset>
          {error && <p className="ops-error" role="alert">{error}</p>}
          <div className="ops-form-footer"><Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Assigning…" : "Start Assignment"}</Button></div>
        </form>
      </Modal>

      <Modal open={modal === "goal"} onClose={close} title={modalTitles.goal} maxWidth={720} dismissible={!busy}>
        <form className="ops-form" onSubmit={submitGoal}>
          <fieldset className="ops-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <Field label="Scope type" htmlFor="growth-goal-scope-type"><select id="growth-goal-scope-type" value={scopeType} onChange={(event) => setScopeType(event.target.value as GoalScopeType)}>{Object.keys(scopeOptions).map((scope) => <option key={scope} value={scope}>{scope.replace(/_/g, " ")}</option>)}</select></Field>
            <Field label="Owned scope" htmlFor="growth-goal-scope">
              {scopeType === "program" ? (
                <GrowthEntityPicker key={scopeType} id="growth-goal-scope" name="scopeId" kind="program" placeholder="Search Programs by name" required />
              ) : (
                <select key={scopeType} id="growth-goal-scope" name="scopeId" required defaultValue=""><option value="" disabled>Select {scopeType}</option><OptionList options={selectedScopeOptions} /></select>
              )}
            </Field>
            <Field label="Evidence metric" htmlFor="growth-goal-metric"><select id="growth-goal-metric" name="metric" defaultValue="verified_participants">{GROWTH_METRICS.map((metric) => <option key={metric} value={metric}>{metric.replace(/_/g, " ")}</option>)}</select></Field>
            <Field label="Target" htmlFor="growth-goal-target"><input id="growth-goal-target" name="targetValue" type="number" min={1} step={1} required defaultValue={50} /></Field>
            <Field label="Starts" htmlFor="growth-goal-start"><input id="growth-goal-start" name="startsOn" type="date" required defaultValue={today} /></Field>
            <Field label="Ends" htmlFor="growth-goal-end"><input id="growth-goal-end" name="endsOn" type="date" required defaultValue={quarterEnd} /></Field>
            <Field label="Accountable owner" htmlFor="growth-goal-owner"><select id="growth-goal-owner" name="ownerUserId" required defaultValue=""><option value="" disabled>Select owner</option><OptionList options={options.staff} /></select></Field>
            <Field label="Operating note" htmlFor="growth-goal-notes" wide><textarea id="growth-goal-notes" name="notes" maxLength={2000} rows={3} /></Field>
          </fieldset>
          {scopeType !== "program" && selectedScopeOptions.length === 0 && <p className="ops-error" role="status">Create the selected operating scope before assigning it a goal.</p>}
          {error && <p className="ops-error" role="alert">{error}</p>}
          <div className="ops-form-footer"><Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || (scopeType !== "program" && selectedScopeOptions.length === 0)}>{busy ? "Saving…" : "Set Goal"}</Button></div>
        </form>
      </Modal>

      <Modal open={modal === "evidence"} onClose={close} title={modalTitles.evidence} maxWidth={740} dismissible={!busy}>
        <nav className="ops-filters" aria-label="Evidence type" style={{ marginTop: 0 }}>
          {(["acquisition", "referral", "outcome"] as EvidenceKind[]).map((kind) => <button key={kind} className="ops-filter" type="button" aria-current={evidenceKind === kind ? "page" : undefined} disabled={busy} onClick={() => { setEvidenceKind(kind); setError(null); }}>{kind}</button>)}
        </nav>
        <form key={evidenceKind} className="ops-form" onSubmit={submitEvidence}>
          <fieldset className="ops-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            {evidenceKind === "acquisition" && (
              <>
                <Field label="Student" htmlFor="growth-evidence-student"><GrowthEntityPicker id="growth-evidence-student" name="studentId" kind="student" placeholder="Search Students by name or email" required /></Field>
                <Field label="Channel" htmlFor="growth-evidence-channel"><select id="growth-evidence-channel" name="channelId" required defaultValue=""><option value="" disabled>Select channel</option><OptionList options={options.channels} /></select></Field>
                <Field label="Campaign" htmlFor="growth-evidence-campaign"><select id="growth-evidence-campaign" name="campaignId" defaultValue=""><option value="">No campaign</option><OptionList options={options.activeCampaigns} /></select></Field>
                <Field label="Contributor" htmlFor="growth-evidence-contributor"><select id="growth-evidence-contributor" name="contributorId" defaultValue=""><option value="">No contributor</option><OptionList options={options.assignedContributors} /></select></Field>
                <Field label="Touchpoint" htmlFor="growth-evidence-touchpoint"><select id="growth-evidence-touchpoint" name="touchpointType" defaultValue="outreach"><option value="inquiry">Inquiry</option><option value="outreach">Outreach</option><option value="event">Event</option><option value="partner_distribution">Partner distribution</option><option value="organic_social">Organic social</option><option value="paid">Paid</option><option value="other">Other</option></select></Field>
                <Field label="Attribution method" htmlFor="growth-evidence-method"><select id="growth-evidence-method" name="method" defaultValue="operator_verified"><option value="operator_verified">Operator verified</option><option value="self_reported">Self reported</option><option value="direct">Direct evidence</option><option value="imported">Imported evidence</option></select></Field>
                <Field label="Evidence note" htmlFor="growth-evidence-note" help="This replaces any prior current attribution while preserving its history." wide><textarea id="growth-evidence-note" name="evidenceNote" required minLength={10} maxLength={1000} rows={3} /></Field>
                <Field label="Touchpoint detail" htmlFor="growth-evidence-detail" wide><textarea id="growth-evidence-detail" name="detail" maxLength={2000} rows={3} /></Field>
              </>
            )}
            {evidenceKind === "referral" && (
              <>
                <Field label="Referrer" htmlFor="growth-referral-referrer"><GrowthEntityPicker id="growth-referral-referrer" name="referrerPersonId" kind="person" placeholder="Search People by name or email" required /></Field>
                <Field label="Referred Student" htmlFor="growth-referral-student"><GrowthEntityPicker id="growth-referral-student" name="referredStudentId" kind="referral_student" placeholder="Search Students with a Person identity" required /></Field>
                <Field label="Referral channel" htmlFor="growth-referral-channel"><select id="growth-referral-channel" name="channelId" required defaultValue=""><option value="" disabled>Select referral channel</option><OptionList options={referralChannels} /></select></Field>
                <Field label="Campaign" htmlFor="growth-referral-campaign"><select id="growth-referral-campaign" name="campaignId" defaultValue=""><option value="">No campaign</option><OptionList options={options.activeCampaigns} /></select></Field>
                <Field label="Contributor" htmlFor="growth-referral-contributor"><select id="growth-referral-contributor" name="contributorId" defaultValue=""><option value="">No contributor</option><OptionList options={options.assignedContributors} /></select></Field>
                <Field label="Referral evidence" htmlFor="growth-referral-note" help="A referral becomes successful only after finalized attendance proves participation." wide><textarea id="growth-referral-note" name="evidenceNote" required minLength={10} maxLength={1000} rows={4} /></Field>
              </>
            )}
            {evidenceKind === "outcome" && (
              <>
                <Field label="Student" htmlFor="growth-outcome-student"><GrowthEntityPicker id="growth-outcome-student" name="studentId" kind="student" placeholder="Search Students by name or email" required /></Field>
                <Field label="Program" htmlFor="growth-outcome-program"><GrowthEntityPicker id="growth-outcome-program" name="programId" kind="program" placeholder="Search Programs by name" required /></Field>
                <Field label="Outcome" htmlFor="growth-outcome-type"><select id="growth-outcome-type" name="outcomeType" defaultValue="completed"><option value="completed">Completed</option><option value="progressed">Progressed</option><option value="graduated">Graduated</option><option value="withdrawn">Withdrawn</option><option value="transferred">Transferred</option></select></Field>
                <Field label="Occurred on" htmlFor="growth-outcome-date"><input id="growth-outcome-date" name="occurredOn" type="date" required max={today} defaultValue={today} /></Field>
                <Field label="Outcome evidence" htmlFor="growth-outcome-note" help="Attendance alone never invents completion." wide><textarea id="growth-outcome-note" name="evidenceNote" required minLength={10} maxLength={2000} rows={4} /></Field>
              </>
            )}
          </fieldset>
          {error && <p className="ops-error" role="alert">{error}</p>}
          <div className="ops-form-footer"><Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" variant="ink" disabled={busy}>{busy ? "Recording…" : "Record Evidence"}</Button></div>
        </form>
      </Modal>

      <Modal open={modal === "playbook"} onClose={close} title={modalTitles.playbook} maxWidth={740} dismissible={!busy}>
        <form className="ops-form" onSubmit={submitPlaybook}>
          <fieldset className="ops-fields" disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
            <Field label="Playbook title" htmlFor="growth-playbook-title" wide><input id="growth-playbook-title" name="title" required minLength={3} maxLength={180} /></Field>
            <Field label="Completed source campaign" htmlFor="growth-playbook-campaign"><select id="growth-playbook-campaign" name="sourceCampaignId" required defaultValue=""><option value="" disabled>Select campaign</option><OptionList options={options.completedCampaigns} /></select></Field>
            <Field label="Owner" htmlFor="growth-playbook-owner"><select id="growth-playbook-owner" name="ownerUserId" required defaultValue=""><option value="" disabled>Select owner</option><OptionList options={options.staff} /></select></Field>
            <Field label="Status" htmlFor="growth-playbook-status"><select id="growth-playbook-status" name="status" defaultValue="draft"><option value="draft">Draft</option><option value="active">Active standard</option></select></Field>
            <Field label="Problem" htmlFor="growth-playbook-problem" wide><textarea id="growth-playbook-problem" name="problem" required minLength={20} maxLength={2000} rows={3} /></Field>
            <Field label="Repeatable play" htmlFor="growth-playbook-play" wide><textarea id="growth-playbook-play" name="play" required minLength={20} maxLength={5000} rows={5} /></Field>
            <Field label="Evidence" htmlFor="growth-playbook-evidence" wide><textarea id="growth-playbook-evidence" name="evidence" required minLength={20} maxLength={3000} rows={4} /></Field>
            <Field label="Adoption notes" htmlFor="growth-playbook-adoption" wide><textarea id="growth-playbook-adoption" name="adoptionNotes" maxLength={3000} rows={3} /></Field>
          </fieldset>
          {error && <p className="ops-error" role="alert">{error}</p>}
          <div className="ops-form-footer"><Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || options.completedCampaigns.length === 0}>{busy ? "Promoting…" : "Create Playbook"}</Button></div>
        </form>
      </Modal>
    </>
  );
}
