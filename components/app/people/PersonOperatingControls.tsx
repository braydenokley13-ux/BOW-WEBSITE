"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addPlaybookTrainingRequirement,
  changeRoleManager,
  configureRoleAssignment,
  decideRoleAssignment,
  recordRecoveryCommitment,
  resolveAccountabilityEvent,
  syncPlaybookTraining,
  updateActivationRequirement,
  updateRoleCapacity,
} from "@/app/actions/people-operations";
import { Button } from "@/components/ds";

type Result = { ok: true; id?: string } | { ok: false; error: string };

export function RoleAssignmentSetup({ personId, roleAssignmentId, roles, managerAssignments, currentManagerAssignmentId }: {
  personId: string;
  roleAssignmentId: string | null;
  roles: Array<{ id: string; title: string }>;
  managerAssignments: Array<{ id: string; label: string }>;
  currentManagerAssignmentId: string | null;
}) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [managerId, setManagerId] = useState(currentManagerAssignmentId ?? "");
  const [engagement, setEngagement] = useState<"volunteer" | "employee" | "contractor" | "other">("volunteer");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setError(null);
    const result = roleAssignmentId
      ? await changeRoleManager({ roleAssignmentId, managerAssignmentId: managerId || null, reason })
      : await configureRoleAssignment({ personId, roleId, managerAssignmentId: managerId || null, engagementType: engagement });
    if (!result.ok) setError(result.error); else router.refresh(); setBusy(false);
  };
  return <div className="ops-form" style={{ gap: 10 }}><div className="ops-fields">
    {!roleAssignmentId && <><div className="ops-field"><label htmlFor="assignment-role">Role</label><select id="assignment-role" value={roleId} onChange={(event) => setRoleId(event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{role.title}</option>)}</select></div><div className="ops-field"><label htmlFor="assignment-engagement">Engagement</label><select id="assignment-engagement" value={engagement} onChange={(event) => setEngagement(event.target.value as typeof engagement)}><option value="volunteer">Volunteer</option><option value="employee">Employee</option><option value="contractor">Contractor</option><option value="other">Other</option></select></div></>}
    <div className="ops-field"><label htmlFor="assignment-manager">Manager</label><select id="assignment-manager" value={managerId} onChange={(event) => setManagerId(event.target.value)}><option value="">No manager / founder-owned</option>{managerAssignments.map((manager) => <option key={manager.id} value={manager.id}>{manager.label}</option>)}</select></div>
    {roleAssignmentId && <div className="ops-field ops-field--wide"><label htmlFor="assignment-manager-reason">Reason for reporting change</label><input id="assignment-manager-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div>}
  </div><Button size="sm" variant="secondary" disabled={busy || (!roleAssignmentId && !roleId)} onClick={save}>{busy ? "Saving…" : roleAssignmentId ? "Update Manager" : "Create Activating Role"}</Button>{error && <p className="ops-error" role="alert">{error}</p>}</div>;
}

export function CapacityControls({ roleAssignmentId, initialHours, initialAvailability }: {
  roleAssignmentId: string; initialHours: number | null; initialAvailability: string;
}) {
  const router = useRouter();
  const [hours, setHours] = useState(initialHours?.toString() ?? "");
  const [availability, setAvailability] = useState(initialAvailability);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMessage(null);
    const result = await updateRoleCapacity({ roleAssignmentId, weeklyCapacityHours: hours ? Number(hours) : null, availabilityStatus: availability as "available" | "limited" | "unavailable" });
    setMessage(result.ok ? "Capacity saved." : result.error); if (result.ok) router.refresh(); setBusy(false);
  };
  return <div className="ops-fields">
    <div className="ops-field"><label htmlFor="people-availability">Availability</label><select id="people-availability" value={availability} disabled={busy} onChange={(event) => setAvailability(event.target.value)}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></div>
    <div className="ops-field"><label htmlFor="people-capacity">Weekly capacity (hours)</label><input id="people-capacity" type="number" min={0} max={168} value={hours} disabled={busy} onChange={(event) => setHours(event.target.value)} /></div>
    <div style={{ alignSelf: "end" }}><Button size="sm" variant="secondary" disabled={busy} onClick={save}>Save Capacity</Button></div>
    {message && <p className={message === "Capacity saved." ? "ops-success" : "ops-error"}>{message}</p>}
  </div>;
}

