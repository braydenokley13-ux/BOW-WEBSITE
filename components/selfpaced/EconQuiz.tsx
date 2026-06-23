"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QuizModuleSection, QuizQuestionView } from "@/lib/account";
import { submitQuizResponse, type QuizSubmitResult } from "@/app/actions/lms";
import { DifficultyDots } from "@/components/selfpaced/DailyScenarios";

interface Props {
  sections: QuizModuleSection[];
  /** Optional header overrides so the same block can render per-track. */
  eyebrow?: string;
  heading?: string;
  blurb?: string;
}

const FR_REVEAL_LABEL = "Here’s a strong answer — how did yours compare?";

/**
 * Econ Quiz Bank (Features 3 & 6). One block per module; a block's questions
 * unlock once the matching module is completed. Multiple choice is auto-checked
 * and tracked as a score (split by difficulty); free response is self-checked
 * against a model answer. Once every MC question is answered, Review Mode shows
 * every question, the student's answer, the correct answer, and the explanation.
 */
export default function EconQuiz({ sections, eyebrow = "Econ Quiz", heading = "Test what you know.", blurb }: Props) {
  return (
    <section style={{ marginBottom: 40 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 8 }}>
        {eyebrow}
      </span>
      <h2 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,3.4vw,38px)", lineHeight: 0.96, letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
        {heading}
      </h2>
      <p style={{ margin: "0 0 18px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 580 }}>
        {blurb ?? "Plain-language economics — no sports needed. Finish a module to unlock its twelve questions. Multiple choice is checked for you; written answers come with a model answer to compare against."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sections.map((s) => (
          <QuizModuleBlock key={s.moduleOrdinal} section={s} />
        ))}
      </div>
    </section>
  );
}

function QuizModuleBlock({ section }: { section: QuizModuleSection }) {
  const accent = section.unlocked ? "var(--bow-blue)" : "var(--bow-inactive)";
  const [reviewing, setReviewing] = useState(false);
  const tiers = section.mcByDifficulty.filter((t) => t.total > 0);
  const tierName = (d: number) => (d === 1 ? "Easy" : d === 2 ? "Medium" : "Hard");

  return (
    <div
      style={{
        background: section.unlocked ? "var(--bow-white)" : "var(--bow-paper)",
        border: "1px solid var(--border-rule)",
        borderLeft: `4px solid ${accent}`,
        borderRadius: 6,
        padding: "clamp(18px,2.5vw,24px)",
        opacity: section.unlocked ? 1 : 0.75,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", flexShrink: 0 }}>
            M{String(section.moduleOrdinal).padStart(2, "0")}
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(17px,2.2vw,22px)", textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
            {section.moduleTitle}
          </span>
        </div>
        {section.unlocked ? (
          <span style={{ display: "flex", gap: 14, flexWrap: "wrap", fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--bow-slate)" }}>
            <span style={{ color: section.mcCorrect === section.mcTotal && section.mcTotal > 0 ? "var(--bow-positive)" : "var(--bow-ink)" }}>
              MC · {section.mcCorrect} of {section.mcTotal} correct
            </span>
            <span style={{ color: section.frSubmitted === section.frTotal && section.frTotal > 0 ? "var(--bow-positive)" : "var(--bow-ink)" }}>
              Written · {section.frSubmitted} of {section.frTotal} submitted
            </span>
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-inactive)" }}>
            <span aria-hidden style={{ fontSize: 13 }}>🔒</span> Locked
          </span>
        )}
      </div>

      {!section.unlocked ? (
        <p style={{ margin: "12px 0 0", display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>
          {section.lockedReason}
        </p>
      ) : (
        <>
          {/* Difficulty breakdown + Review Mode toggle */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            {tiers.length > 0 && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontFamily: "var(--font-data)", fontSize: 11.5 }}>
                {tiers.map((t) => {
                  const full = t.correct === t.total;
                  return (
                    <span key={t.difficulty} style={{ color: full ? "var(--bow-positive)" : "var(--bow-slate)" }}>
                      {tierName(t.difficulty)}: {t.correct}/{t.total}
                    </span>
                  );
                })}
              </div>
            )}
            {section.mcAllAnswered && (
              <button
                onClick={() => setReviewing((r) => !r)}
                style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", padding: "7px 14px", border: "1px solid var(--border-strong)", background: reviewing ? "var(--bow-ink)" : "transparent", color: reviewing ? "#fff" : "var(--bow-ink)", borderRadius: 4, cursor: "pointer" }}
              >
                {reviewing ? "Exit Review" : "Review Answers"}
              </button>
            )}
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-rule)", display: "flex", flexDirection: "column", gap: 14 }}>
            {reviewing
              ? section.questions.map((q, i) => <ReviewCard key={q.id} question={q} number={i + 1} />)
              : section.questions.map((q, i) => <QuizQuestionCard key={q.id} question={q} number={i + 1} />)}
          </div>
        </>
      )}
    </div>
  );
}

/** Read-only Review Mode card — question, your answer, correct answer, explanation. */
function ReviewCard({ question, number }: { question: QuizQuestionView; number: number }) {
  const typeLabel = question.type === "mc" ? "Multiple choice" : "Written answer";
  const yourChoice = question.selectedChoice;
  const correct = question.correctAnswer;
  const choiceText = (key: string | null) => question.choices.find((c) => c.key === key)?.text ?? "—";
  const wasCorrect = question.isCorrect;

  return (
    <div style={{ border: "1px solid var(--border-rule)", borderRadius: 5, padding: "clamp(14px,2vw,18px)", background: "var(--bow-paper)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>Q{number}</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{typeLabel}</span>
        </span>
        <DifficultyDots difficulty={question.difficulty} />
      </div>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15.5, lineHeight: 1.45, color: "var(--bow-ink)" }}>
        {question.question}
      </p>

      {question.type === "mc" ? (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: wasCorrect ? "var(--bow-positive)" : "var(--bow-negative)" }}>
            Your answer: <strong>{yourChoice ?? "—"}</strong> · {choiceText(yourChoice)} {wasCorrect ? "✓" : "✕"}
          </span>
          {!wasCorrect && (
            <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-positive)" }}>
              Correct answer: <strong>{correct ?? "—"}</strong> · {choiceText(correct)}
            </span>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Your answer</span>
          <p style={{ margin: "4px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-ink)", whiteSpace: "pre-wrap" }}>
            {question.responseText?.trim() ? question.responseText : "Not answered yet."}
          </p>
        </div>
      )}

      {question.explanation && (
        <div style={{ marginTop: 10, border: "1px solid var(--border-rule)", borderTop: "3px solid var(--bow-positive)", background: "var(--bow-white)", borderRadius: 4, padding: "10px 12px" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-positive)" }}>
            {question.type === "mc" ? "Why" : "Model answer"}
          </span>
          <p style={{ margin: "5px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: "var(--bow-ink)" }}>{question.explanation}</p>
        </div>
      )}
    </div>
  );
}

function QuizQuestionCard({ question, number }: { question: QuizQuestionView; number: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);

  // Answered either on a prior visit (server) or just now (local result).
  const answered = question.answered || result !== null;

  const submit = async (payload: { selectedChoice?: string | null; responseText?: string | null }) => {
    if (submitting) return;
    setSubmitting(true);
    const res = await submitQuizResponse(question.id, payload.selectedChoice ?? null, payload.responseText ?? null);
    setSubmitting(false);
    if (res.ok) {
      setResult(res);
      startTransition(() => router.refresh());
    }
  };

  const typeLabel = question.type === "mc" ? "Multiple choice" : "Written answer";

  return (
    <div style={{ border: "1px solid var(--border-rule)", borderRadius: 5, padding: "clamp(14px,2vw,18px)", background: "var(--bow-paper)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", flexShrink: 0 }}>Q{number}</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{typeLabel}</span>
        </span>
        <DifficultyDots difficulty={question.difficulty} />
      </div>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15.5, lineHeight: 1.45, color: "var(--bow-ink)" }}>
        {question.question}
      </p>

      {question.type === "mc"
        ? <MultipleChoice question={question} answered={answered} result={result} choice={choice} setChoice={setChoice} submitting={submitting} onSubmit={() => choice && submit({ selectedChoice: choice })} />
        : <FreeResponse question={question} answered={answered} result={result} text={text} setText={setText} submitting={submitting} onSubmit={() => text.trim() && submit({ responseText: text })} />}
    </div>
  );
}

function MultipleChoice({
  question, answered, result, choice, setChoice, submitting, onSubmit,
}: {
  question: QuizQuestionView;
  answered: boolean;
  result: QuizSubmitResult | null;
  choice: string | null;
  setChoice: (c: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  // Reveal data comes from the server (prior visit) or this session's result.
  const correctAnswer = question.correctAnswer ?? result?.correctAnswer ?? null;
  const selected = question.selectedChoice ?? choice;
  const isCorrect = question.isCorrect ?? (result ? result.isCorrect ?? null : null);
  const explanation = question.explanation ?? result?.explanation ?? null;

  return (
    <>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {question.choices.map((c) => {
          const picked = selected === c.key;
          const isAnswerKey = answered && correctAnswer === c.key;
          const pickedWrong = answered && picked && correctAnswer !== c.key;
          const border = isAnswerKey ? "var(--bow-positive)" : pickedWrong ? "var(--bow-negative)" : picked ? "var(--bow-blue)" : "var(--border-rule)";
          const bg = isAnswerKey ? "var(--bow-positive-tint)" : pickedWrong ? "var(--bow-negative-tint)" : picked && !answered ? "var(--bow-blue-tint)" : "var(--bow-white)";
          return (
            <button
              key={c.key}
              type="button"
              disabled={answered || submitting}
              onClick={() => setChoice(c.key)}
              style={{
                textAlign: "left",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                border: `1px solid ${border}`,
                background: bg,
                borderRadius: 4,
                padding: "10px 12px",
                cursor: answered ? "default" : "pointer",
                fontFamily: "var(--font-interface)",
                fontSize: 14,
                lineHeight: 1.45,
                color: "var(--bow-ink)",
              }}
            >
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 700, color: isAnswerKey ? "var(--bow-positive)" : pickedWrong ? "var(--bow-negative)" : "var(--bow-slate)", flexShrink: 0 }}>
                {c.key}
              </span>
              <span>{c.text}</span>
              {isAnswerKey && <span style={{ marginLeft: "auto", color: "var(--bow-positive)" }}>✓</span>}
              {pickedWrong && <span style={{ marginLeft: "auto", color: "var(--bow-negative)" }}>✕</span>}
            </button>
          );
        })}
      </div>

      {!answered ? (
        <button
          onClick={onSubmit}
          disabled={!choice || submitting}
          style={{ marginTop: 12, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 18px", border: "none", background: !choice || submitting ? "var(--bow-inactive)" : "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: !choice || submitting ? "not-allowed" : "pointer" }}
        >
          {submitting ? "Checking…" : "Submit Answer"}
        </button>
      ) : (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: isCorrect ? "var(--bow-positive)" : "var(--bow-negative)" }}>
            {isCorrect ? "Correct" : "Not quite"}
          </span>
          {explanation && (
            <p style={{ margin: "7px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: "var(--bow-ink)" }}>
              {explanation}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function FreeResponse({
  question, answered, result, text, setText, submitting, onSubmit,
}: {
  question: QuizQuestionView;
  answered: boolean;
  result: QuizSubmitResult | null;
  text: string;
  setText: (t: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const modelAnswer = question.explanation ?? result?.explanation ?? null;
  const savedResponse = question.responseText ?? (result ? text : "");

  if (answered) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 4, padding: "10px 12px" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Your answer</span>
          <p style={{ margin: "5px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-ink)", whiteSpace: "pre-wrap" }}>{savedResponse}</p>
        </div>
        {modelAnswer && (
          <div style={{ marginTop: 10, border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-positive)", background: "var(--bow-white)", borderRadius: 4, padding: "12px 14px" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-positive)" }}>{FR_REVEAL_LABEL}</span>
            <p style={{ margin: "7px 0 0", fontFamily: "var(--font-editorial)", fontSize: 15, lineHeight: 1.55, color: "var(--bow-ink)" }}>{modelAnswer}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        aria-label={`Your written answer to question: ${question.question}`}
        placeholder="Write your answer here…"
        style={{ width: "100%", marginTop: 12, background: "var(--bow-white)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "10px 12px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, resize: "vertical", outline: "none" }}
      />
      <button
        onClick={onSubmit}
        disabled={!text.trim() || submitting}
        style={{ marginTop: 12, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", padding: "10px 18px", border: "none", background: !text.trim() || submitting ? "var(--bow-inactive)" : "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: !text.trim() || submitting ? "not-allowed" : "pointer" }}
      >
        {submitting ? "Saving…" : "Submit Answer"}
      </button>
    </>
  );
}
