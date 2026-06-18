import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge, Button, SectionHeader } from "@/components/ds";
import {
  type Lesson,
  type Tone,
  lessons,
  getLesson,
  getLessonById,
  moduleLabel,
  LESSON_STATUS_META,
} from "@/lib/lessons";

/** Public default hero style — prototype default is 'A' (The Case File). */
const HERO_STYLE: "A" | "B" = "A";

const SECTION_PAD = "clamp(48px,7vw,96px) clamp(18px,4vw,40px)";

export function generateStaticParams(): { slug: string }[] {
  return lessons.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) {
    return { title: "Case Not Found — BOW Sports Capital" };
  }
  return {
    title: `${lesson.title} — ${lesson.trackLabel} | BOW Sports Capital`,
    description: lesson.summary || lesson.overview || lesson.centralQuestion,
  };
}

function evidenceAccent(tone?: Tone): string {
  switch (tone) {
    case "positive":
      return "var(--bow-positive)";
    case "negative":
      return "var(--bow-negative)";
    case "warning":
      return "var(--bow-warning)";
    case "info":
      return "var(--bow-blue)";
    default:
      return "var(--bow-slate)";
  }
}

export default async function LessonDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();

  const s = LESSON_STATUS_META[lesson.status];
  const simAvailable = lesson.simulationStatus === "available";
  const simLabel = simAvailable ? "Enter the Case" : "Simulation Coming Soon";
  const simNote = simAvailable
    ? "Take the role and make the call inside the live simulation."
    : "This case is being built. Read the full brief now — the simulation connects here when it’s ready.";

  const decisionPrompt = lesson.decisionPrompt || lesson.summary;
  const role = lesson.role || "Decision-Maker";
  const deadline = lesson.deadline || "No fixed deadline";
  const modLabel = moduleLabel(lesson);
  const moduleShort = `Module ${String(lesson.moduleNumber).padStart(2, "0")}`;
  const trackHref = lesson.track === "201" ? "/programs/track-201" : "/programs/track-101";

  const related: Lesson[] = lesson.relatedLessons
    .filter((id) => id !== lesson.id)
    .map((id) => getLessonById(id))
    .filter((r): r is Lesson => Boolean(r));

  const podConnected = !!lesson.podcastEpisode;

  return (
    <div data-screen-label="Lesson Detail">
      {/* breadcrumb */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(16px,2.4vw,24px) clamp(18px,4vw,40px) 0" }}>
        <div className="bow-container">
          <nav
            aria-label="Breadcrumb"
            style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)" }}
          >
            <Link href="/programs" style={{ color: "var(--bow-blue)" }}>
              Programs
            </Link>
            <span aria-hidden="true">/</span>
            <Link href={trackHref} style={{ color: "var(--bow-blue)" }}>
              {lesson.trackLabel}
            </Link>
            <span aria-hidden="true">/</span>
            <Link href={trackHref} style={{ color: "var(--bow-blue)" }}>
              {moduleShort}
            </Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "var(--bow-ink)" }}>Lesson {lesson.lessonNumber}</span>
          </nav>
        </div>
      </section>

      {/* HERO */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(16px,2.4vw,24px) clamp(18px,4vw,40px) clamp(32px,4vw,56px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          {HERO_STYLE === "B" ? (
            <LessonHeroB
              lesson={lesson}
              moduleLabelText={modLabel}
              role={role}
              deadline={deadline}
              statusLabel={s.label}
              statusBadge={s.badge}
              simAvailable={simAvailable}
              simLabel={simLabel}
              simNote={simNote}
            />
          ) : (
            <LessonHeroA
              lesson={lesson}
              moduleLabelText={modLabel}
              role={role}
              deadline={deadline}
              statusLabel={s.label}
              statusBadge={s.badge}
              simAvailable={simAvailable}
              simLabel={simLabel}
              simNote={simNote}
            />
          )}
          <div style={{ marginTop: 16 }}>
            <a href="#ld-situation" style={{ textDecoration: "none", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
              Read the case brief ↓
            </a>
          </div>
        </div>
      </section>

      {/* THE SITUATION */}
      {lesson.situation.length > 0 && (
        <section id="ld-situation" style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)", scrollMarginTop: 80 }}>
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
              The Situation
            </span>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 18 }}>
              {lesson.situation.map((p, i) => (
                <p key={i} style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,19px)", lineHeight: 1.65, color: "var(--bow-ink)" }}>
                  {p}
                </p>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 30 }}>
              <div style={{ borderLeft: "3px solid var(--bow-blue)", paddingLeft: 14 }}>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Your Role</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, textTransform: "uppercase", marginTop: 4, lineHeight: 1.05 }}>{role}</div>
              </div>
              <div style={{ borderLeft: "3px solid var(--bow-orange)", paddingLeft: 14 }}>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Deadline</div>
                <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 14, marginTop: 6, color: "var(--bow-orange)", lineHeight: 1.3 }}>{deadline}</div>
              </div>
              <div style={{ borderLeft: "3px solid var(--bow-ink)", paddingLeft: 14 }}>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Experience</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, textTransform: "uppercase", marginTop: 4, lineHeight: 1.05 }}>{lesson.experienceType}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* WHAT YOU NEED TO KNOW */}
      {lesson.needToKnow.length > 0 && (
        <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
          <div className="bow-container">
            <div style={{ maxWidth: 640, marginBottom: 32 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
                What You Need to Know
              </span>
              <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,38px)", lineHeight: 1.06, letterSpacing: "-0.01em" }}>
                The context behind the call.
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "clamp(14px,2vw,18px)" }}>
              {lesson.needToKnow.map((k, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-blue)", padding: "22px 20px" }}>
                  <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 19, textTransform: "uppercase", letterSpacing: "0.005em", lineHeight: 1 }}>{k.term}</h3>
                  <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "var(--bow-slate)" }}>{k.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* THE DECISION */}
      {lesson.decisionOptions.length > 0 && (
        <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)" }}>
          <div className="bow-container">
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
              The Decision
            </span>
            <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.4vw,40px)", lineHeight: 1.05, letterSpacing: "-0.01em", maxWidth: "22ch", color: "#fff" }}>
              {lesson.centralQuestion}
            </h2>
            <p style={{ margin: "16px 0 28px", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.4vw,18px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 640 }}>{decisionPrompt}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "clamp(12px,1.6vw,16px)" }}>
              {lesson.decisionOptions.map((o, i) => (
                <div key={i} style={{ border: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)", padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 28, lineHeight: 0.8, color: "var(--bow-blue)" }}>{String.fromCharCode(65 + i)}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, textTransform: "uppercase", letterSpacing: "0.005em", lineHeight: 1.1, color: "#fff" }}>{o.label}</span>
                  {o.detail && <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "#b9bcc4" }}>{o.detail}</span>}
                </div>
              ))}
            </div>
            <p style={{ margin: "24px 0 0", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#9a9da6" }}>
              There is no single correct answer. BOW grades the reasoning, the evidence, and the tradeoff you’re willing to defend.
            </p>
          </div>
        </section>
      )}

      {/* THE STAKEHOLDERS */}
      {lesson.stakeholders.length > 0 && (
        <section style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
          <div className="bow-container">
            <div style={{ maxWidth: 640, marginBottom: 32 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
                The Stakeholders
              </span>
              <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,38px)", lineHeight: 1.06, letterSpacing: "-0.01em" }}>
                Everyone wants something different.
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "clamp(14px,2vw,18px)" }}>
              {lesson.stakeholders.map((st, i) => (
                <div key={i} style={{ border: "1px solid var(--border-rule)", padding: "22px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 19, textTransform: "uppercase", letterSpacing: "0.005em", lineHeight: 1 }}>{st.name}</h3>
                  <div>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-positive)" }}>Wants</span>
                    <p style={{ margin: "3px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-ink)" }}>{st.interest}</p>
                  </div>
                  <div>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-warning)" }}>Worries</span>
                    <p style={{ margin: "3px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)" }}>{st.concern}</p>
                  </div>
                  {st.conflict && (
                    <div style={{ borderTop: "1px solid var(--border-rule)", paddingTop: 10 }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-negative)" }}>Tension</span>
                      <p style={{ margin: "3px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-slate)" }}>{st.conflict}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* THE EVIDENCE */}
      {lesson.evidence.length > 0 && (
        <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)" }}>
          <div className="bow-container">
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 30 }}>
              <div style={{ maxWidth: 560 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
                  The Evidence
                </span>
                <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,38px)", lineHeight: 1.06, letterSpacing: "-0.01em", color: "#fff" }}>
                  The front-office briefing.
                </h2>
              </div>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6d7078" }}>Simulated case data</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)" }}>
              {lesson.evidence.map((e, i) => (
                <div key={i} style={{ background: "var(--bow-dark-surface)", padding: 20, display: "flex", flexDirection: "column", gap: 6, borderTop: `3px solid ${evidenceAccent(e.tone)}` }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a9da6" }}>{e.label}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: "clamp(26px,3vw,38px)", lineHeight: 0.95, color: "#fff" }}>{e.value}</span>
                  {e.note && <span style={{ fontFamily: "var(--font-interface)", fontSize: 12.5, lineHeight: 1.4, color: "#b9bcc4" }}>{e.note}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WHAT THIS TEACHES */}
      {lesson.learningOutcomes.length > 0 && (
        <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
          <div className="bow-container">
            <div style={{ maxWidth: 640, marginBottom: 32 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
                What This Teaches
              </span>
              <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,38px)", lineHeight: 1.06, letterSpacing: "-0.01em" }}>
                The economics inside the decision.
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "clamp(14px,2vw,18px)" }}>
              {lesson.learningOutcomes.map((o, i) => {
                const hasDepth = !!(o.means || o.appears);
                return (
                  <div key={i} style={{ background: "#fff", border: "1px solid var(--border-rule)", padding: "clamp(20px,2.4vw,28px)", display: "grid", gridTemplateColumns: "minmax(0,200px) 1fr", gap: "clamp(16px,2.5vw,32px)", alignItems: "start" }}>
                    <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(20px,2.2vw,26px)", textTransform: "uppercase", letterSpacing: "-0.005em", lineHeight: 0.98, color: "var(--bow-ink)" }}>{o.concept}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {hasDepth && (
                        <>
                          {o.means && (
                            <div>
                              <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>What it means</span>
                              <p style={{ margin: "3px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.5, color: "var(--bow-ink)" }}>{o.means}</p>
                            </div>
                          )}
                          {o.appears && (
                            <div>
                              <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Where it appears</span>
                              <p style={{ margin: "3px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>{o.appears}</p>
                            </div>
                          )}
                        </>
                      )}
                      <div>
                        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-blue)" }}>How you use it</span>
                        <p style={{ margin: "3px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.5, color: "var(--bow-ink)" }}>{o.use}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* AFTER THE SIMULATION */}
      <section style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            After the Simulation
          </span>
          <h2 style={{ margin: "10px 0 28px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,3.2vw,38px)", lineHeight: 1.06, letterSpacing: "-0.01em" }}>
            Defend the call. Then go deeper.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(20px,3vw,40px)", alignItems: "start" }}>
            {/* reflection */}
            {lesson.discussionQuestions.length > 0 && (
              <div>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Reflection prompts</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: "1px solid var(--border-rule)", marginTop: 12 }}>
                  {lesson.discussionQuestions.map((q, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 12, padding: "14px 0", borderBottom: "1px solid var(--border-rule)" }}>
                      <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-blue)" }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontFamily: "var(--font-editorial)", fontWeight: 500, fontSize: "clamp(16px,1.5vw,18px)", lineHeight: 1.35 }}>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* podcast + next */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", border: "1px solid var(--bow-dark-border)", padding: 22 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Related Podcast</span>
                {podConnected ? (
                  <>
                    <h3 style={{ margin: "10px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(18px,2vw,22px)", lineHeight: 1.2, color: "#fff" }}>{lesson.podcastTitle}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", color: "var(--bow-blue)" }}>{lesson.podcastEpisode}</span>
                      <Link href="/podcast" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#fff" }}>
                        Open the Podcast →
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "#9a9da6" }}>
                      A companion episode for this case hasn’t been connected yet. Browse the full podcast in the meantime.
                    </p>
                    <Link href="/podcast" style={{ display: "inline-block", marginTop: 12, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
                      Browse the Podcast →
                    </Link>
                  </>
                )}
              </div>
              <div style={{ background: "var(--bow-paper)", borderLeft: "4px solid var(--bow-blue)", padding: "20px 22px" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Extension Challenge</span>
                <p style={{ margin: "8px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 500, fontSize: "clamp(16px,1.7vw,20px)", lineHeight: 1.3 }}>
                  Re-run the case with the opposite priority. What breaks, and who notices first?
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RELATED LESSONS */}
      {related.length > 0 && (
        <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD }}>
          <div className="bow-container">
            <SectionHeader kicker="Keep going" title="Related cases" style={{ marginBottom: 32 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "clamp(14px,2vw,20px)" }}>
              {related.map((r) => {
                const rs = LESSON_STATUS_META[r.status];
                return (
                  <Link
                    key={r.id}
                    href={`/lessons/${r.slug}`}
                    aria-label={`Open related lesson: ${r.title}`}
                    className="bow-card"
                    style={{ position: "relative", background: "#fff", border: "1px solid var(--border-rule)", padding: "22px 20px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden", color: "var(--bow-ink)" }}
                  >
                    <span style={{ position: "absolute", right: 6, top: -14, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 70, lineHeight: 0.8, color: "rgba(10,10,11,0.05)" }}>{r.bigNum}</span>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, position: "relative" }}>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-blue)" }}>{r.trackLabel}</span>
                      <Badge status={rs.badge}>{rs.label}</Badge>
                    </div>
                    <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(17px,1.6vw,21px)", lineHeight: 1.18, position: "relative", textWrap: "pretty" }}>{r.centralQuestion}</p>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{r.title} →</span>
                  </Link>
                );
              })}
            </div>
            <div style={{ marginTop: 28 }}>
              <Button href="/lessons" variant="secondary" size="md">
                Back to All Lessons
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================================
 * LessonHero — ported from the prototype's LessonHero component.
 * Two variants: A (The Case File, public default) and B (The
 * Decision Room). Selected via HERO_STYLE above.
 * ============================================================ */

interface HeroProps {
  lesson: Lesson;
  moduleLabelText: string;
  role: string;
  deadline: string;
  statusLabel: string;
  statusBadge: "positive" | "warning" | "info" | "neutral";
  simAvailable: boolean;
  simLabel: string;
  simNote: string;
}

function LessonHeroA({ lesson, moduleLabelText, role, deadline, statusLabel, statusBadge, simAvailable, simLabel, simNote }: HeroProps) {
  return (
    <section style={{ position: "relative", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(10,10,11,0.035) 1px, transparent 1px)", backgroundSize: "5px 5px", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", right: -24, top: -56, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,26vw,360px)", lineHeight: 0.7, color: "rgba(10,10,11,0.045)", pointerEvents: "none", letterSpacing: "-0.04em" }}>
        {lesson.bigNum}
      </div>

      {/* classification bar */}
      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px clamp(20px,3vw,40px)", borderBottom: "1px dashed var(--border-rule)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-blue)", fontWeight: 600 }}>Front Office Brief</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-slate)" }}>· Confidential</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{lesson.caseNumber}</span>
          <Badge status={statusBadge}>{statusLabel}</Badge>
        </div>
      </div>

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: "clamp(24px,4vw,56px)", padding: "clamp(28px,4vw,52px) clamp(20px,3vw,40px) clamp(28px,4vw,44px)", alignItems: "start" }}>
        {/* main column */}
        <div style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{lesson.trackLabel} · {moduleLabelText}</span>
          <span style={{ display: "block", marginTop: 10, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(15px,1.6vw,19px)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-ink)" }}>{lesson.title}</span>
          <p style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.2vw,54px)", lineHeight: 1.06, letterSpacing: "-0.018em", color: "var(--bow-ink)", textWrap: "pretty" }}>{lesson.centralQuestion}</p>
          <svg width="248" height="16" viewBox="0 0 248 16" style={{ display: "block", margin: "22px 0 0", maxWidth: "70%" }} aria-hidden="true">
            <path d="M0 12 H132 V4 H248" stroke="var(--bow-blue)" strokeWidth="6" fill="none" />
          </svg>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
            {lesson.concepts.map((c) => (
              <span key={c} style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-ink)", background: "#fff", border: "1px solid var(--border-rule)", padding: "6px 11px" }}>{c}</span>
            ))}
          </div>
        </div>

        {/* brief metadata column */}
        <div style={{ border: "1px solid var(--border-rule)", background: "#fff" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-rule)" }}>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Assigned Role</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, textTransform: "uppercase", marginTop: 4, lineHeight: 1.05 }}>{role}</div>
          </div>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-rule)" }}>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Decision Deadline</div>
            <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 14, marginTop: 5, color: "var(--bow-orange)", lineHeight: 1.3 }}>{deadline}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ padding: "14px 16px", borderRight: "1px solid var(--border-rule)" }}>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Time</div>
              <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 17, marginTop: 4 }}>{lesson.duration}</div>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Grade</div>
              <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 14, marginTop: 6 }}>{lesson.gradeBand}</div>
            </div>
          </div>
        </div>
      </div>

      {/* action row */}
      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "0 clamp(20px,3vw,40px) clamp(26px,3.5vw,40px)" }}>
        {simAvailable ? (
          <Button href="/simulation" variant="primary" size="lg">
            {simLabel}
          </Button>
        ) : (
          <DisabledSimButton label={simLabel} />
        )}
        <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "var(--bow-slate)", maxWidth: 420 }}>{simNote}</span>
      </div>
    </section>
  );
}

