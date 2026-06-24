"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminContentMgmt } from "@/lib/admin";
import type { DailyQuestionAdminRow, NewsItem, NewsSubmission, Testimonial } from "@/lib/content";
import type { GlossaryTerm } from "@/lib/glossary";
import {
  upsertDailyQuestion, setDailyQuestionsActive, deleteDailyQuestions, bulkImportQuestions,
  createNewsItem, setNewsItemActive, approveNewsSubmission, rejectNewsSubmission,
  createTestimonial, updateTestimonial,
  createGlossaryTerm, updateGlossaryTerm,
} from "@/app/actions/content";

/* ---------------- shared styles ---------------- */
const panel: React.CSSProperties = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "20px 22px", marginBottom: 16 };
const title: React.CSSProperties = { margin: "0 0 14px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border-rule)", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)", alignItems: "center", flexWrap: "wrap" };
const fieldLabel: React.CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" };
const input: React.CSSProperties = { fontFamily: "var(--font-interface)", fontSize: 14, padding: "9px 11px", borderRadius: 5, border: "1px solid var(--border-rule)", background: "var(--bow-paper)", color: "var(--bow-ink)", outline: "none", width: "100%" };
const primaryBtn = (disabled: boolean): React.CSSProperties => ({ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "9px 16px", border: "none", background: disabled ? "var(--bow-inactive)" : "var(--bow-orange)", color: "#fff", borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer" });
const smallBtn: React.CSSProperties = { fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "6px 12px", border: "1px solid var(--border-rule)", background: "transparent", color: "var(--bow-ink)", borderRadius: 4, cursor: "pointer" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 5 }}><span style={fieldLabel}>{label}</span>{children}</label>;
}

type Sub = "daily" | "news" | "testimonials" | "glossary";

export default function ContentManager({ data }: { data: AdminContentMgmt }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const [sub, setSub] = useState<Sub>("daily");

  return (
    <div>
      <div role="tablist" aria-label="Content managers" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {([["daily", "Daily Questions"], ["news", "News Items"], ["testimonials", "Testimonials"], ["glossary", "Glossary"]] as [Sub, string][]).map(([k, l]) => {
          const active = sub === k;
          return (
            <button key={k} role="tab" aria-selected={active} onClick={() => setSub(k)}
              style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", padding: "8px 14px", borderRadius: 999, border: `1px solid ${active ? "var(--bow-ink)" : "var(--border-rule)"}`, background: active ? "var(--bow-ink)" : "transparent", color: active ? "#fff" : "var(--bow-slate)", cursor: "pointer" }}>
              {l}
            </button>
          );
        })}
      </div>

      {sub === "daily" && <DailyManager rows={data.dailyQuestions} refresh={refresh} />}
      {sub === "news" && <NewsManager items={data.newsItems} submissions={data.newsSubmissions} refresh={refresh} />}
      {sub === "testimonials" && <TestimonialManager items={data.testimonials} refresh={refresh} />}
      {sub === "glossary" && <GlossaryManager terms={data.glossary} refresh={refresh} />}
    </div>
  );
}

/* ============================================================ Daily Questions */

const DEFAULT_POINTS: Record<number, number> = { 1: 10, 2: 20, 3: 35 };
const TIER_LABEL: Record<number, string> = { 1: "Rookie", 2: "Pro", 3: "Executive" };
const TYPE_LABEL: Record<string, string> = { mc: "MC", math: "Math", fr: "FR" };
type DailyForm = {
  questionText: string; type: string; choiceA: string; choiceB: string; choiceC: string; choiceD: string;
  correctAnswer: string; explanation: string; conceptTag: string; difficulty: number; track: string; points: number; active: boolean; activeDate: string;
};
const emptyDaily: DailyForm = { questionText: "", type: "mc", choiceA: "", choiceB: "", choiceC: "", choiceD: "", correctAnswer: "A", explanation: "", conceptTag: "", difficulty: 1, track: "101", points: 10, active: true, activeDate: "" };

