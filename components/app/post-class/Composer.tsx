"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import OfferingCard from "@/components/site/OfferingCard";
import type { PublicProgram } from "@/lib/cms/offerings";
import type { CourseSummary } from "@/lib/curriculum-courses";
import type { ClassDraftPayload } from "@/lib/class-draft";
import { buildRun, gradeRangeLabel, gradeRangeValue, keptDates, nextWeekdayAfter, runSummary } from "@/lib/class-schedule";
import { courseLessonTitles, publishClass, saveDraft } from "@/app/actions/post-class";
import ScheduleComposer from "./ScheduleComposer";

interface Props {
  courses: CourseSummary[];
  initial: ClassDraftPayload;
  /** Lessons for whichever course the draft already had, so reopening is instant. */
  initialLessons: string[];
  hadDraft: boolean;
  operatorName: string;
  /** Null when the operator has no instructor record — the class still publishes. */
  operatorTeaches: boolean;
}

const GRADE_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--bow-ink)",
};

const stepNumber: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  color: "var(--bow-slate)",
  letterSpacing: "0.08em",
};

/**
 * Post a Class.
 *
 * Three real decisions — which course, what it's called, and when it runs.
 * Everything else already holds the answer BOW almost always gives, stated out
 * loud in one defaults row so it is visible and changeable without being a
 * question. Publish is legal the moment there is a title.
 *
 * The word "program" appears nowhere: the Program/Class split is created by
 * the publish transaction and stays in the database where it belongs.
 */
