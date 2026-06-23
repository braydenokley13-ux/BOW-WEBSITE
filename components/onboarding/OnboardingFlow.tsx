"use client";

import { useState, useTransition } from "react";
import type { CSSProperties } from "react";
import type { BowRank } from "@/lib/scoring";
import { completeOnboarding } from "@/app/actions/onboarding";

interface Props {
  firstName: string;
  /** The rank ladder, lowest → highest. The first entry is the student's current rank. */
  ranks: BowRank[];
  /** Title of Track 101, Module 1 ("What Is Economics?"). */
  firstModuleTitle: string;
}

const TOTAL_STEPS = 4;

/* ---------------- shared style tokens (match the design system) ---------------- */

const eyebrow: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
};

const cardStyle: CSSProperties = {
  background: "var(--bow-white)",
  border: "1px solid var(--border-rule)",
  borderRadius: 6,
  padding: 24,
};

const headingStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 900,
  fontSize: "clamp(30px,4.5vw,52px)",
  lineHeight: 0.94,
  letterSpacing: "-0.02em",
  textTransform: "uppercase",
  color: "var(--bow-ink)",
};

const bodyStyle: CSSProperties = {
  fontFamily: "var(--font-interface)",
  fontSize: 16,
  lineHeight: 1.6,
  color: "var(--bow-slate)",
};

const primaryButton: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "14px 28px",
  border: "none",
  background: "var(--bow-blue)",
  color: "var(--bow-white)",
  borderRadius: 4,
  cursor: "pointer",
};

export default function OnboardingFlow({ firstName, ranks, firstModuleTitle }: Props) {
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // The final screen completes onboarding — the server action sets the flag and
  // redirects to /dashboard, so there's no client-side navigation here.
  const finish = () => {
    if (pending) return;
    startTransition(async () => {
      await completeOnboarding();
    });
  };

  return (
    <div
      style={{
        background: "var(--bow-paper)",
        minHeight: "100vh",
        padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* PROGRESS — visible on every screen */}
        <ProgressIndicator step={step} />

        {step === 0 && <WelcomeScreen firstName={firstName} onNext={goNext} />}
        {step === 1 && <HowItWorksScreen onNext={goNext} onBack={goBack} />}
        {step === 2 && <RankScreen ranks={ranks} onNext={goNext} onBack={goBack} />}
        {step === 3 && (
          <FirstStepScreen
            firstModuleTitle={firstModuleTitle}
            onBack={goBack}
            onFinish={finish}
            pending={pending}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- progress ---------------- */

function ProgressIndicator({ step }: { step: number }) {
  const current = step + 1;
  const pct = Math.round((current / TOTAL_STEPS) * 100);
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <span style={eyebrow}>Getting started</span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-ink)" }}>
          Step {current} of {TOTAL_STEPS}
        </span>
      </div>
      {/* 4-segment progress bar */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Step ${current} of ${TOTAL_STEPS}`}
        style={{ display: "flex", gap: 6 }}
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              background: i <= step ? "var(--bow-blue)" : "var(--bow-inactive)",
              transition: "background var(--dur-card) var(--ease-out)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------- step navigation footer ---------------- */

function StepNav({
  onBack,
  primaryLabel,
  onPrimary,
  pending,
}: {
  onBack?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  pending?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11.5,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--bow-slate)",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          ← Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onPrimary}
        disabled={pending}
        style={{
          ...primaryButton,
          background: pending ? "var(--bow-inactive)" : "var(--bow-blue)",
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {primaryLabel}
      </button>
    </div>
  );
}

/* ---------------- screen 1: welcome ---------------- */

function WelcomeScreen({ firstName, onNext }: { firstName: string; onNext: () => void }) {
  return (
    <div style={cardStyle}>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: "clamp(20px,3vw,28px)",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: "var(--bow-blue)",
          display: "block",
        }}
      >
        BOW Sports Capital
      </span>
      <h1 style={{ ...headingStyle, margin: "12px 0 14px" }}>Welcome, {firstName}.</h1>
      <p style={{ ...bodyStyle, margin: 0, maxWidth: 560 }}>
        Welcome to BOW Sports Capital. You&rsquo;re about to learn how the business of sports actually works
        &mdash; salary caps, draft economics, revenue, analytics &mdash; through real decisions, real
        simulations, and real economic concepts. Not textbooks. Front office thinking.
      </p>
      <StepNav primaryLabel="Let's go" onPrimary={onNext} />
    </div>
  );
}

/* ---------------- screen 2: how it works ---------------- */

const HOW_IT_WORKS: { title: string; body: string; accent: string }[] = [
  {
    title: "4 Modules per Track",
    body: "Each module unlocks the next after you finish it and write a short reflection.",
    accent: "var(--bow-blue)",
  },
  {
    title: "BOW Daily",
    body: "A weekly real-world sports scenario you respond to.",
    accent: "var(--bow-orange)",
  },
  {
    title: "Simulation Room",
    body: "A turn-based game where you run a team and every choice teaches an economic concept.",
    accent: "var(--bow-positive)",
  },
];

function HowItWorksScreen({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <span style={eyebrow}>How it works</span>
      <h1 style={{ ...headingStyle, margin: "8px 0 18px", fontSize: "clamp(26px,4vw,44px)" }}>
        Three ways you&rsquo;ll learn.
      </h1>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {HOW_IT_WORKS.map((c) => (
          <div
            key={c.title}
            style={{
              ...cardStyle,
              borderTop: `4px solid ${c.accent}`,
              flex: "1 1 200px",
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "clamp(17px,2.2vw,21px)",
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                color: "var(--bow-ink)",
                display: "block",
              }}
            >
              {c.title}
            </span>
            <p
              style={{
                margin: "10px 0 0",
                fontFamily: "var(--font-interface)",
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--bow-slate)",
              }}
            >
              {c.body}
            </p>
          </div>
        ))}
      </div>
      <StepNav onBack={onBack} primaryLabel="Next" onPrimary={onNext} />
    </div>
  );
}

/* ---------------- screen 3: your rank (skill tree) ---------------- */

function RankScreen({ ranks, onNext, onBack }: { ranks: BowRank[]; onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <span style={eyebrow}>Your rank</span>
      <h1 style={{ ...headingStyle, margin: "8px 0 8px", fontSize: "clamp(26px,4vw,44px)" }}>
        Climb the ladder.
      </h1>
      <p style={{ ...bodyStyle, margin: "0 0 22px", fontSize: 15, maxWidth: 520 }}>
        You start as a Rookie. Finish modules, earn your certificate, and unlock the ranks above &mdash; one
        good decision at a time.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {ranks.map((rank, i) => {
          const isCurrent = i === 0;
          const isLast = i === ranks.length - 1;
          return (
            <div key={rank.key} style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
              {/* rail: node + connector */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    flexShrink: 0,
                    background: isCurrent ? "var(--bow-blue)" : "var(--bow-paper)",
                    border: `2px solid ${isCurrent ? "var(--bow-blue)" : "var(--bow-inactive)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                  }}
                  aria-hidden
                >
                  {isCurrent ? (
                    <span style={{ color: "var(--bow-white)", fontSize: 12, lineHeight: 1 }}>★</span>
                  ) : (
                    <span style={{ color: "var(--bow-inactive)", fontSize: 10, lineHeight: 1 }}>🔒</span>
                  )}
                </div>
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 22,
                      background: "var(--border-rule)",
                    }}
                  />
                )}
              </div>

              {/* rank card */}
              <div
                style={{
                  ...cardStyle,
                  flex: 1,
                  marginBottom: isLast ? 0 : 14,
                  padding: "16px 18px",
                  borderLeft: `4px solid ${isCurrent ? "var(--bow-blue)" : "var(--bow-inactive)"}`,
                  opacity: isCurrent ? 1 : 0.6,
                  background: isCurrent ? "var(--bow-white)" : "var(--bow-paper)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 800,
                      fontSize: "clamp(18px,2.4vw,24px)",
                      textTransform: "uppercase",
                      letterSpacing: "-0.01em",
                      color: isCurrent ? "var(--bow-ink)" : "var(--bow-inactive)",
                    }}
                  >
                    {rank.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10.5,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: isCurrent ? "var(--bow-blue)" : "var(--bow-inactive)",
                      flexShrink: 0,
                    }}
                  >
                    {isCurrent ? "You are here" : "Locked"}
                  </span>
                </div>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontFamily: "var(--font-interface)",
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    color: isCurrent ? "var(--bow-slate)" : "var(--bow-inactive)",
                  }}
                >
                  {rank.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <StepNav onBack={onBack} primaryLabel="Next" onPrimary={onNext} />
    </div>
  );
}

