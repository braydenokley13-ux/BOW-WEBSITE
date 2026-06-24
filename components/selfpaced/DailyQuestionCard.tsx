"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyQuestionView } from "@/lib/daily-question";
import { submitDailyResponse } from "@/app/actions/lms";
import BadgeToast, { type ToastBadge } from "@/components/selfpaced/BadgeToast";

const GOLD = "#C9A84C";
const GOLD_SOFT = "rgba(201,168,76,0.45)";

interface AnswerState {
  selectedChoice: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  conceptLabel: string;
  xpEarned: number;
}

/** Streak badges, for the "N days until …" come-back nudge. */
const MILESTONES = [
  { n: 7, label: "Week Warrior ⚡" },
  { n: 30, label: "Monthly Grind 💎" },
  { n: 100, label: "Century Club 🏆" },
];
function nextMilestoneText(streak: number): string {
  const m = MILESTONES.find((x) => x.n > streak);
  if (!m) return "You're in the Century Club 🏆 — legendary.";
  const days = m.n - streak;
  return `${days} day${days === 1 ? "" : "s"} until ${m.label}`;
}

/** Colored difficulty pill: Rookie green, Pro blue, Executive purple. */
function tierStyle(tier: string): { color: string; bg: string } {
  if (tier === "executive") return { color: "#b794f6", bg: "rgba(124,58,237,0.18)" };
  if (tier === "pro") return { color: "#7da2ff", bg: "rgba(49,87,255,0.18)" };
  return { color: "#5fcf99", bg: "rgba(21,138,85,0.18)" };
}

