"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ds";
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

const label: CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 };
const input: CSSProperties = { width: "100%", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: 12, borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14 };

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

  function submitCreate() {
    if (!coName.trim()) return;
    createOrganization({ name: coName.trim(), type: coType, location: coLocation.trim() });
    setCreateOpen(false);
    setCoName("");
    setCoType("School");
    setCoLocation("");
  }

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Programs run with</span>
            <h1 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4vw,46px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>Organizations</h1>
          </div>
          <button onClick={() => setCreateOpen(true)} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", border: "none", background: "var(--bow-ink)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Create Organization</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {orgCards.map((o) => (
            <div key={o.id} onClick={() => setSelectedOrganizationId(o.id)} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 20, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", lineHeight: 1.05 }}>{o.name}</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", whiteSpace: "nowrap" }}>{o.type}</span>
              </div>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>{o.location}</span>
              <div style={{ display: "flex", gap: 18, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-rule)" }}>
                <div><span style={{ fontFamily: "var(--font-data)", fontSize: 18, color: "var(--bow-ink)", display: "block" }}>{o.activeCohorts}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Active</span></div>
                <div><span style={{ fontFamily: "var(--font-data)", fontSize: 18, color: "var(--bow-ink)", display: "block" }}>{o.instructors}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Instructors</span></div>
                <div><span style={{ fontFamily: "var(--font-data)", fontSize: 18, color: "var(--bow-ink)", display: "block" }}>{o.students}</span><span style={{ fontFamily: "var(--font-data)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Students</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* org detail panel */}
      {selectedOrg && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 4500, background: "rgba(10,10,11,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }} onClick={() => setSelectedOrganizationId(null)}>
          <div style={{ background: "var(--bow-white)", maxWidth: 560, width: "100%", borderRadius: 6, borderTop: "4px solid var(--bow-blue)", padding: 28 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 28, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)", lineHeight: 1 }}>{selectedOrg.name}</h2>
              <span onClick={() => setSelectedOrganizationId(null)} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)", cursor: "pointer" }}>Close ✕</span>
            </div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{selectedOrg.type} · {selectedOrg.location} · {selectedStudents} students</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", margin: "22px 0 10px" }}>Cohorts</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
              {selectedCohorts.length === 0 && <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>No cohorts yet.</span>}
              {selectedCohorts.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: "1px solid var(--border-rule)", borderRadius: 5 }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)" }}>{c.name}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", display: "block" }}>{`Track ${c.track}`}</span>
                  </div>
                  <Badge status={cohortStatusBadge[c.status]}>{cohortStatusLabel[c.status]}</Badge>
                </div>
              ))}
            </div>
            <button onClick={() => router.push("/app/admin/cohorts")} style={{ width: "100%", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: 13, border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>Manage Cohorts</button>
          </div>
        </div>
      )}

      {/* create organization */}
      {createOpen && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 4500, background: "rgba(10,10,11,0.62)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 18px", overflowY: "auto" }} onClick={() => setCreateOpen(false)}>
          <div style={{ background: "var(--bow-white)", maxWidth: 520, width: "100%", borderRadius: 6, borderTop: "4px solid var(--bow-blue)", padding: "clamp(22px,3vw,32px)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>Create Organization</span>
              <span onClick={() => setCreateOpen(false)} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)", cursor: "pointer" }}>Cancel ✕</span>
            </div>

            <label style={label}>Organization name</label>
            <input value={coName} onChange={(e) => setCoName(e.target.value)} placeholder="e.g. Westview School District" style={{ ...input, marginBottom: 16 }} />

            <label style={label}>Type</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {ORG_TYPES.map((t) => {
                const sel = coType === t;
                return (
                  <button key={t} onClick={() => setCoType(t)} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13, padding: "9px 14px", borderRadius: 4, cursor: "pointer", background: sel ? "var(--bow-blue)" : "var(--bow-white)", color: sel ? "#fff" : "var(--bow-ink)", border: `1px solid ${sel ? "var(--bow-blue)" : "var(--border-rule)"}` }}>{t}</button>
                );
              })}
            </div>

            <label style={label}>Location</label>
            <input value={coLocation} onChange={(e) => setCoLocation(e.target.value)} placeholder="City, State" style={input} />

            <button onClick={submitCreate} disabled={!coName.trim()} style={{ width: "100%", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: 14, border: "none", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: coName.trim() ? "pointer" : "not-allowed", opacity: coName.trim() ? 1 : 0.55, marginTop: 20 }}>Create Organization</button>
          </div>
        </div>
      )}
    </div>
  );
}