export default function Composer({
  courses,
  initial,
  initialLessons,
  hadDraft,
  operatorName,
  operatorTeaches,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<ClassDraftPayload>(() => ({
    ...initial,
    firstDate: initial.firstDate ?? nextWeekdayAfter(todayIso(), initial.scheduleDay),
  }));
  const [lessons, setLessons] = useState<string[]>(initialLessons);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"title" | "firstDate" | "schedule" | "grades" | null>(null);
  const [saved, setSaved] = useState(hadDraft);
  const [mobilePreview, setMobilePreview] = useState(false);

  /**
   * Minted on the first publish attempt and reused for every retry after it.
   *
   * That is what makes tapping Publish again safe: the same key reaches the
   * server, which resolves it to the class the first attempt already created
   * rather than making a second one. Generated in the click handler rather
   * than during render, because randomness during render is not idempotent.
   */
  const requestKey = useRef<string | null>(null);

  const course = courses.find((c) => c.id === draft.curriculumId) ?? null;
  const run = useMemo(
    () => buildRun({ firstDate: draft.firstDate ?? todayIso(), weeks: draft.weeks, skipped: draft.skipped }),
    [draft.firstDate, draft.weeks, draft.skipped],
  );
  const dates = keptDates(run);
  const canPublish = draft.title.trim().length > 0 && !publishing;

  const patch = useCallback((next: Partial<ClassDraftPayload>) => {
    setDraft((prev) => ({ ...prev, ...next }));
    setErrorField(null);
    setError(null);
  }, []);

  /* Autosave. Debounced so a person typing a title does not write once per key. */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void saveDraft(draft).then(() => setSaved(true));
    }, 1200);
    return () => clearTimeout(timer);
  }, [draft]);

  const pickCourse = async (next: CourseSummary | null) => {
    if (!next) {
      patch({ curriculumId: null });
      setLessons([]);
      return;
    }
    // Picking a course pre-fills the decisions it already answers: the title,
    // the grade range, and how many sessions the run needs.
    patch({
      curriculumId: next.id,
      title: draft.title.trim() ? draft.title : next.title,
      weeks: next.lessonCount > 0 ? Math.min(16, next.lessonCount) : draft.weeks,
    });
    setLessons(await courseLessonTitles(next.id));
  };

  const preview: PublicProgram = useMemo(() => {
    // OfferingCard renders "Grades {gradeRange}", so gradeRange gets the bare
    // range — otherwise the card reads "Grades Grades 5–8".
    const gradeValue = gradeRangeValue(draft.grades) ?? "—";
    const gradeLabel = gradeRangeLabel(draft.grades) ?? "Pick grades";
    return {
      id: "preview",
      slug: "preview",
      title: draft.title.trim() || "Your class title",
      shortDescription:
        course?.description?.trim() ||
        "A live class taught by BOW. Add a description before you share it.",
      longDescription: "",
      gradeRange: gradeValue,
      audience: gradeLabel,
      deliveryFormat: "online",
      isOnline: true,
      locationLabel: "",
      startDate: dates[0] ?? null,
      endDate: dates[dates.length - 1] ?? null,
      scheduleLabel: runSummary(run, draft.startTime, draft.endTime),
      startTime: draft.startTime,
      endTime: draft.endTime,
      timezone: draft.timeZone,
      sessionCount: dates.length,
      sessionLengthMinutes: null,
      capacity: draft.capacity,
      registeredCount: 0,
      seatsRemaining: draft.capacity,
      isFree: true,
      priceLabel: "Free",
      priceNote: "",
      curriculumSummary: "",
      learningGoals: "",
      studentExperience: "",
      imageUrl: "",
      featured: false,
      displayOrder: 0,
      publicationStatus: "published",
      registrationStatus: "registration_open",
      interestListEnabled: false,
      confirmationMessage: "",
      seoTitle: "",
      seoDescription: "",
      socialImageUrl: "",
      trackSlug: null,
      cta: {
        behavior: "register",
        label: "Register",
        href: "#",
        secondary: null,
        explanation: "",
      },
    };
  }, [draft, course, run, dates]);

  const publish = async () => {
    if (!requestKey.current) {
      const random =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().replace(/-/g, "")
          : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      requestKey.current = `compose-${random}`;
    }
    setPublishing(true);
    setError(null);
    setErrorField(null);
    const result = await publishClass({ ...draft, requestKey: requestKey.current });
    if (!result.ok) {
      setPublishing(false);
      setError(result.error ?? "That didn't go through.");
      setErrorField(result.field ?? null);
      return;
    }
    router.push(`/app/post-class/published/${result.classId}`);
  };

  return (
    <div className="bow-post-class-grid">
      <div style={{ minWidth: 0 }}>
        {/* 01 — Course */}
        <section aria-labelledby="step-course">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={stepNumber}>01</span>
            <h2 id="step-course" style={{ ...sectionLabel, margin: 0 }}>
              Course
            </h2>
          </div>
          <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
            {courses.map((option) => {
              const active = draft.curriculumId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void pickCourse(option)}
                  style={{
                    textAlign: "left",
                    background: active ? "var(--bow-blue-tint)" : "var(--bow-white)",
                    border: `1px solid ${active ? "var(--bow-blue)" : "var(--border-rule)"}`,
                    borderRadius: "var(--radius-card)",
                    padding: "13px 15px",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: 13.5,
                      color: active ? "var(--bow-blue)" : "var(--bow-ink)",
                    }}
                  >
                    {option.title}
                    {!option.published ? (
                      <span style={{ marginLeft: 8 }}>
                        <Badge status="neutral">Draft</Badge>
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontFamily: "var(--font-data)",
                      fontSize: 10.5,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: active ? "var(--bow-blue)" : "var(--bow-slate)",
                    }}
                  >
                    {option.lessonCount > 0 ? `${option.lessonCount} lessons` : "No lessons yet"}
                    {option.gradeRange ? ` · ${option.gradeRange}` : ""}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => void pickCourse(null)}
              style={{
                textAlign: "left",
                background: "var(--bow-white)",
                border: `1px ${draft.curriculumId === null ? "solid var(--bow-blue)" : "dashed var(--border-rule)"}`,
                borderRadius: "var(--radius-card)",
                padding: "13px 15px",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, color: "var(--bow-slate)" }}>
                No course
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  fontFamily: "var(--font-data)",
                  fontSize: 10.5,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--bow-slate)",
                }}
              >
                Plan sessions myself
              </span>
            </button>
          </div>
        </section>

        {/* 02 — Title and grades */}
        <section aria-labelledby="step-title" style={{ marginTop: 34 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={stepNumber}>02</span>
            <h2 id="step-title" style={{ ...sectionLabel, margin: 0 }}>
              Title &amp; grades
            </h2>
          </div>
          <input
            aria-label="Class title"
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="What families will see"
            style={{
              width: "100%",
              marginTop: 12,
              padding: "11px 13px",
              fontSize: 16,
              fontFamily: "var(--font-interface)",
              borderRadius: "var(--radius-control)",
              border: `1px solid ${errorField === "title" ? "var(--bow-negative)" : "var(--border-rule)"}`,
              background: "var(--bow-white)",
            }}
          />
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--bow-slate)" }}>
            {course ? "Pre-filled from the course — make it yours." : "No course picked — the title is what families see."}
          </p>

          <div style={{ display: "flex", gap: 5, marginTop: 14, flexWrap: "wrap" }} role="group" aria-label="Grades">
            {GRADE_OPTIONS.map((grade) => {
              const active = draft.grades.includes(grade);
              return (
                <button
                  key={grade}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    patch({
                      grades: active ? draft.grades.filter((g) => g !== grade) : [...draft.grades, grade],
                    })
                  }
                  style={{
                    width: 36,
                    height: 34,
                    borderRadius: "var(--radius-control)",
                    fontFamily: "var(--font-data)",
                    fontSize: 12.5,
                    cursor: "pointer",
                    background: active ? "var(--bow-blue)" : "var(--bow-white)",
                    border: `1px solid ${active ? "var(--bow-blue)" : "var(--border-rule)"}`,
                    color: active ? "var(--bow-white)" : "var(--bow-slate)",
                  }}
                >
                  {grade}
                </button>
              );
            })}
            <span
              style={{
                alignSelf: "center",
                marginLeft: 8,
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: errorField === "grades" ? "var(--bow-negative)" : "var(--bow-slate)",
              }}
            >
              {gradeRangeLabel(draft.grades) ?? "Pick grades"}
            </span>
          </div>
        </section>

        {/* 03 — Schedule */}
        <section aria-labelledby="step-schedule" style={{ marginTop: 34 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <span style={stepNumber}>03</span>
            <h2 id="step-schedule" style={{ ...sectionLabel, margin: 0 }}>
              Schedule
            </h2>
          </div>
          <ScheduleComposer
            scheduleDay={draft.scheduleDay}
            startTime={draft.startTime}
            endTime={draft.endTime}
            firstDate={draft.firstDate}
            weeks={draft.weeks}
            skipped={draft.skipped}
            lessonTitles={lessons}
            error={errorField === "firstDate" || errorField === "schedule" ? error : null}
            onChange={patch}
          />
        </section>

        {/* 04 — Defaults */}
        <section aria-labelledby="step-defaults" style={{ marginTop: 34 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={stepNumber}>04</span>
            <h2 id="step-defaults" style={{ ...sectionLabel, margin: 0 }}>
              Everything else — already set
            </h2>
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "13px 16px",
              background: "var(--bow-white)",
              border: "1px solid var(--border-rule)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-ink)", lineHeight: 1.6 }}>
              <strong style={{ fontFamily: "var(--font-data)" }}>{draft.capacity}</strong> seats · waitlist runs itself ·
              free · {operatorTeaches ? "you teach it" : "no instructor yet"} · listed publicly
            </p>
            <button
              type="button"
              onClick={() => setDefaultsOpen((open) => !open)}
              style={{
                marginTop: 9,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: "var(--font-data)",
                fontSize: 10.5,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "var(--bow-blue)",
              }}
            >
              {defaultsOpen ? "Done" : "Change any of these"}
            </button>

            {defaultsOpen ? (
              <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label htmlFor="composer-seats" style={{ fontSize: 13, color: "var(--bow-slate)", minWidth: 66 }}>
                    Seats
                  </label>
                  <input
                    id="composer-seats"
                    type="number"
                    min={1}
                    max={40}
                    value={draft.capacity}
                    onChange={(event) => patch({ capacity: Number(event.target.value) })}
                    style={{
                      width: 84,
                      height: 34,
                      padding: "0 9px",
                      borderRadius: "var(--radius-control)",
                      border: "1px solid var(--border-rule)",
                      fontFamily: "var(--font-data)",
                    }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--bow-slate)" }}>
                    Once they are gone, families join the waitlist automatically.
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label htmlFor="composer-link" style={{ fontSize: 13, color: "var(--bow-slate)", minWidth: 66 }}>
                    Meeting link
                  </label>
                  <input
                    id="composer-link"
                    type="url"
                    value={draft.meetingLink ?? ""}
                    placeholder="https://zoom.us/j/…"
                    onChange={(event) => patch({ meetingLink: event.target.value || null })}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: 34,
                      padding: "0 9px",
                      borderRadius: "var(--radius-control)",
                      border: "1px solid var(--border-rule)",
                      fontSize: 13,
                    }}
                  />
                </div>

                <p style={{ margin: 0, fontSize: 12.5, color: "var(--bow-slate)" }}>
                  {operatorTeaches
                    ? `${operatorName} is set as the instructor. Change that from the class record once it is live.`
                    : "No instructor is assigned yet — you can add one from the class record."}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 30,
            paddingTop: 18,
            borderTop: "1px solid var(--border-rule)",
          }}
        >
          <span
            style={{
              flex: "1 1 auto",
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            {publishing
              ? `Creating ${dates.length} sessions · putting the card on the site`
              : saved
                ? "Draft saved"
                : "Draft saves as you go"}
          </span>
          <span className="bow-post-class-mobile-preview">
            <Button variant="secondary" size="sm" onClick={() => setMobilePreview(true)}>
              Preview
            </Button>
          </span>
          <Button variant="primary" disabled={!canPublish} onClick={() => void publish()}>
            {publishing ? "Publishing…" : "Publish class"}
          </Button>
        </div>

        {error && !errorField ? (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: "12px 15px",
              background: "var(--bow-negative-tint)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--bow-ink)" }}>{error}</p>
            <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--bow-slate)" }}>
              Your draft is safe — nothing was published twice. Try again.
            </p>
          </div>
        ) : null}
        {error && errorField === "title" ? (
          <p role="alert" style={{ marginTop: 10, fontSize: 13, color: "var(--bow-negative)" }}>
            {error}
          </p>
        ) : null}
        {!canPublish && !publishing ? (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--bow-slate)" }}>
            Pick a course or write a title to publish.
          </p>
        ) : null}
      </div>

      {/* Live preview — the real public card, not a lookalike. */}
      <aside
        className={`bow-post-class-preview${mobilePreview ? " is-open" : ""}`}
        aria-label="What families see"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--bow-ink)",
            }}
          >
            What families see
          </span>
          <button
            type="button"
            className="bow-post-class-preview-close"
            onClick={() => setMobilePreview(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-data)",
              fontSize: 11,
              color: "var(--bow-blue)",
            }}
          >
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <OfferingCard program={preview} />
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--bow-slate)" }}>
          The exact card that appears on the public programs page.
        </p>
      </aside>
    </div>
  );
}
