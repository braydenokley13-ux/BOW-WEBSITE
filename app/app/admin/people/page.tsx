"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Badge, Button } from "@/components/ds";
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
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Everyone in the BOW system</span>
          <h1 className="ops-title">People</h1>
        </div>
      </header>

      <nav className="ops-filters" aria-label="People filters">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className="ops-filter"
            aria-current={filter === t ? "page" : undefined}
            style={{ background: "transparent", border: 0, cursor: "pointer" }}
          >
            {tabLabel[t]}
          </button>
        ))}
      </nav>

      <div className="ops-panel" style={{ padding: 0, overflowX: "auto" }}>
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
                <tr key={u.id}>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)" }}>{u.name}</span>
                    <span className="ops-record-meta" style={{ display: "block" }}>{u.email}</span>
                    {wantsDeletion && <span className="ops-label" style={{ display: "block", marginTop: 3, color: "var(--bow-negative)" }}>⚠ Requested account deletion</span>}
                  </td>
                  <td style={{ padding: "13px 8px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-ink)" }}>{getOrg(u.orgId)?.name ?? "—"}</td>
                  <td style={{ padding: "13px 8px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>{cohortName(u.id)}</td>
                  <td style={{ padding: "13px 8px" }}><Badge status={statusBadge[status]}>{statusLabel[status]}</Badge></td>
                  <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      {wantsDeletion && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => dismissDeletionRequest(u.id)}>Dismiss</Button>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={u.id === me.id}
                            style={{ background: "var(--bow-negative)", borderColor: "var(--bow-negative)" }}
                            aria-label={u.id === me.id ? "Another administrator must fulfill your deletion request." : `Fulfill deletion for ${u.name}`}
                            onClick={() => askConfirm({
                              title: `Permanently anonymize ${u.name}?`,
                              body: "This fulfills the deletion request and cannot be undone. Sign-in credentials, sessions, personal account identity, canonical contact details, pending invitations, profile sharing, and current enrollments will be removed or deactivated. BOW will keep stable anonymized IDs plus historical attendance, completed learning, certificates, rosters, session reports, and audit records so delivery evidence and referential integrity remain intact.",
                              confirmLabel: "Fulfill Deletion",
                              tone: "negative",
                              onConfirm: async () => (await fulfillDeletionRequest(u.id)),
                            })}
                          >
                            Fulfill Deletion
                          </Button>
                        </>
                      )}
                      {isActive && (
                        <Button
                          size="sm"
                          variant="secondary"
                          style={{ color: "var(--bow-negative)", borderColor: "var(--bow-negative)" }}
                          onClick={() => askConfirm({ title: `Suspend ${u.name}?`, body: "They will lose access immediately until restored. This is a privileged action and is logged.", confirmLabel: "Suspend Access", tone: "negative", onConfirm: async () => { await suspendUser(u.id); } })}
                        >
                          Suspend
                        </Button>
                      )}
                      {isSuspended && !deletionFulfilled && (
                        <Button
                          size="sm"
                          variant="secondary"
                          style={{ color: "var(--bow-positive)", borderColor: "var(--bow-positive)" }}
                          onClick={() => askConfirm({ title: `Restore access for ${u.name}?`, body: "They will regain access right away.", confirmLabel: "Restore Access", tone: "info", onConfirm: async () => { await restoreUser(u.id); } })}
                        >
                          Restore
                        </Button>
                      )}
                      {deletionFulfilled && <span className="ops-label">Deletion fulfilled</span>}
                      {isInvited && !wantsDeletion && <span className="ops-record-meta">Awaiting acceptance</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