const IMPORT_PLACEHOLDER = `[
  {
    "questionText": "What is a salary cap?",
    "type": "mc",
    "options": ["A tax", "A spending limit", "A bonus", "A draft pick"],
    "correctAnswer": "B",
    "explanation": "A salary cap limits total player payroll.",
    "conceptTag": "salary_cap",
    "track": "101",
    "difficulty": "rookie"
  }
]`;

function DailyManager({ rows, refresh }: { rows: DailyQuestionAdminRow[]; refresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DailyForm>({ ...emptyDaily });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [filterTrack, setFilterTrack] = useState("all");
  const [filterDiff, setFilterDiff] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = rows.filter(
    (r) => (filterTrack === "all" || r.track === filterTrack) && (filterDiff === "all" || String(r.difficulty) === filterDiff),
  );
  const filteredIds = filtered.map((r) => r.id);

  const startCreate = () => { setEditingId("new"); setForm({ ...emptyDaily }); setMsg(null); };
  const startEdit = (r: DailyQuestionAdminRow) => {
    setEditingId(r.id);
    setForm({
      questionText: r.questionText, type: r.type, choiceA: r.choiceA, choiceB: r.choiceB, choiceC: r.choiceC, choiceD: r.choiceD,
      correctAnswer: r.correctAnswer || (r.type === "mc" ? "A" : ""), explanation: r.explanation, conceptTag: r.conceptTag,
      difficulty: r.difficulty, track: r.track, points: r.points, active: r.active, activeDate: r.activeDate ?? "",
    });
    setMsg(null);
  };

  const setDifficulty = (d: number) => setForm((f) => ({ ...f, difficulty: d, points: DEFAULT_POINTS[d] ?? f.points }));
  const setType = (t: string) => setForm((f) => ({ ...f, type: t, correctAnswer: t === "mc" ? (["A", "B", "C", "D"].includes(f.correctAnswer) ? f.correctAnswer : "A") : (["A", "B", "C", "D"].includes(f.correctAnswer) ? "" : f.correctAnswer) }));

  const save = async () => {
    // Client-side guard mirrors the server so the admin gets fast feedback.
    if (!form.questionText.trim() || !form.explanation.trim() || !form.conceptTag.trim()) { setMsg("Question, explanation, and concept are required."); return; }
    if (form.type === "mc" && (!form.choiceA.trim() || !form.choiceB.trim() || !form.choiceC.trim() || !form.choiceD.trim() || !["A", "B", "C", "D"].includes(form.correctAnswer))) { setMsg("MC questions need all four choices and a correct answer (A–D)."); return; }
    if (form.type !== "mc" && !form.correctAnswer.trim()) { setMsg("Enter the expected answer."); return; }
    setBusy(true); setMsg(null);
    const payload = { ...form, difficulty: Number(form.difficulty), points: Number(form.points), activeDate: form.activeDate || null };
    const res = await upsertDailyQuestion(editingId === "new" ? null : editingId, payload);
    setBusy(false);
    if (res.ok) { setEditingId(null); refresh(); } else setMsg("Could not save — check the required fields for this question type.");
  };

  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const bulkActive = async (active: boolean) => {
    if (filteredIds.length === 0) return;
    setBusy(true);
    await setDailyQuestionsActive(filteredIds, active);
    setBusy(false); refresh();
  };
  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} question(s)? This also removes their student responses and cannot be undone.`)) return;
    setBusy(true);
    await deleteDailyQuestions([...selected]);
    setBusy(false); setSelected(new Set()); refresh();
  };

  return (
    <div>
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ ...title, margin: 0 }}>Daily Questions ({filtered.length}{filtered.length !== rows.length ? ` of ${rows.length}` : ""})</h3>
          <button onClick={startCreate} style={primaryBtn(false)}>+ Create Question</button>
        </div>

        {/* Filters + bulk actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 14 }}>
          <Field label="Track"><select style={input} value={filterTrack} onChange={(e) => setFilterTrack(e.target.value)}><option value="all">All</option><option value="101">101</option><option value="201">201</option></select></Field>
          <Field label="Difficulty"><select style={input} value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}><option value="all">All</option><option value="1">Rookie</option><option value="2">Pro</option><option value="3">Executive</option></select></Field>
          <button onClick={() => bulkActive(true)} disabled={busy || filteredIds.length === 0} style={smallBtn}>Activate All Filtered</button>
          <button onClick={() => bulkActive(false)} disabled={busy || filteredIds.length === 0} style={smallBtn}>Deactivate All Filtered</button>
          <button onClick={deleteSelected} disabled={busy || selected.size === 0} style={{ ...smallBtn, borderColor: "var(--bow-negative)", color: "var(--bow-negative)" }}>Delete Selected ({selected.size})</button>
        </div>

        {editingId && (
          <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--border-rule)", borderRadius: 6, background: "var(--bow-paper)", display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Question"><textarea rows={2} style={{ ...input, resize: "vertical" }} value={form.questionText} onChange={(e) => setForm({ ...form, questionText: e.target.value })} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
              <Field label="Type"><select style={input} value={form.type} onChange={(e) => setType(e.target.value)}>{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Track"><select style={input} value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })}><option value="101">101</option><option value="201">201</option></select></Field>
              <Field label="Difficulty"><select style={input} value={form.difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>{[1, 2, 3].map((d) => <option key={d} value={d}>{TIER_LABEL[d]}</option>)}</select></Field>
              <Field label="Points"><input type="number" style={input} value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} /></Field>
            </div>
            {form.type === "mc" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                  {(["A", "B", "C", "D"] as const).map((L) => (
                    <Field key={L} label={`Choice ${L}`}><input style={input} value={form[`choice${L}` as "choiceA"]} onChange={(e) => setForm({ ...form, [`choice${L}`]: e.target.value })} /></Field>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                  <Field label="Correct answer"><select style={input} value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}>{["A", "B", "C", "D"].map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <Field label="Concept tag"><input style={input} value={form.conceptTag} onChange={(e) => setForm({ ...form, conceptTag: e.target.value })} placeholder="opportunity_cost" /></Field>
                  <Field label="Active date (optional)"><input style={input} type="date" value={form.activeDate} onChange={(e) => setForm({ ...form, activeDate: e.target.value })} /></Field>
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
                <Field label={form.type === "math" ? "Correct answer (number)" : "Correct answer (text)"}><input style={input} value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} placeholder={form.type === "math" ? "7.5" : "expected answer"} /></Field>
                <Field label="Concept tag"><input style={input} value={form.conceptTag} onChange={(e) => setForm({ ...form, conceptTag: e.target.value })} placeholder="luxury_tax" /></Field>
                <Field label="Active date (optional)"><input style={input} type="date" value={form.activeDate} onChange={(e) => setForm({ ...form, activeDate: e.target.value })} /></Field>
              </div>
            )}
            <Field label="Explanation"><textarea rows={2} style={{ ...input, resize: "vertical" }} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} /></Field>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={save} disabled={busy} style={primaryBtn(busy)}>{busy ? "Saving…" : editingId === "new" ? "Create" : "Save"}</button>
              <button onClick={() => setEditingId(null)} style={smallBtn}>Cancel</button>
              {msg && <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--bow-warning)" }}>{msg}</span>}
            </div>
          </div>
        )}
      </section>

      <section style={panel}>
        {filtered.map((r) => (
          <div key={r.id} style={row}>
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} style={{ marginRight: 4 }} aria-label={`Select question ${r.ordinal}`} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <strong>#{r.ordinal}</strong> {r.questionText.length > 60 ? `${r.questionText.slice(0, 60)}…` : r.questionText}
              <span style={{ display: "block", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
                Track {r.track} · {TIER_LABEL[r.difficulty]} · {TYPE_LABEL[r.type] ?? r.type} · {r.points} XP · {r.conceptTag} · {r.answeredCount} answered{r.activeDate ? ` · ${r.activeDate}` : ""}
              </span>
            </span>
            <button onClick={() => setDailyQuestionsActive([r.id], !r.active).then(refresh)} style={{ ...smallBtn, borderColor: r.active ? "var(--bow-positive)" : "var(--border-rule)", color: r.active ? "var(--bow-positive)" : "var(--bow-slate)" }}>
              {r.active ? "Active" : "Hidden"}
            </button>
            <button onClick={() => startEdit(r)} style={smallBtn}>Edit</button>
          </div>
        ))}
        {filtered.length === 0 && <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>No questions match the current filter.</p>}
      </section>

      <BulkImport refresh={refresh} />
    </div>
  );
}

/* ---- Bulk JSON import ---- */
function BulkImport({ refresh }: { refresh: () => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doPreview = () => {
    setErr(null); setResult(null); setPreview(null);
    if (!text.trim()) { setErr("Paste a JSON array first."); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { setErr("That isn't valid JSON. Check for trailing commas or missing quotes."); return; }
    if (!Array.isArray(parsed)) { setErr("JSON must be an array of question objects."); return; }
    setPreview(parsed as Record<string, unknown>[]);
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true); setResult(null);
    const res = await bulkImportQuestions(preview);
    setBusy(false);
    setResult(res.message);
    if (res.ok && res.inserted > 0) { setText(""); setPreview(null); refresh(); }
  };

  const str = (v: unknown) => (v == null ? "" : String(v));
  const pField = (o: Record<string, unknown>, ...keys: string[]) => { for (const k of keys) if (o[k] != null) return str(o[k]); return ""; };

  return (
    <section style={panel}>
      <h3 style={title}>Bulk import (JSON)</h3>
      <p style={{ margin: "0 0 10px", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
        Paste a JSON array of question objects. Duplicates (by question text) and invalid rows are skipped. Difficulty accepts <code>rookie/pro/executive</code> or <code>1/2/3</code>; MC choices can be an <code>options</code> array.
      </p>
      <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={IMPORT_PLACEHOLDER} style={{ ...input, resize: "vertical", fontFamily: "var(--font-data)", fontSize: 12.5 }} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={doPreview} disabled={busy} style={smallBtn}>Preview Import</button>
        <button onClick={confirm} disabled={busy || !preview} style={primaryBtn(busy || !preview)}>{busy ? "Importing…" : "Confirm Import"}</button>
        {err && <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--bow-negative)" }}>{err}</span>}
        {result && <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--bow-positive)" }}>{result}</span>}
      </div>

      {preview && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 8px", fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Preview — {preview.length} row(s)</p>
          {preview.slice(0, 50).map((o, i) => {
            const q = pField(o, "questionText", "question_text", "question");
            const ok = !!q.trim();
            return (
              <div key={i} style={{ ...row, borderColor: "var(--border-rule)" }}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ color: ok ? "var(--bow-ink)" : "var(--bow-negative)" }}>{ok ? (q.length > 60 ? `${q.slice(0, 60)}…` : q) : "⚠ missing question text"}</strong>
                  <span style={{ display: "block", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>
                    {pField(o, "type") || "mc"} · track {pField(o, "track") || "101"} · {pField(o, "difficulty") || "rookie"}
                  </span>
                </span>
              </div>
            );
          })}
          {preview.length > 50 && <p style={{ margin: "6px 0 0", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>…and {preview.length - 50} more.</p>}
        </div>
      )}
    </section>
  );
}

/* ============================================================ News */

function NewsManager({ items, submissions, refresh }: { items: NewsItem[]; submissions: NewsSubmission[]; refresh: () => void }) {
  const [form, setForm] = useState({ headline: "", summary: "", sourceName: "", sourceUrl: "", conceptTag: "", publishedDate: "" });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!form.headline.trim() || !form.summary.trim()) return;
    setBusy(true);
    const res = await createNewsItem(form);
    setBusy(false);
    if (res.ok) { setForm({ headline: "", summary: "", sourceName: "", sourceUrl: "", conceptTag: "", publishedDate: "" }); refresh(); }
  };

  return (
    <div>
      <section style={panel}>
        <h3 style={title}>Create news item</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
          <Field label="Headline"><input style={input} value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></Field>
          <Field label="Source name"><input style={input} value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} /></Field>
          <Field label="Source URL"><input style={input} value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} /></Field>
          <Field label="Concept tag"><input style={input} value={form.conceptTag} onChange={(e) => setForm({ ...form, conceptTag: e.target.value })} placeholder="luxury_tax" /></Field>
          <Field label="Published date"><input style={input} type="date" value={form.publishedDate} onChange={(e) => setForm({ ...form, publishedDate: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: 10 }}><Field label="Summary"><textarea rows={2} style={{ ...input, resize: "vertical" }} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field></div>
        <div style={{ marginTop: 12 }}><button onClick={create} disabled={busy || !form.headline.trim() || !form.summary.trim()} style={primaryBtn(busy || !form.headline.trim() || !form.summary.trim())}>{busy ? "Creating…" : "Create Item"}</button></div>
      </section>

      <section style={panel}>
        <h3 style={title}>Pending submissions ({submissions.length})</h3>
        {submissions.length === 0 ? <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>No pending submissions.</p> : submissions.map((s) => (
          <div key={s.id} style={{ ...row, alignItems: "flex-start" }}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <strong>{s.headline}</strong>
              <span style={{ display: "block", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>by {s.studentName}</span>
              {s.summary && <span style={{ display: "block", fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--bow-slate)" }}>{s.summary}</span>}
            </span>
            <span style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => { await approveNewsSubmission(s.id); refresh(); }} style={{ ...smallBtn, borderColor: "var(--bow-positive)", color: "var(--bow-positive)" }}>Approve</button>
              <button onClick={async () => { await rejectNewsSubmission(s.id); refresh(); }} style={smallBtn}>Reject</button>
            </span>
          </div>
        ))}
      </section>

      <section style={panel}>
        <h3 style={title}>News items ({items.length})</h3>
        {items.map((n) => (
          <div key={n.id} style={row}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <strong>{n.headline}</strong>
              <span style={{ display: "block", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{n.conceptTag || "—"}{n.sourceName ? ` · ${n.sourceName}` : ""}{n.active ? "" : " · hidden"}</span>
            </span>
            <button onClick={async () => { await setNewsItemActive(n.id, !n.active); refresh(); }} style={{ ...smallBtn, borderColor: n.active ? "var(--bow-positive)" : "var(--border-rule)", color: n.active ? "var(--bow-positive)" : "var(--bow-slate)" }}>
              {n.active ? "Active" : "Hidden"}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ============================================================ Testimonials */

const emptyTm = { quote: "", studentName: "", schoolName: "", trackCompleted: "", active: true };

function TestimonialManager({ items, refresh }: { items: Testimonial[]; refresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyTm });
  const [busy, setBusy] = useState(false);

  const startCreate = () => { setEditingId("new"); setForm({ ...emptyTm }); };
  const startEdit = (t: Testimonial) => { setEditingId(t.id); setForm({ quote: t.quote, studentName: t.studentName, schoolName: t.schoolName, trackCompleted: t.trackCompleted, active: t.active }); };

  const save = async () => {
    if (!form.quote.trim() || !form.studentName.trim()) return;
    setBusy(true);
    const res = editingId === "new" ? await createTestimonial(form) : await updateTestimonial(editingId!, form);
    setBusy(false);
    if (res.ok) { setEditingId(null); refresh(); }
  };

  return (
    <div>
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ ...title, margin: 0 }}>Testimonials ({items.length})</h3>
          <button onClick={startCreate} style={primaryBtn(false)}>+ Add Testimonial</button>
        </div>
        {editingId && (
          <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--border-rule)", borderRadius: 6, background: "var(--bow-paper)", display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Quote"><textarea rows={2} style={{ ...input, resize: "vertical" }} value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              <Field label="Name"><input style={input} value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} /></Field>
              <Field label="School"><input style={input} value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} /></Field>
              <Field label="Track (101/201)"><input style={input} value={form.trackCompleted} onChange={(e) => setForm({ ...form, trackCompleted: e.target.value })} /></Field>
              <Field label="Active"><select style={input} value={form.active ? "1" : "0"} onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}><option value="1">Active</option><option value="0">Hidden</option></select></Field>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={save} disabled={busy} style={primaryBtn(busy)}>{busy ? "Saving…" : editingId === "new" ? "Add" : "Save"}</button>
              <button onClick={() => setEditingId(null)} style={smallBtn}>Cancel</button>
            </div>
          </div>
        )}
      </section>
      <section style={panel}>
        {items.map((t) => (
          <div key={t.id} style={row}>
            <span style={{ minWidth: 0, flex: 1 }}>
              “{t.quote.length > 80 ? `${t.quote.slice(0, 80)}…` : t.quote}”
              <span style={{ display: "block", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{t.studentName}{t.schoolName ? ` · ${t.schoolName}` : ""}{t.active ? "" : " · hidden"}</span>
            </span>
            <button onClick={() => startEdit(t)} style={smallBtn}>Edit</button>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ============================================================ Glossary */

const emptyGl = { term: "", definition: "", moduleName: "", track: "101", realWorldExample: "", category: "economics" };
const GL_CATS = [["cap_mechanics", "Cap Mechanics"], ["economics", "Economics"], ["analytics", "Analytics"], ["business", "Business"]];

function GlossaryManager({ terms, refresh }: { terms: GlossaryTerm[]; refresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyGl });
  const [busy, setBusy] = useState(false);

  const startCreate = () => { setEditingId("new"); setForm({ ...emptyGl }); };
  const startEdit = (t: GlossaryTerm) => { setEditingId(t.id); setForm({ term: t.term, definition: t.definition, moduleName: t.moduleName, track: t.track, realWorldExample: t.realWorldExample, category: t.category }); };

  const save = async () => {
    if (!form.term.trim() || !form.definition.trim()) return;
    setBusy(true);
    const res = editingId === "new" ? await createGlossaryTerm(form) : await updateGlossaryTerm(editingId!, form);
    setBusy(false);
    if (res.ok) { setEditingId(null); refresh(); }
  };

  return (
    <div>
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ ...title, margin: 0 }}>Glossary terms ({terms.length})</h3>
          <button onClick={startCreate} style={primaryBtn(false)}>+ Add Term</button>
        </div>
        {editingId && (
          <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--border-rule)", borderRadius: 6, background: "var(--bow-paper)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
              <Field label="Term"><input style={input} value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} /></Field>
              <Field label="Module name"><input style={input} value={form.moduleName} onChange={(e) => setForm({ ...form, moduleName: e.target.value })} placeholder="Track 201, Module 1" /></Field>
              <Field label="Track"><input style={input} value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} /></Field>
              <Field label="Category"><select style={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{GL_CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            </div>
            <Field label="Definition"><textarea rows={2} style={{ ...input, resize: "vertical" }} value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} /></Field>
            <Field label="Real-world example"><textarea rows={2} style={{ ...input, resize: "vertical" }} value={form.realWorldExample} onChange={(e) => setForm({ ...form, realWorldExample: e.target.value })} /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={save} disabled={busy} style={primaryBtn(busy)}>{busy ? "Saving…" : editingId === "new" ? "Add" : "Save"}</button>
              <button onClick={() => setEditingId(null)} style={smallBtn}>Cancel</button>
            </div>
          </div>
        )}
      </section>
      <section style={panel}>
        {terms.map((t) => (
          <div key={t.id} style={row}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <strong>{t.term}</strong>
              <span style={{ display: "block", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>{t.category} · {t.moduleName}</span>
            </span>
            <button onClick={() => startEdit(t)} style={smallBtn}>Edit</button>
          </div>
        ))}
      </section>
    </div>
  );
}
