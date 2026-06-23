"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  reflectionWordCount,
  SELF_MIN_REFLECTION_WORDS,
  type FeedStory,
  type SelfModuleView,
} from "@/lib/account";
import {
  markSelfModuleComplete,
  saveSelfReflection,
  submitDailyDecision,
} from "@/app/actions/lms";

interface Props {
  firstName: string;
  modules: SelfModuleView[];
  stories: FeedStory[];
  /** storyId -> the student's saved decision response. */
  answered: Record<string, string>;
}

export default function StudentDashboard({ firstName, modules, stories, answered }: Props) {
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
          Six modules, unlocked one decision at a time. Finish a module and write a short reflection to open the next.
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
          The six modules
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 40 }}>
          {modules.map((m) => (
            <ModuleCard key={m.module.id} view={m} router={router} startTransition={startTransition} />
          ))}
        </div>

        {/* BOW DAILY */}
        <DailyFeed stories={stories} answered={answered} router={router} startTransition={startTransition} />
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
        You finished all six modules and reflected on every one. Claim your certificate of completion.
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

/* ---------------- BOW Daily feed ---------------- */

function DailyFeed({
  stories,
  answered,
  router,
  startTransition,
}: {
  stories: FeedStory[];
  answered: Record<string, string>;
  router: ReturnType<typeof useRouter>;
  startTransition: React.TransitionStartFunction;
}) {
  const ordered = useMemo(() => [...stories].sort((a, b) => a.ordinal - b.ordinal), [stories]);
  const [localResponses, setLocalResponses] = useState<Record<string, string>>({});

  const responses: Record<string, string> = { ...answered, ...localResponses };
  const isAnswered = (id: string) => id in responses;
  const next = ordered.find((s) => !isAnswered(s.id)) ?? null;
  const past = ordered.filter((s) => isAnswered(s.id));

  // Advancing moves the answered story into the history and reveals the next
  // briefing as a fresh card (the key on <DailyCard> remounts it).
  const onAdvance = (storyId: string, text: string) => {
    setLocalResponses((prev) => ({ ...prev, [storyId]: text }));
    startTransition(() => router.refresh());
  };

  return (
    <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, padding: "clamp(22px,3.2vw,34px)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          BOW Daily
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6d7078" }}>
          {past.length} / {ordered.length} decisions made
        </span>
      </div>
      <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,3.4vw,38px)", lineHeight: 0.96, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
        Your sports-business briefing.
      </h2>
      <p style={{ margin: "0 0 22px", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 540 }}>
        One real situation a week. Read it, make the call, then see what actually happened and the economics behind it.
      </p>

      {next ? (
        <DailyCard key={next.id} story={next} onAdvance={onAdvance} hasMore={past.length + 1 < ordered.length} />
      ) : (
        <div style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", borderRadius: 4, padding: "20px 22px" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-positive)" }}>
            You’re all caught up
          </span>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "#b9bcc4" }}>
            You’ve made the call on every briefing so far. Check back next week for the next one.
          </p>
        </div>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078", display: "block", marginBottom: 12 }}>
            Decisions you’ve made
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {past.map((s) => (
              <RevealedCard key={s.id} story={s} response={responses[s.id]} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DailyCard({
  story,
  onAdvance,
  hasMore,
}: {
  story: FeedStory;
  onAdvance: (id: string, text: string) => void;
  hasMore: boolean;
}) {
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reveal, setReveal] = useState(false);

  const onSubmit = async () => {
    if (!response.trim() || submitting) return;
    setSubmitting(true);
    const res = await submitDailyDecision(story.id, response);
    setSubmitting(false);
    if (res.ok) setReveal(true);
  };

  return (
    <article style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", borderTop: "4px solid var(--bow-orange)", borderRadius: 4, padding: "clamp(20px,3vw,28px)" }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
        This week’s briefing
      </span>
      <h3 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,3.2vw,34px)", lineHeight: 0.96, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
        {story.headline}
      </h3>
      <p style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontSize: "clamp(15.5px,1.7vw,18px)", lineHeight: 1.5, color: "#d4d6db" }}>
        {story.framing}
      </p>

      {!reveal ? (
        <>
          <div style={{ marginTop: 20, borderLeft: "4px solid var(--bow-blue)", paddingLeft: 16 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6f8bff" }}>Your decision</span>
            <p style={{ margin: "6px 0 0", fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: "clamp(15px,1.5vw,17px)", lineHeight: 1.45, color: "#fff" }}>
              {story.prompt}
            </p>
          </div>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={3}
            placeholder="Make your call — a sentence or two on what you'd do."
            style={{ width: "100%", marginTop: 14, background: "var(--bow-ink)", border: "1px solid var(--bow-dark-border)", color: "#fff", padding: "12px 14px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, resize: "vertical", outline: "none" }}
          />
          <button
            onClick={onSubmit}
            disabled={!response.trim() || submitting}
            style={{ marginTop: 14, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 24px", border: "none", background: !response.trim() || submitting ? "var(--bow-inactive)" : "var(--bow-orange)", color: "#fff", borderRadius: 4, cursor: !response.trim() || submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Locking it in…" : "Submit Decision"}
          </button>
        </>
      ) : (
        <>
          <Reveal story={story} response={response} />
          <button
            onClick={() => onAdvance(story.id, response.trim())}
            style={{ marginTop: 18, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 24px", border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: "pointer" }}
          >
            {hasMore ? "Next Briefing →" : "Done for Now →"}
          </button>
        </>
      )}
    </article>
  );
}

function RevealedCard({ story, response }: { story: FeedStory; response: string }) {
  return (
    <article style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", borderRadius: 4, padding: "clamp(18px,2.4vw,24px)" }}>
      <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(17px,2.2vw,22px)", lineHeight: 1.02, letterSpacing: "-0.01em", textTransform: "uppercase", color: "#fff" }}>
        {story.headline}
      </h3>
      <Reveal story={story} response={response} compact />
    </article>
  );
}

function Reveal({ story, response, compact = false }: { story: FeedStory; response: string; compact?: boolean }) {
  return (
    <div style={{ marginTop: compact ? 12 : 20 }}>
      <div style={{ background: "var(--bow-ink)", border: "1px solid var(--bow-dark-border)", borderRadius: 4, padding: "12px 14px" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Your call</span>
        <p style={{ margin: "5px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "#d4d6db", whiteSpace: "pre-wrap" }}>{response}</p>
      </div>
      <div style={{ marginTop: 12, border: "1px solid var(--bow-dark-border)", borderTop: "4px solid var(--bow-positive)", background: "var(--bow-dark-surface)", borderRadius: 4, padding: "14px 16px" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-positive)" }}>What actually happened</span>
        <p style={{ margin: "7px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "#fff" }}>{story.outcome}</p>
      </div>
      <div style={{ marginTop: 12, background: "var(--bow-ink)", border: "1px solid var(--bow-dark-border)", borderRadius: 4, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>The economics</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "#0a0a0b", background: "var(--bow-orange)", padding: "3px 9px", borderRadius: 3 }}>{story.concept}</span>
        </div>
        <p style={{ margin: "9px 0 0", fontFamily: "var(--font-editorial)", fontSize: 15.5, lineHeight: 1.55, color: "#d4d6db" }}>{story.explanation}</p>
      </div>
    </div>
  );
}
