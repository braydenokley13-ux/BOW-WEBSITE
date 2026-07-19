"use client";

import { useState } from "react";
import Link from "next/link";

const GOLD = "#C9A84C";

export interface DemoData {
  concepts: { name: string; track: string; category: string; application: string }[];
  module: { title: string; summary: string; concept: string; centralQuestion: string };
  sampleQuestions: {
    label: string;
    type: "mc" | "fr";
    question: string;
    choices: { key: string; text: string }[];
    correctAnswer: string | null;
    explanation: string;
  }[];
  simTeam: string;
  simTotalTurns: number;
  simTurn: {
    title: string;
    situation: string;
    concept: string;
    choices: { label: string; description: string; sound: boolean }[];
    soundLabel: string;
    soundOutcome: string;
  };
  leaderboard: { name: string; rank: string; score: number; streak: number }[];
}

const STEPS = ["Curriculum", "Sample Module", "Simulation", "Student Outcomes", "Partnership"];

const card: React.CSSProperties = { background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 8, padding: "clamp(20px,3vw,30px)" };
const eyebrow: React.CSSProperties = { fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" };
const h2: React.CSSProperties = { margin: "10px 0 10px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.6vw,40px)", lineHeight: 0.98, letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--bow-ink)" };
const lead: React.CSSProperties = { fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 760 };

export default function DemoTour({ data }: { data: DemoData }) {
  const [step, setStep] = useState(0);

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh" }}>
      {/* PERSISTENT DEMO HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--bow-ink)", color: "#fff", borderBottom: `2px solid ${GOLD}`, padding: "12px clamp(16px,4vw,40px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "#e9eaee" }}>
          <strong style={{ color: GOLD }}>BOW Sports Capital partner demo.</strong> Want to bring this to your students?
        </span>
        <Link href="/contact" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "9px 18px", background: GOLD, color: "var(--bow-ink)", borderRadius: 4, textDecoration: "none", whiteSpace: "nowrap" }}>
          Contact Us
        </Link>
      </header>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
        {/* STEP TABS */}
        <div role="tablist" aria-label="Demo steps" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={active}
                onClick={() => setStep(i)}
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11.5,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  padding: "9px 16px",
                  borderRadius: 999,
                  cursor: "pointer",
                  border: `1px solid ${active ? "var(--bow-ink)" : "var(--border-rule)"}`,
                  background: active ? "var(--bow-ink)" : "transparent",
                  color: active ? "#fff" : done ? "var(--bow-ink)" : "var(--bow-slate)",
                }}
              >
                {i + 1}. {s}
              </button>
            );
          })}
        </div>

        {step === 0 && <StepCurriculum data={data} />}
        {step === 1 && <StepModule data={data} />}
        {step === 2 && <StepSim data={data} />}
        {step === 3 && <StepOutcomes data={data} />}
        {step === 4 && <StepPartnership />}

        {/* NAV */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, gap: 12 }}>
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--bow-ink)", borderRadius: 4, cursor: step === 0 ? "not-allowed" : "pointer", opacity: step === 0 ? 0.4 : 1 }}
          >
            ← Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}
            >
              Next: {STEPS[step + 1]} →
            </button>
          ) : (
            <Link href="/contact" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 22px", background: "var(--bow-orange)", color: "#fff", borderRadius: 4, textDecoration: "none" }}>
              Request a Partnership →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Step 1: Curriculum ---------------- */

function StepCurriculum({ data }: { data: DemoData }) {
  return (
    <section style={card}>
      <span style={eyebrow}>Step 1 · Curriculum Overview</span>
      <h2 style={h2}>Every module maps to real economics.</h2>
      <p style={lead}>
        BOW teaches the economics of sports through the lens of real front-office decisions. Every module maps to AP Micro or AP Macro standards — and to how actual GMs think. Here is the full concept map your students work through.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginTop: 22 }}>
        {data.concepts.map((c) => (
          <div key={c.name} style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: "12px 14px", background: "var(--bow-paper)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{c.name}</span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                {c.category === "micro" ? "AP Micro" : c.category === "macro" ? "AP Macro" : "Sports"}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontFamily: "var(--font-interface)", fontSize: 12.5, lineHeight: 1.45, color: "var(--bow-slate)" }}>{c.application}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Step 2: Sample Module ---------------- */

function StepModule({ data }: { data: DemoData }) {
  return (
    <section style={card}>
      <span style={eyebrow}>Step 2 · Sample Module</span>
      <h2 style={h2}>{data.module.title}</h2>
      <p style={{ ...lead, fontStyle: "italic", color: "var(--bow-ink)" }}>{data.module.centralQuestion}</p>
      <p style={{ ...lead, marginTop: 10 }}>{data.module.summary}</p>
      <div style={{ marginTop: 8, fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
        Concept: {data.module.concept}
      </div>

      <h3 style={{ margin: "26px 0 14px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textTransform: "uppercase", color: "var(--bow-ink)" }}>
        A taste of the curriculum — answers revealed
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {data.sampleQuestions.map((q, i) => (
          <div key={i} style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: "16px 18px", background: "var(--bow-paper)" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>{q.label}</span>
            <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.5, color: "var(--bow-ink)", fontWeight: 600 }}>{q.question}</p>
            {q.type === "mc" && (
              <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                {q.choices.map((c) => {
                  const correct = c.key === q.correctAnswer;
                  return (
                    <div key={c.key} style={{ display: "flex", gap: 8, padding: "8px 12px", borderRadius: 5, background: correct ? "rgba(201,168,76,0.16)" : "var(--bow-white)", border: `1px solid ${correct ? GOLD : "var(--border-rule)"}`, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-ink)" }}>
                      <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, color: correct ? GOLD : "var(--bow-slate)" }}>{c.key}</span>
                      <span>{c.text}</span>
                      {correct && <span style={{ marginLeft: "auto", color: GOLD, fontWeight: 700 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
            <p style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)", fontStyle: "italic" }}>
              {q.type === "fr" ? "Model answer: " : ""}{q.explanation}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Step 3: Simulation Preview ---------------- */

function StepSim({ data }: { data: DemoData }) {
  const t = data.simTurn;
  return (
    <section style={card}>
      <span style={eyebrow}>Step 3 · Simulation Preview</span>
      <h2 style={h2}>{data.simTeam} — Turn 1</h2>
      <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, padding: "20px 22px", marginTop: 8 }}>
        <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD }}>{t.title}</div>
        <p style={{ margin: "10px 0 16px", fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.6, color: "#e9eaee" }}>{t.situation}</p>
        <div style={{ display: "grid", gap: 8 }}>
          {t.choices.map((c) => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px", borderRadius: 5, background: c.sound ? "rgba(201,168,76,0.16)" : "rgba(255,255,255,0.05)", border: `1px solid ${c.sound ? GOLD : "var(--bow-dark-border)"}` }}>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14.5, color: "#fff" }}>{c.label}</span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#9aa3b2" }}>{c.description}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--bow-dark-border)" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD }}>
            Soundest call · {t.concept}
          </span>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "#e9eaee" }}>
            <strong>{t.soundLabel}.</strong> {t.soundOutcome}
          </p>
        </div>
      </div>
      <p style={{ ...lead, marginTop: 16 }}>
        Students make {data.simTotalTurns} decisions per simulation, each teaching a different economic concept — and get a graded report card at the end.
      </p>
    </section>
  );
}

/* ---------------- Step 4: Student Outcomes ---------------- */

function StepOutcomes({ data }: { data: DemoData }) {
  return (
    <section style={card}>
      <span style={eyebrow}>Step 4 · Student Outcomes</span>
      <h2 style={h2}>Engagement you can measure.</h2>
      <p style={lead}>
        Every student who completes a track earns a downloadable certificate. Guardian-approved students can also receive a revocable, privacy-limited credential link for applications.
      </p>
      <div style={{ background: "var(--bow-ink)", borderRadius: 8, padding: "18px 20px", marginTop: 20 }}>
        <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: 12 }}>Sample Leaderboard</div>
        {data.leaderboard.map((s, i) => (
          <div key={s.name} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--bow-dark-border)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 18, color: "#9aa3b2" }}>{i + 1}</span>
            <span>
              <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, textTransform: "uppercase", color: "#fff" }}>{s.name}</span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "#9aa3b2" }}>{s.rank} · 🔥 {s.streak}</span>
            </span>
            <span style={{ textAlign: "right" }}>
              <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, color: "#fff" }}>{s.score}</span>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>BOW Score</span>
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
        {[["Front Office", "Top rank earned"], ["Certificate", "Per track completed"], ["Public profile", "Shareable record"], ["🔥 Streaks", "Daily engagement"]].map(([v, l]) => (
          <div key={v} style={{ background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "14px 16px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--bow-ink)" }}>{v}</div>
            <div style={{ marginTop: 4, fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Step 5: Partnership ---------------- */

function StepPartnership() {
  const bullets = [
    ["Self-paced", "No teacher training required — students move at their own pace."],
    ["Standards-aligned", "Maps to AP Micro and AP Macro standards across both tracks."],
    ["Measurable", "Real engagement data for every student — progress, scores, streaks."],
  ];
  return (
    <section style={{ ...card, background: "var(--bow-ink)", color: "#fff", border: "none" }}>
      <span style={{ ...eyebrow }}>Step 5 · Partnership</span>
      <h2 style={{ ...h2, color: "#fff" }}>Bring BOW to your league&apos;s youth programs.</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, margin: "20px 0 24px" }}>
        {bullets.map(([t, d]) => (
          <div key={t} style={{ background: "var(--bow-dark-surface)", border: "1px solid var(--bow-dark-border)", borderRadius: 6, padding: "18px 20px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, textTransform: "uppercase", color: GOLD }}>{t}</div>
            <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "#c8cad0" }}>{d}</p>
          </div>
        ))}
      </div>
      <Link href="/contact" style={{ display: "inline-block", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 30px", background: GOLD, color: "var(--bow-ink)", borderRadius: 4, textDecoration: "none" }}>
        Request a Partnership →
      </Link>
    </section>
  );
}
