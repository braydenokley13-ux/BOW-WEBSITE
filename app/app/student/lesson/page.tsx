"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/app/AppState";
import {
  trackLessons,
  lessonProgressLabel,
  unlockChecklist,
  reflectionWordCount,
  MIN_REFLECTION_WORDS,
  PODCAST_UNLOCK_THRESHOLD,
  type LessonProgressDetail,
} from "@/lib/account";
import { getLessonById } from "@/lib/lessons";
import { podcastAllEpisodes, podTakeaways } from "@/lib/podcast";
import PodcastPlayer from "@/components/site/PodcastPlayer";
import styles from "../../portal-accessibility.module.css";

export default function StudentLessonPage() {
  const {
    me,
    selectedLessonId,
    getCohort,
    activeEnrollmentFor,
    cohortCurrentLessonId,
    lessonProgressFor,
    startLesson,
    setSimulationDone,
    setChallengeDone,
    completeLesson,
    recordPodcastProgress,
    checkAndUnlockNextLesson,
    saveReflectionAndCheck,
  } = useAppState();
  const enr = activeEnrollmentFor(me.id);
  const cohort = enr ? getCohort(enr.cohortId) : null;

  const lessons = cohort ? trackLessons(cohort.track) : [];
  const curId = cohort ? cohortCurrentLessonId(cohort) : null;
  const lid = selectedLessonId ?? curId ?? lessons[0]?.id ?? "t101-m2-l1";
  const L = getLessonById(lid);

  const prog = lessonProgressFor(me.id, lid);
  const [reflection, setReflection] = useState(prog?.reflection ?? "");
  // Local podcast fraction so the checklist reflects playback before a refresh.
  const [podLocal, setPodLocal] = useState(prog?.podcastProgress ?? 0);
  // Tracks which lesson id the unlock threshold was last persisted for, so
  // switching lessons doesn't require mutating the ref during render (refs
  // may only be read/written in event handlers and effects, not render).
  const podPersistedForLid = useRef<string | null>(null);
  // The case file isn't persisted per-choice (lesson_progress only stores a
  // done flag) — this local pick just proves the student actually opened the
  // case and chose an option, rather than blindly checking a box.
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [caseOpen, setCaseOpen] = useState(false);

  // `lid` can change in place (e.g. an instructor advances the cohort's
  // current lesson while this tab stays open) without a route change or
  // remount, so this local, per-lesson draft state has to be reset by hand
  // whenever the lesson id changes — otherwise a previous lesson's reflection
  // draft, podcast position, or case-file selection bleeds into the new one.
  // Adjusting state during render (not an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevLid, setPrevLid] = useState(lid);
  if (lid !== prevLid) {
    setPrevLid(lid);
    setReflection(prog?.reflection ?? "");
    setPodLocal(prog?.podcastProgress ?? 0);
    setSelectedOption(null);
    setCaseOpen(false);
  }

  if (!cohort || !L) {
    return (
      <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <p style={{ fontFamily: "var(--font-interface)", fontSize: 16, color: "var(--bow-slate)" }}>This lesson isn’t available yet.</p>
        </div>
      </div>
    );
  }

  // Self-paced frontier: accessible up to the GREATER of the cohort's current
  // lesson and the student's own auto-unlocked lesson.
  const lessonIdx = lessons.findIndex((l) => l.id === lid);
  const curIdx = lessons.findIndex((l) => l.id === curId);
  const selfIdx = enr?.unlockedLessonId ? lessons.findIndex((l) => l.id === enr.unlockedLessonId) : -1;
  const frontierIdx = Math.max(curIdx, selfIdx);
  const inDev = L.status === "in-development" || L.status === "coming-soon";
  const locked = inDev || lessonIdx > frontierIdx;
  const status = prog?.status ?? "not-started";
  const completed = status === "completed";

  const primaryLabel = completed ? "Review Lesson" : status === "in-progress" ? "Continue Lesson" : "Start Lesson";

  // A live view of progress that folds in local podcast playback + reflection draft.
  const liveDetail: LessonProgressDetail = {
    status,
    simulationDone: !!prog?.simulationDone,
    reflection: reflection || prog?.reflection || "",
    challengeDone: !!prog?.challengeDone,
    podcastProgress: Math.max(prog?.podcastProgress ?? 0, podLocal),
    startedAt: prog?.startedAt ?? null,
    completedAt: prog?.completedAt ?? null,
  };
  const check = unlockChecklist(liveDetail);
  const liveWords = reflectionWordCount(reflection || prog?.reflection || "");

  // Resolve a podcast episode for this lesson (fall back to a Track 101 staple).
  const ep =
    (L.podcastEpisode ? podcastAllEpisodes.find((e) => e.num === L.podcastEpisode) : undefined) ??
    podcastAllEpisodes.find((e) => e.num === "EP 04");
  const runtimeMin = ep ? parseInt(ep.runtime, 10) || 33 : 33;
  const podLengthSec = runtimeMin * 60;
  const podLengthLabel = `${runtimeMin}:00`;
  const podTitle = L.podcastTitle ?? ep?.title ?? "The economics behind this decision";
  const podDesc = ep?.desc ?? "The front-office breakdown that frames this lesson’s call.";
  const podEyebrow = `${ep?.concept ?? L.concepts?.[0] ?? "BOW"} · Lesson podcast`;

  const handleReflectionSave = async () => {
    // Persist first, then run the unlock check — a 75-word reflection may be the
    // final condition. saveReflectionAndCheck orders the two so there's no race.
    await saveReflectionAndCheck(lid, reflection);
  };

  const handlePodProgress = (fraction: number) => {
    setPodLocal((prev) => (fraction > prev ? fraction : prev));
    if (fraction >= PODCAST_UNLOCK_THRESHOLD && podPersistedForLid.current !== lid) {
      podPersistedForLid.current = lid;
      void (async () => {
        await recordPodcastProgress(lid, fraction);
        await checkAndUnlockNextLesson(lid);
      })();
    }
  };

  const steps: { key: string; label: string; desc: string; done: boolean; render: () => React.ReactNode }[] = [
    {
      key: "start",
      label: "Open the case",
      desc: "Read the front-office brief and your role in it.",
      done: status !== "not-started",
      render: () =>
        status === "not-started" ? (
          <button className={styles.focusTarget} onClick={() => startLesson(lid)} type="button" style={primaryBtn}>Start Lesson</button>
        ) : (
          <span style={doneTag}>Started{prog?.startedAt ? ` · ${prog.startedAt}` : ""}</span>
        ),
    },
    {
      key: "sim",
      label: L.simulationStatus === "available" ? "Make the call (simulation)" : "Make the call (case file)",
      desc:
        L.simulationStatus === "available"
          ? "Read the case, then launch the simulation to make the call and see the consequence."
          : "Read the case file, weigh the stakeholders and evidence, then make your call.",
      done: !!prog?.simulationDone,
      render: () =>
        prog?.simulationDone ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={doneTag}>Your call{selectedOption ? `: ${selectedOption}` : " · recorded"}</span>
            <button className={styles.focusTarget} onClick={() => setSimulationDone(lid, false)} type="button" style={ghostBtn}>Undo</button>
          </div>
        ) : (
          <div style={{ width: "100%" }}>
            <button aria-controls="student-case-file" aria-expanded={caseOpen} className={styles.focusTarget} onClick={() => setCaseOpen((v) => !v)} type="button" style={ghostBtn}>{caseOpen ? "Hide the case file" : "Open the case file"}</button>
            {caseOpen && (
              <div id="student-case-file" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                {L.decisionPrompt && (
                  <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontSize: 15, lineHeight: 1.55, color: "var(--bow-ink)" }}>{L.decisionPrompt}</p>
                )}
                {L.situation.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {L.situation.map((p, i) => (
                      <p key={i} style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>{p}</p>
                    ))}
                  </div>
                )}
                {L.evidence.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {L.evidence.map((e) => (
                      <div key={e.label} style={{ border: "1px solid var(--border-rule)", borderRadius: 4, padding: "8px 12px", minWidth: 120 }}>
                        <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{e.label}</div>
                        <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 15, color: "var(--bow-ink)" }}>{e.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                {L.stakeholders.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Stakeholders</span>
                    {L.stakeholders.map((s) => (
                      <p key={s.name} style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "var(--bow-slate)" }}>
                        <strong style={{ color: "var(--bow-ink)" }}>{s.name}</strong> — wants {s.interest.toLowerCase()} concerned about {s.concern.toLowerCase()}
                      </p>
                    ))}
                  </div>
                )}
                {L.decisionOptions.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Make your call</span>
                    {L.decisionOptions.map((opt) => (
                      <button
                        className={styles.focusTarget}
                        key={opt.label}
                        onClick={() => {
                          setSelectedOption(opt.label);
                          setSimulationDone(lid, true);
                        }}
                        type="button"
                        style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 3, padding: "12px 14px", cursor: "pointer", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 4 }}
                      >
                        <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, color: "var(--bow-ink)" }}>{opt.label}</span>
                        {opt.detail && <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{opt.detail}</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button className={styles.focusTarget} onClick={() => setSimulationDone(lid, true)} type="button" style={primaryBtn}>Mark case complete</button>
                )}
                {L.simulationStatus === "available" && (
                  <Link className={styles.focusTarget} href={L.simulationUrl ?? "/simulation"} style={{ ...primaryBtn, display: "inline-block", textDecoration: "none", width: "fit-content" }}>Launch Simulation →</Link>
                )}
              </div>
            )}
          </div>
        ),
    },
    {
      key: "podcast",
      label: "Listen to the episode",
      desc: `Play the lesson podcast past ${Math.round(PODCAST_UNLOCK_THRESHOLD * 100)}% to unlock what’s next.`,
      done: check.podcastMet,
      render: () => (
        <div style={{ width: "100%" }}>
          <PodcastPlayer
            episode={ep?.num ?? "EP 04"}
            eyebrow={podEyebrow}
            title={podTitle}
            desc={podDesc}
            lengthSec={podLengthSec}
            lengthLabel={podLengthLabel}
            takeaways={podTakeaways}
            onProgress={handlePodProgress}
          />
          <span style={{ ...doneTag, display: "inline-block", marginTop: 8, color: check.podcastMet ? "var(--bow-positive)" : "var(--bow-slate)" }}>
            {Math.round(liveDetail.podcastProgress * 100)}% played{check.podcastMet ? " · counted" : ""}
          </span>
        </div>
      ),
    },
    {
      key: "reflect",
      label: "Name the economics",
      desc: `Explain the trade-off you just made — at least ${MIN_REFLECTION_WORDS} words.`,
      done: check.reflectionMet,
      render: () => (
        <div style={{ width: "100%" }}>
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={4}
            placeholder="The cost wasn't the salary — it was the win we passed up…"
            style={{ width: "100%", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "11px 13px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14, resize: "vertical" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <button className={styles.focusTarget} onClick={handleReflectionSave} type="button" style={primaryBtn}>Save reflection</button>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", color: liveWords >= MIN_REFLECTION_WORDS ? "var(--bow-positive)" : "var(--bow-slate)" }}>
              {liveWords} / {MIN_REFLECTION_WORDS} words
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "challenge",
      label: "Real-world challenge",
      desc: "Connect the principle to how sports actually works.",
      done: !!prog?.challengeDone,
      render: () =>
        prog?.challengeDone ? (
          <button className={styles.focusTarget} onClick={() => setChallengeDone(lid, false)} type="button" style={ghostBtn}>Undo</button>
        ) : (
          <button className={styles.focusTarget} onClick={() => setChallengeDone(lid, true)} type="button" style={primaryBtn}>Mark challenge complete</button>
        ),
    },
  ];

  const allDone = status !== "not-started" && !!prog?.simulationDone && !!prog?.reflection?.trim() && !!prog?.challengeDone;

  // Auto-unlock checklist (the default path): simulation + 75-word reflection + 80% podcast.
  const unlockItems = [
    { label: "Simulation complete", done: check.simulationDone },
    { label: `Reflection ≥ ${MIN_REFLECTION_WORDS} words`, done: check.reflectionMet },
    { label: `Podcast played past ${Math.round(PODCAST_UNLOCK_THRESHOLD * 100)}%`, done: check.podcastMet },
  ];

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "calc(100vh - 60px)", padding: "clamp(20px,3vw,36px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link className={styles.focusTarget} href="/app/student/track" style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", cursor: "pointer", display: "inline-block", marginBottom: 18 }}>
          ← My Track
        </Link>

        {/* case-file header */}
        <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, padding: "clamp(24px,3.5vw,40px)", marginBottom: 22, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6f8bff" }}>{L.caseNumber} · Module {String(L.moduleNumber).padStart(2, "0")} · {L.moduleTitle}</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#fff", background: "rgba(49,87,255,0.2)", padding: "4px 11px", borderRadius: 3 }}>{locked ? "Locked" : lessonProgressLabel(status)}</span>
          </div>
          <h1 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,4.5vw,52px)", lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase" }}>{L.title}</h1>
          <p style={{ margin: "0 0 22px", fontFamily: "var(--font-editorial)", fontSize: "clamp(17px,1.8vw,22px)", lineHeight: 1.45, color: "#d4d6db", maxWidth: 600 }}>{L.centralQuestion}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {!locked && (
              <button className={styles.focusTarget} disabled={status !== "not-started"} onClick={() => startLesson(lid)} type="button" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase", padding: "14px 28px", border: "none", background: "var(--bow-blue)", color: "#fff", borderRadius: 4, cursor: status === "not-started" ? "pointer" : "default" }}>{primaryLabel}</button>
            )}
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9a9da6" }}>Role · {L.role} · {L.duration}</span>
          </div>
        </div>

        {locked ? (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>
              {inDev ? "This lesson is still in development." : "This lesson unlocks automatically once you finish the previous one — make your call in its case file, write your reflection, and play the podcast. Your instructor can also open it manually."}
            </p>
          </div>
        ) : (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Work through this lesson</span>
              {completed && <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-positive)" }}>Completed{prog?.completedAt ? ` · ${prog.completedAt}` : ""}</span>}
            </div>

            {/* auto-unlock status */}
            {!completed && (
              <div style={{ background: "var(--bow-ink)", color: "#fff", borderRadius: 6, padding: "16px 18px", marginBottom: 18 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6f8bff" }}>Self-paced unlock</span>
                <p style={{ margin: "6px 0 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "#b9bcc4" }}>
                  Finish all three and the next lesson opens for you automatically — no waiting on the cohort.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {unlockItems.map((it) => (
                    <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span aria-hidden style={{ width: 16, height: 16, borderRadius: 999, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", background: it.done ? "var(--bow-positive)" : "transparent", border: it.done ? "none" : "1px solid var(--bow-dark-border)" }}>{it.done ? "✓" : ""}</span>
                      <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, color: it.done ? "#fff" : "#9a9da6", textDecoration: it.done ? "none" : "none" }}>{it.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column" }}>
              {steps.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 0", borderBottom: "1px solid var(--border-rule)" }}>
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: s.done ? "var(--bow-positive)" : "var(--bow-inactive)", flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, textTransform: "uppercase", letterSpacing: "-0.01em", color: "var(--bow-ink)" }}>{s.label}</span>
                    <p style={{ margin: "3px 0 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>{s.desc}</p>
                    {s.render()}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
                {completed ? "You’ve completed this lesson." : allDone ? "All steps done — lock it in." : "Finish the steps above to complete the lesson."}
              </span>
              {!completed && (
                <button className={styles.focusTarget} onClick={() => completeLesson(lid)} disabled={!allDone} type="button" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "13px 24px", border: "none", background: allDone ? "var(--bow-positive)" : "var(--bow-inactive)", color: "#fff", borderRadius: 4, cursor: allDone ? "pointer" : "not-allowed" }}>Complete Lesson</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 12.5,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "9px 16px",
  border: "none",
  background: "var(--bow-ink)",
  color: "#fff",
  borderRadius: 4,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "8px 14px",
  border: "1px solid var(--border-rule)",
  background: "transparent",
  color: "var(--bow-slate)",
  borderRadius: 4,
  cursor: "pointer",
};
const doneTag: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bow-positive)",
};