/* ---------------- screen 4: your first step ---------------- */

function FirstStepScreen({
  firstModuleTitle,
  onBack,
  onFinish,
  pending,
}: {
  firstModuleTitle: string;
  onBack: () => void;
  onFinish: () => void;
  pending: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bow-ink)",
        color: "var(--bow-white)",
        borderRadius: 6,
        borderTop: "4px solid var(--bow-blue)",
        padding: "clamp(24px,3.5vw,36px)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--bow-positive)",
        }}
      >
        Module 1 · Unlocked
      </span>
      <h1
        style={{
          margin: "10px 0 12px",
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: "clamp(28px,4vw,46px)",
          lineHeight: 0.96,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
        }}
      >
        Your first step.
      </h1>
      <p
        style={{
          margin: "0 0 24px",
          fontFamily: "var(--font-interface)",
          fontSize: 16,
          lineHeight: 1.6,
          color: "var(--bow-slate)",
          maxWidth: 520,
        }}
      >
        Module 1 is unlocked and ready. Your first lesson:{" "}
        <strong style={{ color: "var(--bow-white)" }}>{firstModuleTitle}</strong>. Let&rsquo;s start.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onFinish}
          disabled={pending}
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            padding: "16px 36px",
            border: "none",
            background: pending ? "var(--bow-inactive)" : "var(--bow-blue)",
            color: "var(--bow-white)",
            borderRadius: 4,
            cursor: pending ? "wait" : "pointer",
          }}
        >
          {pending ? "Starting…" : "Start Module 1"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 11.5,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--bow-slate)",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
