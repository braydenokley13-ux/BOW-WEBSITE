"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WeeklyChallengeView } from "@/lib/weekly";
import { submitWeeklyChallenge } from "@/app/actions/weekly";

interface Props {
  current: WeeklyChallengeView | null;
  past: WeeklyChallengeView[];
}

/**
 * Weekly Challenge (Feature 4). One harder, multi-part challenge per week,
 * combining concepts across both tracks. The current challenge is submittable
 * (and earns a Weekly Finisher badge); past challenges are view-only.
 */
export default function WeeklyChallenge({ current, past }: Props) {
  if (!current && past.length === 0) return null;
  return (
    <section style={{ marginBottom: 40 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 8 }}>
        Weekly Challenge
      </span>
      <h2 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,3.4vw,38px)", lineHeight: 0.96, letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
        One big call a week.
      </h2>
      <p style={{ margin: "0 0 18px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 580 }}>
        A harder, multi-part challenge that pulls together everything across both tracks. Submit before the week ends to earn the Weekly Finisher badge.
      </p>

      {current && <CurrentChallenge challenge={current} />}

      {past.length > 0 && <PastChallenges past={past} />}
    </section>
  );
}

function CurrentChallenge({ challenge }: { challenge: WeeklyChallengeView }) {
  const router = useRouter();
  const [draft, setDraft] = useState(challenge.response ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const onSubmit = async () => {
    if (busy || draft.trim() === "") return;
    setBusy(true);
    setError(null);
    const res = await submitWeeklyChallenge(challenge.id, draft);
    setBusy(false);
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      setError(res.error === "closed" ? "This challenge has closed." : "Add a response first.");
    }
  };

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderLeft: "4px solid var(--bow-orange)", borderRadius: 6, padding: "clamp(18px,2.5vw,24px)", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--bow-orange)" }} />
          This week · open through Saturday
        </span>
        {challenge.completed && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-positive)" }}>
            ✓ Weekly Finisher
          </span>
        )}
      </div>
      <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px,2.4vw,24px)", textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
        {challenge.title}
      </h3>
      <p style={{ margin: "0 0 16px", fontFamily: "var(--font-editorial)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-ink)" }}>
        {challenge.prompt}
      </p>

      {challenge.completed ? (
        <div style={{ background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 4, padding: "12px 14px" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 6 }}>
            Your response
          </span>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-ink)", whiteSpace: "pre-wrap" }}>
            {challenge.response}
          </p>
        </div>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            placeholder="Work through every part of the prompt. Show your reasoning like a front office would."
            style={{ width: "100%", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "12px 14px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, resize: "vertical", outline: "none" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: error ? "var(--bow-warning)" : "var(--bow-slate)" }}>
              {error ?? "Worth +25 BOW Score."}
            </span>
            <button
              onClick={onSubmit}
              disabled={busy || draft.trim() === ""}
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "11px 22px", border: "none", background: busy || draft.trim() === "" ? "var(--bow-inactive)" : "var(--bow-orange)", color: "#fff", borderRadius: 4, cursor: busy || draft.trim() === "" ? "not-allowed" : "pointer" }}
            >
              {busy ? "Submitting…" : "Submit Challenge"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PastChallenges({ past }: { past: WeeklyChallengeView[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: "1px solid var(--border-rule)", borderRadius: 6, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--bow-paper)", border: "none", padding: "14px 18px", cursor: "pointer" }}
      >
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Past Challenges ({past.length})
        </span>
        <span aria-hidden style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)" }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--border-rule)" }}>
          {past.map((c) => (
            <div key={c.id} style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-rule)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
                  {c.title}
                </span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: c.completed ? "var(--bow-positive)" : "var(--bow-slate)" }}>
                  {c.completed ? "✓ Completed" : "Closed"}
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
                {c.prompt}
              </p>
              {c.completed && c.response && (
                <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.6, color: "var(--bow-ink)", borderLeft: "2px solid var(--border-rule)", paddingLeft: 12, whiteSpace: "pre-wrap" }}>
                  {c.response}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
