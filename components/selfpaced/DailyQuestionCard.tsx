"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DailyQuestionView } from "@/lib/daily-question";
import { submitDailyResponse } from "@/app/actions/lms";

const GOLD = "#C9A84C";
const GOLD_SOFT = "rgba(201,168,76,0.45)";

interface AnswerState {
  selectedChoice: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  conceptLabel: string;
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

export default function DailyQuestionCard({ view }: { view: DailyQuestionView | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Server-rendered answered state, or the answer the student just submitted.
  const initial: AnswerState | null = view?.answered
    ? {
        selectedChoice: view.selectedChoice ?? "",
        isCorrect: !!view.isCorrect,
        correctAnswer: view.correctAnswer ?? "",
        explanation: view.explanation ?? "",
        conceptLabel: view.conceptLabel,
      }
    : null;
  const [answer, setAnswer] = useState<AnswerState | null>(initial);
  const [remaining, setRemaining] = useState<number | null>(null);

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

  const onPick = async (choice: string) => {
    if (busy || answered) return;
    setBusy(true);
    setError(false);
    try {
      const res = await submitDailyResponse(view.id, choice);
      if (res.ok) {
        setAnswer({
          selectedChoice: res.selectedChoice ?? choice,
          isCorrect: !!res.isCorrect,
          correctAnswer: res.correctAnswer ?? "",
          explanation: res.explanation ?? "",
          conceptLabel: res.conceptLabel ?? view.conceptLabel,
        });
        // Refresh so the header streak + any milestone notification update.
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

      <h2 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(22px,3vw,30px)", lineHeight: 1.12, letterSpacing: "-0.01em", color: "#fff" }}>
        {view.questionText}
      </h2>

      <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
        {view.choices.map((c) => {
          const isSelected = answered && answer?.selectedChoice === c.key;
          const isAnswerKey = answered && answer?.correctAnswer === c.key;
          // After answering: the right answer is gold; a wrong pick is red-tinted.
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
              onClick={() => onPick(c.key)}
              disabled={busy || answered}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                textAlign: "left",
                padding: "13px 16px",
                borderRadius: 6,
                background: bg,
                border,
                color,
                cursor: busy || answered ? "default" : "pointer",
                fontFamily: "var(--font-interface)",
                fontSize: 15.5,
                lineHeight: 1.4,
                transition: "background var(--dur-card,160ms) ease, border-color var(--dur-card,160ms) ease",
              }}
            >
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12.5, fontWeight: 700, color: answered && isAnswerKey ? GOLD : "#9a9da6", flexShrink: 0, marginTop: 1 }}>
                {c.key}
              </span>
              <span>{c.text}</span>
              {answered && isAnswerKey && (
                <span aria-hidden style={{ marginLeft: "auto", color: GOLD, fontWeight: 700 }}>✓</span>
              )}
              {answered && isSelected && !isAnswerKey && (
                <span aria-hidden style={{ marginLeft: "auto", color: "var(--bow-negative)", fontWeight: 700 }}>✗</span>
              )}
            </button>
          );
        })}
      </div>

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
          </div>
          <p style={{ margin: "12px 0 0", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#c8cad0" }}>
            {answer.explanation}
          </p>
          <p style={{ margin: "16px 0 0", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#9a9da6" }}>
            Next question in <span style={{ color: GOLD }}>{remaining != null ? countdownText(remaining) : "—"}</span>
          </p>
        </div>
      )}
    </section>
  );
}
