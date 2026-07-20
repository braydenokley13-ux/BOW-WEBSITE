"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Modal } from "@/components/ds";
import { useAppState } from "@/components/app/AppState";
import type { Cohort } from "@/lib/account";
import type { NewOrganizationInput } from "@/app/actions/lms";

type BadgeStatus = "positive" | "warning" | "negative" | "info" | "neutral" | "locked";

const cohortStatusLabel: Record<Cohort["status"], string> = {
  active: "Active",
  enrolling: "Enrollment Open",
  completed: "Completed",
  draft: "Draft",
};

const cohortStatusBadge: Record<Cohort["status"], BadgeStatus> = {
  active: "positive",
  enrolling: "info",
  completed: "neutral",
  draft: "warning",
};

const ORG_TYPES: NewOrganizationInput["type"][] = ["School", "Camp", "Youth Organization"];

export default function AdminOrganizationsPage() {
  const router = useRouter();
  const { data, getOrg, selectedOrganizationId, setSelectedOrganizationId, createOrganization } = useAppState();

  const [createOpen, setCreateOpen] = useState(false);
  const [coName, setCoName] = useState("");
  const [coType, setCoType] = useState<NewOrganizationInput["type"]>("School");
  const [coLocation, setCoLocation] = useState("");

  const orgCards = data.organizations.map((o) => {
    const ocoh = data.cohorts.filter((c) => c.orgId === o.id);
    const activeCohorts = ocoh.filter((c) => c.status === "active").length;
    const instructors = new Set(ocoh.map((c) => c.instructorId).filter(Boolean)).size;
    const students = data.enrollments.filter((e) => ocoh.some((c) => c.id === e.cohortId) && (e.enroll === "active" || e.enroll === "suspended")).length;
    return { ...o, activeCohorts, instructors, students };
  });

  const selectedOrg = selectedOrganizationId ? getOrg(selectedOrganizationId) : null;
  const selectedCohorts = selectedOrganizationId ? data.cohorts.filter((c) => c.orgId === selectedOrganizationId) : [];
  const selectedStudents = selectedOrganizationId
    ? data.enrollments.filter((e) => selectedCohorts.some((c) => c.id === e.cohortId) && e.enroll !== "invited" && e.enroll !== "inactive").length
    : 0;

  async function submitCreate() {
    if (!coName.trim()) return;
    (await createOrganization({ name: coName.trim(), type: coType, location: coLocation.trim() }));
    setCreateOpen(false);
    setCoName("");
    setCoType("School");
    setCoLocation("");
  }

  return (
    <main className="ops-page">
      <header className="ops-hero">
        <div className="ops-hero__copy">
          <span className="ops-eyebrow">Programs run with</span>
          <h1 className="ops-title">Organizations</h1>
        </div>
        <div className="ops-actions">
          <Button onClick={() => setCreateOpen(true)} variant="ink">Create Organization</Button>
        </div>
      </header>

      {orgCards.length === 0 ? (
        <div className="ops-empty">
          <h2 className="ops-empty__title">No Organizations yet.</h2>
          <p className="ops-empty__body">Create the first partner organization to start scheduling cohorts against it.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {orgCards.map((o) => (
            <button type="button" key={o.id} onClick={() => setSelectedOrganizationId(o.id)} className="ops-panel" style={{ width: "100%", textAlign: "left", cursor: "pointer", color: "inherit" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", lineHeight: 1.05 }}>{o.name}</span>
                <span className="ops-label" style={{ whiteSpace: "nowrap" }}>{o.type}</span>
              </div>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>{o.location}</span>
              <div style={{ display: "flex", gap: 18, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-rule)" }}>
                <div><span style={{ fontFamily: "var(--font-data)", fontSize: 18, color: "var(--bow-ink)", display: "block" }}>{o.activeCohorts}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Active</span></div>
                <div><span style={{ fontFamily: "var(--font-data)", fontSize: 18, color: "var(--bow-ink)", display: "block" }}>{o.instructors}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Instructors</span></div>
                <div><span style={{ fontFamily: "var(--font-data)", fontSize: 18, color: "var(--bow-ink)", display: "block" }}>{o.students}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Students</span></div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* org detail panel */}
      <Modal open={Boolean(selectedOrg)} onClose={() => setSelectedOrganizationId(null)} title={selectedOrg?.name ?? "Organization details"} maxWidth={560}>
        {selectedOrg && (
          <>
            <span className="ops-record-meta">{selectedOrg.type} · {selectedOrg.location} · {selectedStudents} students</span>
            <span className="ops-label" style={{ display: "block", margin: "22px 0 10px" }}>Cohorts</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
              {selectedCohorts.length === 0 && <span className="ops-body">No cohorts yet.</span>}
              {selectedCohorts.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: "1px solid var(--border-rule)", borderRadius: 5 }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)" }}>{c.name}</span>
                    <span className="ops-record-meta">{`Track ${c.track}`}</span>
                  </div>
                  <Badge status={cohortStatusBadge[c.status]}>{cohortStatusLabel[c.status]}</Badge>
                </div>
              ))}
            </div>
            <Button onClick={() => router.push("/app/admin/cohorts")} variant="primary" full>Manage Cohorts</Button>
          </>
        )}
      </Modal>

      {/* create organization */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Organization" maxWidth={520}>
            <div className="ops-field" style={{ marginBottom: 16 }}>
              <label htmlFor="new-organization-name">Organization name</label>
              <input id="new-organization-name" value={coName} onChange={(e) => setCoName(e.target.value)} placeholder="e.g. Westview School District" />
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
              <legend className="ops-field__label">Type</legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
              {ORG_TYPES.map((t) => {
                const sel = coType === t;
                return (
                  <button type="button" aria-pressed={sel} key={t} onClick={() => setCoType(t)} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, padding: "9px 14px", borderRadius: 4, cursor: "pointer", background: sel ? "var(--bow-blue)" : "var(--bow-white)", color: sel ? "#fff" : "var(--bow-ink)", border: `1px solid ${sel ? "var(--bow-blue)" : "var(--border-rule)"}` }}>{t}</button>
                );
              })}
              </div>
            </fieldset>

            <div className="ops-field">
              <label htmlFor="new-organization-location">Location</label>
              <input id="new-organization-location" value={coLocation} onChange={(e) => setCoLocation(e.target.value)} placeholder="City, State" />
            </div>

            <div className="ops-form-footer" style={{ border: 0, paddingTop: 20 }}>
              <Button onClick={submitCreate} disabled={!coName.trim()} variant="primary" full>Create Organization</Button>
            </div>
      </Modal>
    </main>
  );
}