/** "14h 22m" / "8m 04s" countdown text from milliseconds remaining. */
function countdownText(ms: number): string {
  if (ms <= 0) return "Refresh for today's question";
  const totalMin = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hrs >= 1) return `${hrs}h ${String(min).padStart(2, "0")}m`;
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${String(sec).padStart(2, "0")}s`;
}

const pill: React.CSSProperties = {
  fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase",
  fontWeight: 700, borderRadius: 999, padding: "4px 11px", whiteSpace: "nowrap",
};

export default function DailyQuestionCard({ view, streakCurrent }: { view: DailyQuestionView | null; streakCurrent: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [text, setText] = useState("");
  // Server-rendered answered state, or the answer the student just submitted.
  const initial: AnswerState | null = view?.answered
    ? {
        selectedChoice: view.selectedChoice ?? "",
        isCorrect: !!view.isCorrect,
        correctAnswer: view.correctAnswer ?? "",
        explanation: view.explanation ?? "",
        conceptLabel: view.conceptLabel,
        xpEarned: 0,
      }
    : null;
  const [answer, setAnswer] = useState<AnswerState | null>(initial);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [toastBadges, setToastBadges] = useState<ToastBadge[]>([]);

  // Live countdown to tomorrow's question, computed from the server-provided reset time.
  useEffect(() => {
    if (!view) return;
    const tick = () => setRemaining(view.nextResetAt - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [view]);

  if (!view) return null;

  const answered = answer !== null;
  const tc = tierStyle(view.tier);

  const submit = async (value: string) => {
    const v = String(value ?? "").trim();
    if (busy || answered || !v) return;
    setBusy(true);
    setError(false);
    try {
      const res = await submitDailyResponse(view.id, v);
      if (res.ok) {
        setAnswer({
          selectedChoice: res.selectedChoice ?? v,
          isCorrect: !!res.isCorrect,
          correctAnswer: res.correctAnswer ?? "",
          explanation: res.explanation ?? "",
          conceptLabel: res.conceptLabel ?? view.conceptLabel,
          xpEarned: res.xpEarned ?? 0,
        });
        if (res.newBadges && res.newBadges.length > 0) {
          setToastBadges(res.newBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon })));
        }
        // Refresh so the header streak + XP chips and any milestone notification update.
        router.refresh();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Daily Question"
      style={{
        background: "var(--bow-ink)",
        color: "#fff",
        borderRadius: 8,
        border: `1px solid ${answered ? "var(--bow-dark-border)" : GOLD}`,
        boxShadow: answered ? "none" : `0 0 0 3px ${GOLD_SOFT}`,
        padding: "clamp(22px,3.4vw,34px)",
        marginBottom: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: GOLD }} />
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>
            Daily Question
          </span>
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a9da6" }}>
          {answered ? "Done for today" : "30 seconds · resets daily"}
        </span>
      </div>

      {/* Difficulty / track / XP-worth meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <span style={{ ...pill, color: tc.color, background: tc.bg }}>{view.tierLabel}</span>
        <span style={{ ...pill, color: "#c8cad0", background: "rgba(255,255,255,0.06)" }}>Track {view.track}</span>
        {!answered && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", color: GOLD }}>
            Worth {view.points} XP
          </span>
        )}
      </div>

      <h2 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,3vw,30px)", lineHeight: 1.12, letterSpacing: "-0.01em", color: "#fff" }}>
        {view.questionText}
      </h2>

      {/* MC choices */}
      {view.type === "mc" && (
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          {view.choices.map((c) => {
            const isSelected = answered && answer?.selectedChoice === c.key;
            const isAnswerKey = answered && answer?.correctAnswer === c.key;
            let bg = "rgba(255,255,255,0.05)";
            let border = "1px solid var(--bow-dark-border)";
            let color = "#e9eaee";
            if (answered) {
              if (isAnswerKey) {
                bg = "rgba(201,168,76,0.18)";
                border = `1px solid ${GOLD}`;
                color = "#fff";
              } else if (isSelected) {
                bg = "rgba(214,59,59,0.16)";
                border = "1px solid var(--bow-negative)";
                color = "#fff";
              } else {
                color = "#9a9da6";
              }
            }
            return (
              <button
                key={c.key}
                onClick={() => submit(c.key)}
                disabled={busy || answered}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12, textAlign: "left",
                  padding: "13px 16px", borderRadius: 6, background: bg, border, color,
                  cursor: busy || answered ? "default" : "pointer",
                  fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.4,
                  transition: "background var(--dur-card,160ms) ease, border-color var(--dur-card,160ms) ease",
                }}
              >
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12.5, fontWeight: 700, color: answered && isAnswerKey ? GOLD : "#9a9da6", flexShrink: 0, marginTop: 1 }}>
                  {c.key}
                </span>
                <span>{c.text}</span>
                {answered && isAnswerKey && <span aria-hidden style={{ marginLeft: "auto", color: GOLD, fontWeight: 700 }}>✓</span>}
                {answered && isSelected && !isAnswerKey && <span aria-hidden style={{ marginLeft: "auto", color: "var(--bow-negative)", fontWeight: 700 }}>✗</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Math / free-response input */}
      {view.type !== "mc" && !answered && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(text); }}
          style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputMode={view.type === "math" ? "decimal" : "text"}
            placeholder={view.type === "math" ? "Enter your number" : "Type your answer"}
            disabled={busy}
            style={{ flex: 1, minWidth: 200, background: "rgba(255,255,255,0.06)", border: "1px solid var(--bow-dark-border)", color: "#fff", padding: "13px 16px", borderRadius: 6, fontFamily: "var(--font-interface)", fontSize: 15.5, outline: "none" }}
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 22px", border: "none", background: busy || !text.trim() ? "var(--bow-inactive)" : GOLD, color: "var(--bow-ink)", borderRadius: 6, cursor: busy || !text.trim() ? "not-allowed" : "pointer" }}
          >
            {busy ? "Checking…" : "Submit"}
          </button>
        </form>
      )}

      {/* Math / free-response result */}
      {view.type !== "mc" && answered && answer && (
        <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
          <div style={{ padding: "13px 16px", borderRadius: 6, background: answer.isCorrect ? "rgba(201,168,76,0.14)" : "rgba(214,59,59,0.14)", border: `1px solid ${answer.isCorrect ? GOLD : "var(--bow-negative)"}` }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "#9a9da6" }}>Your answer</span>
            <span style={{ display: "block", fontFamily: "var(--font-interface)", fontSize: 16, color: "#fff" }}>{answer.selectedChoice || "—"}</span>
          </div>
          {!answer.isCorrect && (
            <div style={{ padding: "13px 16px", borderRadius: 6, background: "rgba(201,168,76,0.12)", border: `1px solid ${GOLD_SOFT}` }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: GOLD }}>Correct answer</span>
              <span style={{ display: "block", fontFamily: "var(--font-interface)", fontSize: 16, color: "#fff" }}>{answer.correctAnswer}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p style={{ margin: "14px 0 0", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-warning)" }}>
          Something went wrong. Please try again.
        </p>
      )}

      {answered && answer && (
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--bow-dark-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", letterSpacing: "0.02em", color: answer.isCorrect ? "var(--bow-positive)" : "var(--bow-warning)" }}>
              {answer.isCorrect ? "Correct" : "Not quite"}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${GOLD_SOFT}`, borderRadius: 999, padding: "4px 12px" }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: GOLD }} />
              <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD }}>
                {answer.conceptLabel}
              </span>
            </span>
            {answer.xpEarned > 0 && (
              <span className="bow-xp-pop" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: GOLD, letterSpacing: "0.01em" }}>
                + {answer.xpEarned} XP
              </span>
            )}
          </div>
          <p style={{ margin: "12px 0 0", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#c8cad0" }}>
            {answer.explanation}
          </p>
          <div style={{ margin: "16px 0 0", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#9a9da6" }}>
              Come back tomorrow — <span style={{ color: GOLD }}>{nextMilestoneText(streakCurrent)}</span>
            </span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#9a9da6" }}>
              Next question in <span style={{ color: GOLD }}>{remaining != null ? countdownText(remaining) : "—"}</span>
            </span>
          </div>
        </div>
      )}

      {toastBadges.length > 0 && (
        <BadgeToast key={toastBadges.map((b) => b.id).join("-")} badges={toastBadges} onDone={() => setToastBadges([])} />
      )}
    </section>
  );
}
