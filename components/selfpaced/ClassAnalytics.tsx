"use client";

import { useState } from "react";
import type { CohortAnalytics } from "@/lib/analytics";

function Bar({ label, right, pct, color }: { label: string; right: string; pct: number; color: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 5 }}>
        <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-ink)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{right}</span>
      </div>
      <div style={{ height: 10, background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, transition: "width var(--dur-card, .3s) ease" }} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "16px 18px" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 28, lineHeight: 1, color: "var(--bow-ink)" }}>{value}</div>
      <div style={{ marginTop: 6, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{label}</div>
    </div>
  );
}

function buildDigest(a: CohortAnalytics, instructorName: string): string {
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const lines: string[] = [];
  lines.push(`BOW WEEKLY REPORT — ${a.cohortName}`);
  lines.push(`Prepared by ${instructorName} · ${date}`);
  lines.push("");
  lines.push(`Students: ${a.studentCount}`);
  lines.push(`Average BOW Score: ${a.avgBowScore} (top ${a.topBowScore})`);
  lines.push("");
  lines.push("MODULE PROGRESS (furthest module reached)");
  for (const m of a.moduleDistribution) lines.push(`- M${m.ordinal} ${m.title}: ${m.count} student${m.count === 1 ? "" : "s"}`);
  lines.push("");
  lines.push("QUIZ AVERAGES (multiple choice)");
  for (const q of a.quizAvgByModule) lines.push(`- M${q.ordinal} ${q.title}: ${q.avgPct === null ? "no answers yet" : `${q.avgPct}%`} (${q.answeredStudents} answered)`);
  lines.push("");
  lines.push("PARTICIPATION");
  lines.push(`- BOW Daily answered: ${a.scenarioRatePct}% of students`);
  lines.push(`- Reflections submitted: ${a.reflectionRatePct}%`);
  lines.push(`- Simulation completed: ${a.simulationRatePct}%`);
  lines.push(`- Certificate earned: ${a.certificateRatePct}%`);
  return lines.join("\n");
}

/** Class Analytics panel + Weekly Report copy-to-clipboard (Feature 8). */
export default function ClassAnalytics({ analytics, instructorName }: { analytics: CohortAnalytics; instructorName: string }) {
  const a = analytics;
  const [copied, setCopied] = useState(false);
  const n = Math.max(1, a.studentCount);

  const copyDigest = async () => {
    const text = buildDigest(a, instructorName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt("Copy the weekly report:", text);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          Class Analytics
        </span>
        <button
          onClick={copyDigest}
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 18px", border: "1px solid var(--border-strong)", background: copied ? "var(--bow-ink)" : "transparent", color: copied ? "#fff" : "var(--bow-ink)", borderRadius: 4, cursor: "pointer" }}
        >
          {copied ? "✓ Copied Report" : "Copy Weekly Report"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
        <Metric label="Students" value={String(a.studentCount)} />
        <Metric label="Avg BOW Score" value={String(a.avgBowScore)} />
        <Metric label="Top BOW Score" value={String(a.topBowScore)} />
      </div>

      <section style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "20px 22px", marginBottom: 16 }}>
        <h3 style={panelTitle}>Module completion distribution</h3>
        {a.moduleDistribution.map((m) => (
          <Bar key={m.ordinal} label={`M${m.ordinal} · ${m.title}`} right={`${m.count} of ${a.studentCount}`} pct={(m.count / n) * 100} color="var(--bow-blue)" />
        ))}
      </section>

      <section style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "20px 22px", marginBottom: 16 }}>
        <h3 style={panelTitle}>Quiz average by module (MC)</h3>
        {a.quizAvgByModule.map((q) => (
          <Bar
            key={q.ordinal}
            label={`M${q.ordinal} · ${q.title}`}
            right={q.avgPct === null ? "no answers yet" : `${q.avgPct}% · ${q.answeredStudents} answered`}
            pct={q.avgPct ?? 0}
            color="var(--bow-positive)"
          />
        ))}
      </section>

      <section style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: "20px 22px" }}>
        <h3 style={panelTitle}>Participation rates</h3>
        <Bar label="BOW Daily answered" right={`${a.scenarioRatePct}%`} pct={a.scenarioRatePct} color="var(--bow-orange)" />
        <Bar label="Reflections submitted" right={`${a.reflectionRatePct}%`} pct={a.reflectionRatePct} color="var(--bow-blue)" />
        <Bar label="Simulation completed" right={`${a.simulationRatePct}%`} pct={a.simulationRatePct} color="var(--bow-warning)" />
        <Bar label="Certificate earned" right={`${a.certificateRatePct}%`} pct={a.certificateRatePct} color="var(--bow-positive)" />
      </section>
    </div>
  );
}

const panelTitle: React.CSSProperties = {
  margin: "0 0 16px",
  fontFamily: "var(--font-display)",
  fontWeight: 800,
  fontSize: 16,
  textTransform: "uppercase",
  letterSpacing: "-0.01em",
  color: "var(--bow-ink)",
};