function LessonHeroB({ lesson, moduleLabelText, role, deadline, statusLabel, statusBadge, simAvailable, simLabel, simNote }: HeroProps) {
  return (
    <section className="bow-front-office" style={{ position: "relative", background: "var(--bow-ink)", color: "#fff", border: "1px solid var(--bow-dark-border)", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(49,87,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(49,87,255,0.06) 1px, transparent 1px)", backgroundSize: "46px 46px", opacity: 0.7, pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", right: -20, bottom: -70, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(150px,24vw,340px)", lineHeight: 0.7, color: "rgba(255,255,255,0.045)", pointerEvents: "none", letterSpacing: "-0.04em" }}>
        {lesson.bigNum}
      </div>

      {/* top status rail */}
      <div style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px clamp(20px,3vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--bow-orange)", boxShadow: "0 0 0 4px rgba(255,107,53,0.18)" }} />
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)", fontWeight: 600 }}>Decision Room · Live</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>{lesson.caseNumber}</span>
          <Badge status={statusBadge}>{statusLabel}</Badge>
        </div>
      </div>

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,250px)", gap: "clamp(20px,3vw,44px)", padding: "clamp(26px,4vw,52px) clamp(20px,3vw,40px)", alignItems: "stretch" }}>
        {/* central decision */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a9da6" }}>{lesson.trackLabel} · {moduleLabelText}</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 16, border: "1px solid var(--bow-dark-border)", background: "rgba(255,107,53,0.08)", padding: "7px 12px" }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>On the clock</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "#fff" }}>{deadline}</span>
          </div>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.4vw,56px)", lineHeight: 1.06, letterSpacing: "-0.018em", color: "#fff", textWrap: "pretty" }}>{lesson.centralQuestion}</p>
          <span style={{ display: "block", marginTop: 12, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(13px,1.4vw,16px)", letterSpacing: "0.04em", textTransform: "uppercase", color: "#6f8bff" }}>{lesson.title}</span>
          <div style={{ marginTop: 26 }}>
            {simAvailable ? (
              <Button href="/simulation" variant="primary" size="lg">
                {simLabel}
              </Button>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
                <DisabledSimButton label={simLabel} dark />
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, lineHeight: 1.5, color: "#9a9da6", maxWidth: 360 }}>{simNote}</span>
              </div>
            )}
          </div>
        </div>

        {/* evidence signal rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, borderLeft: "1px solid var(--bow-dark-border)", paddingLeft: "clamp(16px,2vw,24px)" }}>
          <div>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>Your Role</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginTop: 4, lineHeight: 1.05, color: "#fff" }}>{role}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ border: "1px solid var(--bow-dark-border)", padding: "10px 12px" }}>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>Time</div>
              <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 15, marginTop: 4, color: "#fff" }}>{lesson.duration}</div>
            </div>
            <div style={{ border: "1px solid var(--bow-dark-border)", padding: "10px 12px" }}>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6d7078" }}>Grade</div>
              <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, marginTop: 5, color: "#fff" }}>{lesson.gradeBand}</div>
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078", marginBottom: 8 }}>Concepts in Play</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {lesson.concepts.map((c) => (
                <span key={c} style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: "#c8cad0", border: "1px solid var(--bow-dark-border)", padding: "5px 9px" }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DisabledSimButton({ label, dark = false }: { label: string; dark?: boolean }) {
  const style: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    padding: "14px 24px",
    borderRadius: "var(--radius-control)",
    border: `1px dashed ${dark ? "var(--bow-dark-border)" : "var(--border-rule)"}`,
    background: "transparent",
    color: dark ? "#6d7078" : "var(--bow-inactive)",
    cursor: "not-allowed",
  };
  return (
    <button type="button" disabled aria-disabled="true" style={style}>
      {label}
    </button>
  );
}