export function ActivationControls({ roleAssignmentId, requirements, lessons = [], canManage }: {
  roleAssignmentId: string;
  requirements: Array<{ id: string; label: string; status: string; sourceType: string | null; decisionNote: string | null }>;
  lessons?: Array<{ id: string; title: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, action: () => Promise<Result>) => { setBusy(key); setError(null); const result = await action(); if (!result.ok) setError(result.error); else router.refresh(); setBusy(null); };
  const [lessonId, setLessonId] = useState("");
  const [trainingLabel, setTrainingLabel] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  return <div style={{ display: "grid", gap: 9 }}>
    {requirements.map((requirement) => <div key={requirement.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderBottom: "1px solid var(--border-rule)", paddingBottom: 8 }}>
      <div><strong className="ops-body" style={{ color: "var(--bow-ink)" }}>{requirement.label}</strong><span className="ops-field__help" style={{ display: "block" }}>{requirement.status.replace(/_/g, " ")}{requirement.sourceType === "learn_lesson" ? " · verified from Playbook" : ""}{requirement.decisionNote ? ` · ${requirement.decisionNote}` : ""}</span></div>
      {canManage && requirement.status === "pending" && <div style={{ display: "flex", gap: 6 }}><Button size="sm" variant="secondary" disabled={Boolean(busy) || decisionNote.trim().length < 5} onClick={() => run(requirement.id, () => updateActivationRequirement({ requirementId: requirement.id, status: "satisfied", reason: decisionNote }))}>Confirm</Button><Button size="sm" variant="ghost" disabled={Boolean(busy) || decisionNote.trim().length < 5} onClick={() => run(`${requirement.id}-waive`, () => updateActivationRequirement({ requirementId: requirement.id, status: "waived", reason: decisionNote }))}>Waive</Button></div>}
    </div>)}
    {canManage && requirements.some((requirement) => requirement.status === "pending") && <div className="ops-field"><label htmlFor="activation-decision-note">Manager evidence / exception reason</label><input id="activation-decision-note" value={decisionNote} maxLength={1500} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Required before confirming or waiving a requirement" /></div>}
    {canManage && <Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => run("sync", () => syncPlaybookTraining(roleAssignmentId))}>Sync Playbook Training</Button>}
    {canManage && lessons.length > 0 && <div className="ops-alert" data-tone="info"><p className="ops-alert__title">Link Playbook training</p><div className="ops-fields" style={{ marginTop: 8 }}><div className="ops-field"><label htmlFor="activation-playbook-lesson">Published lesson</label><select id="activation-playbook-lesson" value={lessonId} onChange={(event) => { setLessonId(event.target.value); const lesson = lessons.find((item) => item.id === event.target.value); if (lesson && !trainingLabel) setTrainingLabel(`Complete ${lesson.title}`); }}><option value="">Choose lesson</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></div><div className="ops-field"><label htmlFor="activation-training-label">Requirement label</label><input id="activation-training-label" value={trainingLabel} onChange={(event) => setTrainingLabel(event.target.value)} /></div></div><Button size="sm" variant="secondary" disabled={Boolean(busy) || !lessonId} onClick={() => run("add-training", () => addPlaybookTrainingRequirement({ roleAssignmentId, lessonId, label: trainingLabel }))}>Add Training Requirement</Button></div>}
    {error && <p className="ops-error" role="alert">{error}</p>}
  </div>;
}

export function RoleDecisionControls({ roleAssignmentId, status, autonomy }: { roleAssignmentId: string; status: string; autonomy: number }) {
  const router = useRouter(); const [reason, setReason] = useState(""); const [nextAutonomy, setNextAutonomy] = useState(autonomy); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const decide = async (decision: "activation" | "autonomy_change" | "pause" | "resume" | "end" | "revoke" | "role_review") => { if (decision === "end" && !window.confirm("End this role assignment after all handoff checks pass? The role history will be preserved.")) return; setBusy(true); setError(null); const result = await decideRoleAssignment({ roleAssignmentId, decision, reason, nextAutonomy }); if (!result.ok) setError(result.error); else { setReason(""); router.refresh(); } setBusy(false); };
  return <div className="ops-form" style={{ gap: 10 }}>
    <div className="ops-fields"><div className="ops-field"><label htmlFor="role-autonomy">Autonomy level</label><select id="role-autonomy" value={nextAutonomy} onChange={(event) => setNextAutonomy(Number(event.target.value))}><option value={1}>1 · Directed</option><option value={2}>2 · Guided</option><option value={3}>3 · Owner</option><option value={4}>4 · Lead</option></select></div><div className="ops-field ops-field--wide"><label htmlFor="role-decision-reason">Evidence and reason</label><input id="role-decision-reason" value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} placeholder="Required for every role decision" /></div></div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      <Button size="sm" variant="primary" disabled={busy} onClick={() => decide("autonomy_change")}>Change Autonomy</Button>
      {status === "activating" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => decide("activation")}>Activate Role</Button>}
      {status === "active" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => decide("pause")}>Pause</Button>}
      {status === "paused" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => decide("resume")}>Resume</Button>}
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => decide("role_review")}>Open Role Review</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => decide("end")}>End Safely</Button>
    </div>
    <p className="ops-field__help">Ending is blocked until open Work, outcomes, responsibilities, and direct reports have been handed off.</p>
    {error && <p className="ops-error" role="alert">{error}</p>}
  </div>;
}

export function AccountabilityControls({ events, canManage }: { events: Array<{ id: string; eventType: string; reason: string; recoveryCommitment: string | null; createdAt: number }>; canManage: boolean }) {
  const router = useRouter(); const [text, setText] = useState<Record<string, string>>({}); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const run = async (id: string, action: () => Promise<Result>) => { setBusy(id); setError(null); const result = await action(); if (!result.ok) setError(result.error); else router.refresh(); setBusy(null); };
  if (!events.length) return <p className="ops-body">No open recovery or accountability items.</p>;
  return <div style={{ display: "grid", gap: 12 }}>{events.map((event) => <div key={event.id} className="ops-alert" data-tone="warning"><p className="ops-alert__title">{event.eventType.replace(/_/g, " ")}</p><p className="ops-body">{event.reason}</p>{event.recoveryCommitment && <p className="ops-body"><strong>Recovery:</strong> {event.recoveryCommitment}</p>}<div className="ops-field" style={{ marginTop: 8 }}><label htmlFor={`recovery-${event.id}`}>Recovery / resolution note</label><input id={`recovery-${event.id}`} value={text[event.id] ?? ""} onChange={(e) => setText((current) => ({ ...current, [event.id]: e.target.value }))} /></div><div style={{ display: "flex", gap: 7, marginTop: 8 }}><Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => run(event.id, () => recordRecoveryCommitment({ eventId: event.id, commitment: text[event.id] ?? "" }))}>Commit Recovery</Button>{canManage && <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => run(`${event.id}-resolve`, () => resolveAccountabilityEvent({ eventId: event.id, reason: text[event.id] ?? "" }))}>Manager Resolve</Button>}</div></div>)}{error && <p className="ops-error" role="alert">{error}</p>}</div>;
}
