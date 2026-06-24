"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  reflectionWordCount,
  SELF_MIN_REFLECTION_WORDS,
  type DailyScenarioView,
  type QuizModuleSection,
  type SelfModuleView,
} from "@/lib/account";
import type { WeeklyChallengeView } from "@/lib/weekly";
import type { NotificationView } from "@/lib/notifications";
import type { DailyQuestionView } from "@/lib/daily-question";
import { markSelfModuleComplete, saveSelfReflection, generateCertificate } from "@/app/actions/lms";
import EconQuiz from "@/components/selfpaced/EconQuiz";
import DailyScenarios from "@/components/selfpaced/DailyScenarios";
import DailyQuestionCard from "@/components/selfpaced/DailyQuestionCard";
import WeeklyChallenge from "@/components/selfpaced/WeeklyChallenge";
import NotificationBell from "@/components/selfpaced/NotificationBell";

export interface StreakDisplay {
  current: number;
  longest: number;
  label: string | null;
}

export interface TrackData {
  modules: SelfModuleView[];
  quizSections: QuizModuleSection[];
  certificateEarned: boolean;
}

interface Props {
  firstName: string;
  track101: TrackData;
  track201: TrackData;
  dailyQuestion: DailyQuestionView | null;
  streak: StreakDisplay;
  xp: number;
  rankName: string;
  rankKey: string;
  activeScenario: DailyScenarioView | null;
  scenarioArchive: DailyScenarioView[];
  weeklyCurrent: WeeklyChallengeView | null;
  weeklyPast: WeeklyChallengeView[];
  notifications: NotificationView[];
  unreadCount: number;
}

