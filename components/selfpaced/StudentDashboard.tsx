"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  reflectionWordCount,
  SELF_MIN_REFLECTION_WORDS,
  type DailyScenarioView,
  type QuizModuleSection,
  type SelfModuleView,
} from "@/lib/account";
import { markSelfModuleComplete, saveSelfReflection } from "@/app/actions/lms";
import EconQuiz from "@/components/selfpaced/EconQuiz";
import DailyScenarios from "@/components/selfpaced/DailyScenarios";

interface Props {
  firstName: string;
  modules: SelfModuleView[];
  /** Quiz sections, one per module (Feature 3). */
  quizSections: QuizModuleSection[];
  /** This week's active BOW Daily scenario (Feature 2). */
  activeScenario: DailyScenarioView | null;
  /** Previously answered scenarios, newest first. */
  scenarioHistory: DailyScenarioView[];
}

export default function StudentDashboard({ firstName, modules, quizSections, activeScenario, scenarioHistory }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const completedCount = modules.filter((m) => m.completed).length;
  const total = modules.length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const allDone = total > 0 && completedCount === total;

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          Self-Paced · Track 101
        </span>
        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Good to see you, {firstName}.
        </h1>
        <p style={{ margin: "0 0 26px", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 560 }}>
          Four modules, unlocked one decision at a time. Finish a module and write a short reflection to open the next.
        </p>

        {/* PROGRESS */}
        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Your progress</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-ink)" }}>{completedCount} of {total} modules complete</span>
          </div>
          <div style={{ height: 12, background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 999, overflow: "hidden" }}>
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ height: "100%", width: `${pct}%`, background: allDone ? "var(--bow-positive)" : "var(--bow-blue)", transition: "width var(--dur-card) var(--ease-out)" }}
            />
          </div>
        </div>

        {/* CERTIFICATE PROMPT */}
        {allDone && <CertificatePrompt firstName={firstName} />}

        {/* MODULES */}
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>
          The four modules
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 40 }}>
          {modules.map((m) => (
            <ModuleCard key={m.module.id} view={m} router={router} startTransition={startTransition} />
          ))}
        </div>

        {/* ECON QUIZ (Feature 3) */}
        <EconQuiz sections={quizSections} />

        {/* BOW DAILY SCENARIOS (Feature 2) */}
        <DailyScenarios active={activeScenario} history={scenarioHistory} />
      </div>
    </div>
  );
}

/* ---------------- certificate ---------------- */

function CertificatePrompt({ firstName }: { firstName: string }) {
  const [clicked, setClicked] = useState(false);
  return (
    <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, borderTop: "4px solid var(--bow-positive)", padding: "clamp(24px,3.5vw,36px)", marginBottom: 28 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5fcf99" }}>
        Track 101 · Complete
      </span>
      <h2 style={{ margin: "10px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 0.96, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
        Nicely run, {firstName}.
      </h2>
      <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 520 }}>
        You finished all four modules and reflected on every one. Claim your certificate of completion.
      </p>
      <button
        onClick={() => setClicked(true)}
        style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 28px", border: "none", background: "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: "pointer" }}
      >
        Get My Certificate
      </button>
      {clicked && (
        <p style={{ margin: "14px 0 0", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#5fcf99" }}>
          Certificate generation is coming soon — we’ll email it to you the moment it’s ready.
        </p>
      )}
    </div>
  );
}

/* ---------------- module card ---------------- */

function ModuleCard({
  view,
  router,
  startTransition,
}: {
  view: SelfModuleView;
  router: ReturnType<typeof useRouter>;
  startTransition: React.TransitionStartFunction;
}) {
  const { module: m, unlocked, completed, reflection, lockedReason } = view;
  const [draft, setDraft] = useState(reflection);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const words = reflectionWordCount(draft);
  const met = words >= SELF_MIN_REFLECTION_WORDS;

  const accent = completed ? "var(--bow-positive)" : unlocked ? "var(--bow-blue)" : "var(--bow-inactive)";
  const statusLabel = completed ? "Completed" : unlocked ? "Open" : "Locked";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    setBusy(false);
    startTransition(() => router.refresh());
  };

  const onComplete = () => run(() => markSelfModuleComplete(m.id));
  const onSaveReflection = () =>
    run(async () => {
      await saveSelfReflection(m.id, draft);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    });

  return (
    <div
      style={{
        background: unlocked ? "var(--bow-white)" : "var(--bow-paper)",
        border: "1px solid var(--border-rule)",
        borderLeft: `4px solid ${accent}`,
        borderRadius: 6,
        padding: "clamp(18px,2.5vw,24px)",
        opacity: unlocked ? 1 : 0.7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", flexShrink: 0 }}>
            M{String(m.ordinal).padStart(2, "0")}
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,2.4vw,24px)", textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
            {m.title}
          </span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, flexShrink: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: accent }} />
          {statusLabel}
          {view.instructorUnlocked && !completed ? " · instructor" : ""}
        </span>
      </div>

      <p style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontSize: 16.5, lineHeight: 1.5, color: "var(--bow-ink)" }}>
        {m.centralQuestion}
      </p>
      <p style={{ margin: "6px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>
        {m.summary} <span style={{ color: accent }}>· {m.concept}</span>
      </p>

      {!unlocked && (
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>
          <span aria-hidden style={{ fontSize: 14 }}>🔒</span>
          {lockedReason}
        </div>
      )}

      {unlocked && (
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--border-rule)" }}>
          {/* complete control */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
            {completed ? (
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-positive)" }}>
                ✓ You marked this module complete
              </span>
            ) : (
              <button
                onClick={onComplete}
                disabled={busy}
                style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 20px", border: "none", background: busy ? "var(--bow-inactive)" : "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: busy ? "wait" : "pointer" }}
              >
                {busy ? "Saving…" : "Mark Module Complete"}
              </button>
            )}
          </div>

          {/* reflection */}
          <label
            htmlFor={`refl-${m.id}`}
            style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 8 }}
          >
            Reflection — at least {SELF_MIN_REFLECTION_WORDS} words
          </label>
          <textarea
            id={`refl-${m.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="What was the real trade-off in this module? Two or three sentences on the call you'd make and why."
            style={{ width: "100%", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "12px 14px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, resize: "vertical", outline: "none" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: met ? "var(--bow-positive)" : "var(--bow-slate)" }}>
              {words} / {SELF_MIN_REFLECTION_WORDS} words{met ? " ✓" : ""}
              {savedFlash ? " · saved" : ""}
            </span>
            <button
              onClick={onSaveReflection}
              disabled={busy || draft.trim() === ""}
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 18px", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--bow-ink)", borderRadius: 4, cursor: busy || draft.trim() === "" ? "not-allowed" : "pointer", opacity: busy || draft.trim() === "" ? 0.5 : 1 }}
            >
              Save Reflection
            </button>
          </div>
          {completed && !met && (
            <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-warning)" }}>
              Add {SELF_MIN_REFLECTION_WORDS - words} more word{SELF_MIN_REFLECTION_WORDS - words === 1 ? "" : "s"} to unlock the next module.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
