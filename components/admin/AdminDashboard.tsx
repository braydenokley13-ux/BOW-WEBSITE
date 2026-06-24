"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminData } from "@/lib/admin";
import { createCohort, updateUserRole, type RoleToggle } from "@/app/actions/lms";
import { createPartnerOrg } from "@/app/actions/partners";
import { PARTNER_ORG_TYPES, partnerTypeLabel } from "@/lib/account";

type Tab = "overview" | "cohorts" | "users" | "content" | "partners";

interface Props {
  adminName: string;
  data: AdminData;
  defaultOrgId: string;
  defaultTrack: string;
}

export default function AdminDashboard({ adminName, data, defaultOrgId, defaultTrack }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("overview");
  const refresh = () => startTransition(() => router.refresh());

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          BOW Administration · {adminName}
        </span>
        <h1 style={{ margin: "8px 0 18px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Platform control.
        </h1>

        <div role="tablist" aria-label="Admin views" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, borderBottom: "1px solid var(--border-rule)" }}>
          {([
            { key: "overview", label: "Overview" },
            { key: "cohorts", label: "Cohorts" },
            { key: "users", label: "Users" },
            { key: "content", label: "Content" },
            { key: "partners", label: "Partners" },
          ] as { key: Tab; label: string }[]).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", padding: "10px 16px", border: "none", borderBottom: `2px solid ${active ? "var(--bow-orange)" : "transparent"}`, background: "transparent", color: active ? "var(--bow-ink)" : "var(--bow-slate)", cursor: "pointer", marginBottom: -1 }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "overview" && <Overview data={data} />}
        {tab === "cohorts" && <Cohorts data={data} defaultOrgId={defaultOrgId} defaultTrack={defaultTrack} refresh={refresh} />}
        {tab === "users" && <Users data={data} refresh={refresh} />}
        {tab === "content" && <Content data={data} />}
        {tab === "partners" && <Partners data={data} refresh={refresh} />}
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "16px 18px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 28, lineHeight: 1, color: "var(--bow-ink)" }}>{value}</div>
      <div style={{ marginTop: 6, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{label}</div>
    </div>
  );
}

const panel: React.CSSProperties = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "20px 22px", marginBottom: 16 };
const panelTitle: React.CSSProperties = { margin: "0 0 14px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" };
const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid var(--border-rule)", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" };

/* ---------------- overview ---------------- */

function Overview({ data }: { data: AdminData }) {
  const o = data.overview;
  const metrics: [string, number][] = [
    ["Students", o.totalStudents],
    ["Instructors", o.totalInstructors],
    ["Cohorts", o.totalCohorts],
    ["Modules completed", o.modulesCompleted],
    ["Quiz responses", o.quizResponses],
    ["Scenario responses", o.scenarioResponses],
    ["Simulations started", o.simulationsStarted],
    ["Simulations completed", o.simulationsCompleted],
    ["Certificates issued", o.certificatesIssued],
    ["Discussion posts", o.discussionPosts],
    ["Weekly completions", o.weeklyCompletions],
    ["Partner pages", o.partnerPages],
    ["Demo requests", o.demoRequests],
    ["Daily answers today", o.dailyAnswersToday],
    ["Glossary terms", o.glossaryTerms],
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
        {metrics.map(([l, v]) => <Metric key={l} label={l} value={v} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 16 }}>
        <section style={panel}>
          <h3 style={panelTitle}>Recently active students</h3>
          {data.health.recentStudents.length === 0 ? <Empty /> : data.health.recentStudents.map((s, i) => (
            <div key={i} style={rowStyle}><span>{s.name}</span><span style={{ color: "var(--bow-slate)", fontFamily: "var(--font-data)", fontSize: 12 }}>{s.when}</span></div>
          ))}
        </section>
        <section style={panel}>
          <h3 style={panelTitle}>Recently completed modules</h3>
          {data.health.recentModules.length === 0 ? <Empty /> : data.health.recentModules.map((m, i) => (
            <div key={i} style={rowStyle}><span style={{ minWidth: 0 }}>{m.name} · <span style={{ color: "var(--bow-slate)" }}>{m.moduleTitle}</span></span><span style={{ color: "var(--bow-slate)", fontFamily: "var(--font-data)", fontSize: 12, flexShrink: 0 }}>{m.when}</span></div>
          ))}
        </section>
        <section style={panel}>
          <h3 style={panelTitle}>Streak leaders</h3>
          {o.streakLeaders.length === 0 ? <Empty /> : o.streakLeaders.map((s, i) => (
            <div key={i} style={rowStyle}><span>{s.name}</span><span style={{ color: "#C9A84C", fontFamily: "var(--font-data)", fontSize: 12 }}>🔥 {s.current}</span></div>
          ))}
        </section>
        <section style={panel}>
          <h3 style={panelTitle}>Recently earned certificates</h3>
          {data.health.recentCertificates.length === 0 ? <Empty /> : data.health.recentCertificates.map((c, i) => (
            <div key={i} style={rowStyle}><span>{c.name}</span><span style={{ color: "var(--bow-slate)", fontFamily: "var(--font-data)", fontSize: 12 }}>{c.when}</span></div>
          ))}
        </section>
      </div>
    </div>
  );
}