export default function StudentDashboard({
  firstName,
  track101,
  track201,
  dailyQuestion,
  streak,
  xp,
  rankName,
  rankKey,
  activeScenario,
  scenarioArchive,
  weeklyCurrent,
  weeklyPast,
  notifications,
  unreadCount,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Track 201 unlocks (Module 201-1 opens) once the Track 101 certificate is earned.
  const track201Unlocked = track201.modules[0]?.unlocked ?? false;
  // The Track 101 Simulation Room unlocks after Module 2; The Front Office after Module 201-2.
  const simUnlocked = track101.modules.find((m) => m.module.ordinal === 2)?.completed ?? false;
  const frontOfficeUnlocked = track201.modules.find((m) => m.module.ordinal === 2)?.completed ?? false;

  // Quick links live at the bottom of the daily ritual — where students go next.
  const navLinks = [
    ...(simUnlocked ? [{ href: "/simulation-room", label: "Simulation Room" }] : []),
    ...(frontOfficeUnlocked ? [{ href: "/front-office", label: "The Front Office" }] : []),
    { href: "/discussion", label: "Discussion" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/badges", label: "Badges" },
    { href: "/card", label: "My Card" },
    { href: "/news", label: "News" },
    { href: "/glossary", label: "Glossary" },
    { href: "/profile", label: "My Profile" },
  ];
  const rankColor =
    rankKey === "front-office" ? "var(--bow-orange)" : rankKey === "analyst" ? "var(--bow-positive)" : rankKey === "scout" ? "var(--bow-blue)" : "var(--bow-slate)";

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
              Self-Paced · BOW Sports Capital
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", margin: "8px 0 6px" }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
                Good to see you, {firstName}.
              </h1>
              <StreakChip current={streak.current} longest={streak.longest} label={streak.label} />
              <XpChip xp={xp} />
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${rankColor}`, color: rankColor, borderRadius: 999, padding: "5px 13px", fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 999, background: rankColor }} />
                {rankName}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", margin: "2px 0 16px" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 520 }}>
                Answer today&apos;s question, check your BOW Daily, and keep the streak alive — your whole ritual takes under five minutes.
              </p>
              <Link href="/card" style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)", textDecoration: "none", border: "1px solid var(--border-rule)", borderRadius: 999, padding: "7px 14px", whiteSpace: "nowrap" }}>
                View My Card →
              </Link>
            </div>
          </div>
          <div style={{ flexShrink: 0, paddingTop: 4 }}>
            <NotificationBell notifications={notifications} unreadCount={unreadCount} />
          </div>
        </div>

        {/* 1 · DAILY QUESTION — the core retention hook, above everything else */}
        <DailyQuestionCard view={dailyQuestion} streakCurrent={streak.current} />

        {/* 2 · BOW DAILY SCENARIO */}
        <DailyScenarios active={activeScenario} archive={scenarioArchive} />

        {/* 3 · WEEKLY CHALLENGE */}
        <WeeklyChallenge current={weeklyCurrent} past={weeklyPast} />

        {/* 4 · TRACK PROGRESS — two tracks side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 24, marginBottom: 40 }}>
          <TrackColumn
            track="101"
            eyebrow="Track 101 · Rookie GM Economics"
            data={track101}
            unlocked
            firstName={firstName}
            router={router}
            startTransition={startTransition}
          />
          <TrackColumn
            track="201"
            eyebrow="Track 201 · Front Office Fundamentals"
            data={track201}
            unlocked={track201Unlocked}
            firstName={firstName}
            router={router}
            startTransition={startTransition}
          />
        </div>

        {/* 5 · ECON QUIZ — Track 101 always; Track 201 once unlocked */}
        <EconQuiz sections={track101.quizSections} eyebrow="Econ Quiz · Track 101" />
        {track201Unlocked && (
          <EconQuiz
            sections={track201.quizSections}
            eyebrow="Econ Quiz · Track 201"
            heading="The front-office exam."
            blurb="Track 201 questions — cap mechanics, revenue, analytics, and draft economics. Finish a Track 201 module to unlock its twelve questions."
          />
        )}

        {/* 6 · QUICK LINKS — where students go after the daily ritual */}
        <div style={{ borderTop: "1px solid var(--border-rule)", paddingTop: 22, marginTop: 8 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 12 }}>
            Go deeper
          </span>
          <nav style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-ink)", textDecoration: "none", border: "1px solid var(--border-strong)", borderRadius: 999, padding: "8px 16px" }}
              >
                {l.label} →
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

/* ---------------- header chips ---------------- */

/** Streak chip — links to /badges and pulses when the streak just advanced. */
function StreakChip({ current, longest, label }: { current: number; longest: number; label: string | null }) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (prev.current !== null && current > prev.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 3000);
      prev.current = current;
      return () => clearTimeout(t);
    }
    prev.current = current;
  }, [current]);

  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bow-ink)", color: "#fff",
    borderRadius: 999, padding: "6px 14px", fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700,
    letterSpacing: "0.04em", whiteSpace: "nowrap", textDecoration: "none",
  };

  if (!label) {
    return (
      <Link href="/badges" title="See your achievements" style={{ ...base, background: "transparent", color: "var(--bow-ink)", border: "1px solid var(--border-strong)" }}>
        🏅 Achievements
      </Link>
    );
  }
  return (
    <Link
      href="/badges"
      className={pulse ? "bow-streak-pulse" : undefined}
      title={`Current streak: ${current} day${current === 1 ? "" : "s"} · Longest: ${longest} · View badges`}
      style={base}
    >
      {label}
    </Link>
  );
}

/** XP chip — current XP total, linking to the XP leaderboard. */
function XpChip({ xp }: { xp: number }) {
  return (
    <Link
      href="/leaderboard?tab=xp"
      title="Your XP — see the XP leaderboard"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(201,168,76,0.14)", color: "#8a6d1f", border: "1px solid rgba(201,168,76,0.5)", borderRadius: 999, padding: "6px 14px", fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap", textDecoration: "none" }}
    >
      ⚡ {xp.toLocaleString()} XP
    </Link>
  );
}

/* ---------------- track column ---------------- */

function TrackColumn({
  track,
  eyebrow,
  data,
  unlocked,
  firstName,
  router,
  startTransition,
}: {
  track: "101" | "201";
  eyebrow: string;
  data: TrackData;
  unlocked: boolean;
  firstName: string;
  router: ReturnType<typeof useRouter>;
  startTransition: React.TransitionStartFunction;
}) {
  const total = data.modules.length;
  const completedCount = data.modules.filter((m) => m.completed).length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const allDone = total > 0 && completedCount === total;
  const accent = track === "201" ? "var(--bow-orange)" : "var(--bow-blue)";

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: accent }}>
          {eyebrow}
        </span>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
          {completedCount} / {total}
        </span>
      </div>

      {/* progress bar */}
      <div style={{ height: 10, background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ height: "100%", width: `${pct}%`, background: allDone ? "var(--bow-positive)" : accent, transition: "width var(--dur-card) var(--ease-out)" }}
        />
      </div>

      {!unlocked ? (
        <LockedTrack reason={data.modules[0]?.lockedReason ?? "Earn your Track 101 certificate to unlock Track 201."} />
      ) : (
        <>
          {allDone && <CertificatePrompt firstName={firstName} track={track} earned={data.certificateEarned} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.modules.map((m) => (
              <ModuleCard key={m.module.id} view={m} track={track} router={router} startTransition={startTransition} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function LockedTrack({ reason }: { reason: string }) {
  return (
    <div style={{ background: "var(--bow-paper)", border: "1px dashed var(--border-strong)", borderRadius: 6, padding: "clamp(22px,3vw,32px)", textAlign: "center", opacity: 0.85 }}>
      <div aria-hidden style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
      <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
        Track 201 is locked
      </h3>
      <p style={{ margin: "0 auto", maxWidth: 320, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.6, color: "var(--bow-slate)" }}>
        {reason}
      </p>
    </div>
  );
}

/* ---------------- certificate ---------------- */

function CertificatePrompt({ firstName, track, earned }: { firstName: string; track: "101" | "201"; earned: boolean }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const trackLabel = track === "201" ? "Track 201" : "Track 101";

  const onGet = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await generateCertificate(track);
      if (res.ok && res.html && res.filename) {
        const blob = new Blob([res.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setDone(true);
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
    <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, borderTop: "4px solid var(--bow-positive)", padding: "clamp(20px,3vw,28px)", marginBottom: 16 }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5fcf99" }}>
        {trackLabel} · Complete
      </span>
      <h2 style={{ margin: "10px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,3vw,32px)", lineHeight: 0.96, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
        Nicely run, {firstName}.
      </h2>
      <p style={{ margin: "0 0 18px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 520 }}>
        {track === "201"
          ? "You finished all four Front Office Fundamentals modules. Claim your Track 201 certificate."
          : "You finished all four modules and reflected on every one. Claim your certificate — and unlock Track 201."}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={onGet}
          disabled={busy}
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 24px", border: "none", background: busy ? "var(--bow-inactive)" : "var(--bow-positive)", color: "#fff", borderRadius: 4, cursor: busy ? "wait" : "pointer" }}
        >
          {busy ? "Generating…" : earned ? "Download Again" : "Download My Certificate"}
        </button>
        <a
          href={track === "201" ? "/dashboard/certificate?track=201" : "/dashboard/certificate"}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 24px", border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "#fff", borderRadius: 4, cursor: "pointer", textDecoration: "none" }}
        >
          View &amp; Print
        </a>
      </div>
      {done && (
        <p style={{ margin: "14px 0 0", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#5fcf99" }}>
          ✓ Downloaded. Open the file to print it or save it as a PDF.
        </p>
      )}
      {error && (
        <p style={{ margin: "14px 0 0", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-warning)" }}>
          Something went wrong generating your certificate. Please try again.
        </p>
      )}
    </div>
  );
}

/* ---------------- module card ---------------- */

function ModuleCard({
  view,
  track,
  router,
  startTransition,
}: {
  view: SelfModuleView;
  track: "101" | "201";
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
  const moduleTag = track === "201" ? `201-${m.ordinal}` : `M${String(m.ordinal).padStart(2, "0")}`;

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
            {moduleTag}
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(17px,2.2vw,22px)", textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>
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
