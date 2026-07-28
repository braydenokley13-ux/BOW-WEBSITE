"use client";

import { useActionState } from "react";
import {
  submitFamilyRequest,
  withdrawRegistration,
  inviteGuardian,
  revokeGuardian,
  type ActionState,
} from "@/app/actions/family-portal";
import type { ChildRegistration, GuardianRow } from "@/lib/family-portal";

export default function ChildSelfService({
  studentId,
  studentName,
  registrations,
  guardians,
}: {
  studentId: string;
  studentName: string;
  registrations: ChildRegistration[];
  guardians: GuardianRow[];
}) {
  return (
    <section style={{ background: "#fff", border: "1px solid #e4e2dc", borderRadius: 10, padding: "18px 20px" }}>
      <h2 style={{ margin: "0 0 14px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>{studentName}</h2>

      {registrations.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h3 style={sub}>Active programs</h3>
          {registrations.map((reg) => (
            <RegistrationActions key={reg.registrationId} registration={reg} studentId={studentId} />
          ))}
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <h3 style={sub}>Guardians &amp; access</h3>
        <ul style={{ listStyle: "none", margin: "0 0 10px", padding: 0 }}>
          {guardians.map((g) => (
            <li key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 14 }}>
              <span>
                {g.name ?? g.email} {g.isPrimary ? "(primary)" : ""} — <em>{g.status}</em>
              </span>
              {g.status === "active" && !g.isPrimary && <RevokeButton studentId={studentId} linkId={g.id} />}
            </li>
          ))}
        </ul>
        <InviteGuardianForm studentId={studentId} />
      </div>

      <div>
        <h3 style={sub}>Other requests</h3>
        <FamilyRequestForm studentId={studentId} registrationId={registrations[0]?.registrationId ?? null} />
      </div>
    </section>
  );
}

function RegistrationActions({ registration, studentId }: { registration: ChildRegistration; studentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(withdrawRegistration, {});
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eee", fontSize: 14 }}>
      <span>{registration.programName} — {registration.statusLabel}</span>
      {state.status === "success" ? (
        <span style={{ fontSize: 13, color: "var(--bow-slate, #55585f)" }}>Withdrawn</span>
      ) : (
        <form action={action}>
          <input type="hidden" name="registrationId" value={registration.registrationId} />
          <input type="hidden" name="studentId" value={studentId} />
          <button type="submit" disabled={pending} style={ghostBtn}>
            {pending ? "Withdrawing…" : "Withdraw"}
          </button>
        </form>
      )}
      {state.status === "error" && <span role="alert" style={{ fontSize: 12, color: "#8a3820" }}>{state.message}</span>}
    </div>
  );
}

function RevokeButton({ studentId, linkId }: { studentId: string; linkId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(revokeGuardian, {});
  if (state.status === "success") return <span style={{ fontSize: 12 }}>Revoked</span>;
  return (
    <form action={action}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="linkId" value={linkId} />
      <button type="submit" disabled={pending} style={ghostBtn}>
        {pending ? "Removing…" : "Revoke access"}
      </button>
      {state.status === "error" && <span role="alert" style={{ fontSize: 12, color: "#8a3820", marginLeft: 8 }}>{state.message}</span>}
    </form>
  );
}

function InviteGuardianForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteGuardian, {});
  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="studentId" value={studentId} />
      <label style={{ fontSize: 13 }}>
        Add a guardian:
        <input type="email" name="email" required placeholder="email@example.com" style={{ ...smallInput, marginLeft: 6 }} />
      </label>
      <input type="text" name="relationship" placeholder="Relationship (optional)" maxLength={80} style={smallInput} />
      <button type="submit" disabled={pending} style={primaryBtnSm}>
        {pending ? "Inviting…" : "Invite"}
      </button>
      {state.status && <span role={state.status === "error" ? "alert" : "status"} style={{ fontSize: 12, color: state.status === "error" ? "#8a3820" : "#2c6b2c" }}>{state.message}</span>}
    </form>
  );
}

const REQUEST_KINDS: { value: string; label: string }[] = [
  { value: "schedule_change", label: "Request a schedule change" },
  { value: "transfer", label: "Request a program transfer" },
  { value: "absence_notice", label: "Report an upcoming absence" },
  { value: "info_update", label: "Update contact or student info" },
];

function FamilyRequestForm({ studentId, registrationId }: { studentId: string; registrationId: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitFamilyRequest, {});
  if (state.status === "success") return <p style={{ fontSize: 13 }}>{state.message}</p>;
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
      <input type="hidden" name="studentId" value={studentId} />
      {registrationId && <input type="hidden" name="registrationId" value={registrationId} />}
      <select name="kind" required style={smallInput} defaultValue="">
        <option value="" disabled>Type of request…</option>
        {REQUEST_KINDS.map((k) => (
          <option key={k.value} value={k.value}>{k.label}</option>
        ))}
      </select>
      <textarea name="detail" required maxLength={2000} rows={3} placeholder="Tell us what you need" style={{ ...smallInput, resize: "vertical" }} />
      <button type="submit" disabled={pending} style={{ ...primaryBtnSm, alignSelf: "flex-start" }}>
        {pending ? "Submitting…" : "Submit request"}
      </button>
      {state.status === "error" && <span role="alert" style={{ fontSize: 12, color: "#8a3820" }}>{state.message}</span>}
    </form>
  );
}

const sub: React.CSSProperties = { margin: "0 0 8px", fontFamily: "var(--font-interface)", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--bow-slate, #6b6e75)" };
const ghostBtn: React.CSSProperties = { fontSize: 13, padding: "6px 12px", border: "1px solid #c7c9cf", borderRadius: 6, background: "#fff", cursor: "pointer", minHeight: 36 };
const primaryBtnSm: React.CSSProperties = { fontSize: 13, padding: "8px 14px", border: "none", borderRadius: 6, background: "var(--bow-orange, #d4531f)", color: "#fff", fontWeight: 700, cursor: "pointer", minHeight: 38 };
const smallInput: React.CSSProperties = { padding: "8px 10px", fontSize: 14, border: "1px solid #cfd1d6", borderRadius: 6, fontFamily: "var(--font-interface)" };