function Empty() {
  return <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>Nothing yet.</p>;
}

/* ---------------- cohorts ---------------- */

function Cohorts({ data, defaultOrgId, defaultTrack, refresh }: { data: AdminData; defaultOrgId: string; defaultTrack: string; refresh: () => void }) {
  const [name, setName] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    await createCohort({ name: name.trim(), orgId: defaultOrgId, track: defaultTrack, instructorId: instructorId || null });
    setBusy(false);
    setName("");
    setInstructorId("");
    refresh();
  };

  return (
    <div>
      <section style={panel}>
        <h3 style={panelTitle}>Create cohort</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 200 }}>
            <span style={fieldLabel}>Cohort name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Track 101 — Lincoln" aria-label="Cohort name" style={input} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 200 }}>
            <span style={fieldLabel}>Instructor</span>
            <select value={instructorId} onChange={(e) => setInstructorId(e.target.value)} aria-label="Assign instructor" style={input}>
              <option value="">Unassigned</option>
              {data.instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <button onClick={onCreate} disabled={busy || !name.trim()} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 20px", border: "none", background: busy || !name.trim() ? "var(--bow-inactive)" : "var(--bow-orange)", color: "#fff", borderRadius: 4, cursor: busy || !name.trim() ? "not-allowed" : "pointer" }}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </section>

      <section style={panel}>
        <h3 style={panelTitle}>Cohorts ({data.cohorts.length})</h3>
        {data.cohorts.map((c) => (
          <div key={c.id} style={{ ...rowStyle, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ minWidth: 0 }}>
              <strong>{c.name}</strong>
              <span style={{ color: "var(--bow-slate)" }}> · {c.instructorName}</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{c.studentCount} students</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 80, height: 8, background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 999, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${c.avgModuleCompletionPct}%`, background: "var(--bow-positive)" }} />
                </span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-ink)" }}>{c.avgModuleCompletionPct}%</span>
              </span>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---------------- users ---------------- */

function Users({ data, refresh }: { data: AdminData; refresh: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setRole = async (id: string, role: RoleToggle) => {
    setBusyId(id);
    setError(null);
    const res = await updateUserRole(id, role);
    setBusyId(null);
    if (!res.ok) setError(res.error === "self" ? "You can't change your own role." : res.error === "admin" ? "Admin accounts can't be changed here." : "Couldn't update role.");
    else refresh();
  };

  return (
    <section style={panel}>
      <h3 style={panelTitle}>Users ({data.users.length})</h3>
      {error && <p style={{ margin: "0 0 12px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-warning)" }}>{error}</p>}
      {data.users.map((u) => {
        const locked = u.isSelf || u.role === "admin";
        return (
          <div key={u.id} style={{ ...rowStyle, alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <strong>{u.name}</strong>{u.isSelf ? <span style={{ color: "var(--bow-orange)" }}> · you</span> : null}
              <span style={{ display: "block", fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--bow-slate)" }}>{u.email} · joined {u.createdLabel} · active {u.lastActiveLabel}</span>
            </span>
            {locked ? (
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: u.role === "admin" ? "var(--bow-orange)" : "var(--bow-slate)" }}>{u.role}</span>
            ) : (
              <span style={{ display: "inline-flex", gap: 6 }}>
                {(["student", "instructor"] as RoleToggle[]).map((r) => {
                  const active = u.role === r;
                  return (
                    <button
                      key={r}
                      onClick={() => !active && setRole(u.id, r)}
                      disabled={busyId === u.id || active}
                      style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "7px 12px", border: `1px solid ${active ? "var(--bow-ink)" : "var(--border-rule)"}`, background: active ? "var(--bow-ink)" : "transparent", color: active ? "#fff" : "var(--bow-slate)", borderRadius: 4, cursor: active ? "default" : "pointer" }}
                    >
                      {r}
                    </button>
                  );
                })}
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}

/* ---------------- content ---------------- */

function Content({ data }: { data: AdminData }) {
  const c = data.content;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        <Metric label="BOW Daily scenarios" value={c.scenarioCount} />
        <Metric label="Quiz questions" value={c.quizByModule.reduce((s, m) => s + m.count, 0)} />
      </div>

      <section style={panel}>
        <h3 style={panelTitle}>Quiz questions &amp; responses by module</h3>
        {c.quizByModule.map((m) => {
          const responses = c.quizResponsesByModule.find((r) => r.ordinal === m.ordinal)?.count ?? 0;
          return (
            <div key={m.ordinal} style={rowStyle}>
              <span>M{m.ordinal} · {m.title}</span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{m.count} questions · {responses} responses</span>
            </div>
          );
        })}
      </section>

      <section style={panel}>
        <h3 style={panelTitle}>BOW Daily — responses per scenario</h3>
        {c.responsesPerScenario.map((s) => (
          <div key={s.ordinal} style={rowStyle}>
            <span>#{s.ordinal} · {s.concept}</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{s.count} response{s.count === 1 ? "" : "s"}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ---------------- partners ---------------- */

function Partners({ data, refresh }: { data: AdminData; refresh: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [orgType, setOrgType] = useState(PARTNER_ORG_TYPES[0].key as string);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onCreate = async () => {
    if (busy || !name.trim() || !headline.trim() || !body.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await createPartnerOrg({
      name: name.trim(),
      slug: slug.trim(),
      orgType,
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      customHeadline: headline.trim(),
      customBody: body.trim(),
    });
    setBusy(false);
    if (res.ok) {
      setMsg(`Created /partners/${res.slug}`);
      setName(""); setSlug(""); setContactName(""); setContactEmail(""); setHeadline(""); setBody("");
      refresh();
    } else {
      setMsg(res.error === "slug-taken" ? "That slug is already taken." : "Fill in name, headline, body, and a valid type.");
    }
  };

  return (
    <div>
      <section style={panel}>
        <h3 style={panelTitle}>Create partner page</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={fieldLabel}>Organization name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Frisch School" aria-label="Organization name" style={input} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={fieldLabel}>Slug (optional)</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="frisch" aria-label="Slug" style={input} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={fieldLabel}>Type</span>
            <select value={orgType} onChange={(e) => setOrgType(e.target.value)} aria-label="Organization type" style={input}>
              {PARTNER_ORG_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={fieldLabel}>Contact name</span>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Athletics Office" aria-label="Contact name" style={input} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={fieldLabel}>Contact email</span>
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="partnerships@frisch.org" aria-label="Contact email" style={input} />
          </label>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
          <span style={fieldLabel}>Custom headline</span>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Frisch students, meet the front office." aria-label="Custom headline" style={input} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10 }}>
          <span style={fieldLabel}>Custom body</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="A few sentences about what BOW offers this partner…" aria-label="Custom body" style={{ ...input, resize: "vertical" }} />
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={onCreate} disabled={busy || !name.trim() || !headline.trim() || !body.trim()} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 20px", border: "none", background: busy || !name.trim() || !headline.trim() || !body.trim() ? "var(--bow-inactive)" : "var(--bow-orange)", color: "#fff", borderRadius: 4, cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Creating…" : "Create Page"}
          </button>
          {msg && <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: msg.startsWith("Created") ? "var(--bow-positive)" : "var(--bow-warning)" }}>{msg}</span>}
        </div>
      </section>

      <section style={panel}>
        <h3 style={panelTitle}>Partner pages ({data.partners.orgs.length})</h3>
        {data.partners.orgs.length === 0 ? <Empty /> : data.partners.orgs.map((p) => (
          <div key={p.id} style={{ ...rowStyle, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ minWidth: 0 }}>
              <strong>{p.name}</strong>
              <span style={{ color: "var(--bow-slate)" }}> · {partnerTypeLabel(p.orgType)}</span>
            </span>
            <a href={`/partners/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-blue)", textDecoration: "none" }}>
              /partners/{p.slug} →
            </a>
          </div>
        ))}
      </section>

      <section style={panel}>
        <h3 style={panelTitle}>Demo requests ({data.partners.demoRequests.length})</h3>
        {data.partners.demoRequests.length === 0 ? <Empty /> : data.partners.demoRequests.map((d) => (
          <div key={d.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 4 }}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span><strong>{d.requesterName}</strong> <span style={{ color: "var(--bow-slate)" }}>· {d.requesterEmail}</span></span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", flexShrink: 0 }}>{d.orgSlug} · {d.when}</span>
            </span>
            {d.message && <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>{d.message}</span>}
          </div>
        ))}
      </section>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" };
const input: React.CSSProperties = { fontFamily: "var(--font-interface)", fontSize: 14, padding: "10px 12px", borderRadius: 5, border: "1px solid var(--border-rule)", background: "var(--bow-paper)", color: "var(--bow-ink)", outline: "none" };
