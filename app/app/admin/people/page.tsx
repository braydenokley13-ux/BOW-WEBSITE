"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ds";
import { useAppState } from "@/components/app/AppState";
import { type Role, type UserStatus } from "@/lib/account";

type Filter = "students" | "instructors" | "admins";
type BadgeStatus = "positive" | "warning" | "negative" | "info" | "neutral" | "locked";

const statusLabel: Record<UserStatus, string> = {
  active: "Active",
  invited: "Invited",
  suspended: "Suspended",
};

const statusBadge: Record<UserStatus, BadgeStatus> = {
  active: "positive",
  invited: "warning",
  suspended: "negative",
};

const filterToRole: Record<Filter, Role> = {
  students: "student",
  instructors: "instructor",
  admins: "admin",
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

export default function AdminPeoplePage() {
  const { data, me, getOrg, getCohort, cohortsForInstructor, userStatusOf, suspendUser, restoreUser, dismissDeletionRequest, fulfillDeletionRequest, askConfirm } = useAppState();
  const [filter, setFilter] = useState<Filter>("students");

  const deletionSet = new Set(data.deletionRequests);

  function cohortName(userId: string): string {
    const enr = data.enrollments.find((e) => e.userId === userId && e.enroll !== "inactive");
    if (enr) return getCohort(enr.cohortId)?.name ?? "—";
    const taught = cohortsForInstructor(userId);
    return taught[0]?.name ?? "—";
  }

  const people = data.users.filter((u) => u.role === filterToRole[filter]);
  const tabs: Filter[] = ["students", "instructors", "admins"];
  const tabLabel: Record<Filter, string> = { students: "Students", instructors: "Instructors", admins: "Admins" };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Everyone in the BOW system</span>
        <h1 style={{ margin: "8px 0 22px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>People</h1>

        <div style={{ display: "inline-flex", border: "1px solid var(--border-rule)", borderRadius: 5, overflow: "hidden", marginBottom: 22 }}>
          {tabs.map((t, i) => {
            const active = filter === t;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 18px", border: "none", borderLeft: i === 0 ? "none" : "1px solid var(--border-rule)", cursor: "pointer", background: active ? "var(--bow-ink)" : "var(--bow-white)", color: active ? "#fff" : "var(--bow-slate)" }}
              >
                {tabLabel[t]}
              </button>
            );
          })}
        </div>

        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-rule)" }}>
                <th style={{ ...th, padding: "12px 16px" }}>Name</th>
                <th style={th}>Organization</th>
                <th style={th}>Cohort</th>
                <th style={th}>Status</th>
                <th style={{ ...th, padding: "12px 16px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {people.map((u) => {
                const status = userStatusOf(u);
                const isActive = status === "active";
                const isSuspended = status === "suspended";
                const isInvited = status === "invited";
                const wantsDeletion = deletionSet.has(u.id);
                const deletionFulfilled = u.email.endsWith("@deleted.invalid");
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border-rule)" }}>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)" }}>{u.name}</span>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block" }}>{u.email}</span>
                      {wantsDeletion && <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-negative)", display: "block", marginTop: 3 }}>⚠ Requested account deletion</span>}
                    </td>
                    <td style={{ padding: "13px 8px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-ink)" }}>{getOrg(u.orgId)?.name ?? "—"}</td>
                    <td style={{ padding: "13px 8px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>{cohortName(u.id)}</td>
                    <td style={{ padding: "13px 8px" }}><Badge status={statusBadge[status]}>{statusLabel[status]}</Badge></td>
                    <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {wantsDeletion && (
                        <>
                          <button
                            onClick={async () => (await dismissDeletionRequest(u.id))}
                            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", padding: "7px 13px", border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-slate)", borderRadius: 4, cursor: "pointer", marginRight: 6 }}
                          >
                            Dismiss
                          </button>
                          <button
                            disabled={u.id === me.id}
                            title={u.id === me.id ? "Another administrator must fulfill your deletion request." : undefined}
                            onClick={() => askConfirm({
                              title: `Permanently anonymize ${u.name}?`,
                              body: "This fulfills the deletion request and cannot be undone. Sign-in credentials, sessions, personal account identity, canonical contact details, pending invitations, profile sharing, and current enrollments will be removed or deactivated. BOW will keep stable anonymized IDs plus historical attendance, completed learning, certificates, rosters, session reports, and audit records so delivery evidence and referential integrity remain intact.",
                              confirmLabel: "Fulfill Deletion",
                              tone: "negative",
                              onConfirm: async () => (await fulfillDeletionRequest(u.id)),
                            })}
                            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", padding: "7px 13px", border: "1px solid var(--bow-negative)", background: "var(--bow-negative)", color: "#fff", borderRadius: 4, cursor: u.id === me.id ? "not-allowed" : "pointer", opacity: u.id === me.id ? 0.45 : 1, marginRight: 6 }}
                          >
                            Fulfill Deletion
                          </button>
                        </>
                      )}
                      {isActive && (
                        <button
                          onClick={() => askConfirm({ title: `Suspend ${u.name}?`, body: "They will lose access immediately until restored. This is a privileged action and is logged.", confirmLabel: "Suspend Access", tone: "negative", onConfirm: async () => (await suspendUser(u.id)) })}
                          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", padding: "7px 13px", border: "1px solid var(--bow-negative)", background: "transparent", color: "var(--bow-negative)", borderRadius: 4, cursor: "pointer" }}
                        >
                          Suspend
                        </button>
                      )}
                      {isSuspended && !deletionFulfilled && (
                        <button
                          onClick={() => askConfirm({ title: `Restore access for ${u.name}?`, body: "They will regain access right away.", confirmLabel: "Restore Access", tone: "info", onConfirm: async () => (await restoreUser(u.id)) })}
                          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", padding: "7px 13px", border: "1px solid var(--bow-positive)", background: "transparent", color: "var(--bow-positive)", borderRadius: 4, cursor: "pointer" }}
                        >
                          Restore
                        </button>
                      )}
                      {deletionFulfilled && (
                        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                          Deletion fulfilled
                        </span>
                      )}
                      {isInvited && !wantsDeletion && <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>Awaiting acceptance</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
