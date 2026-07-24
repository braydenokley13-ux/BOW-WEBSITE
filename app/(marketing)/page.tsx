import Link from "next/link";
import { Button, DecisionCard } from "@/components/ds";
import DataRibbon from "@/components/site/DataRibbon";
import FaqList from "@/components/site/FaqList";
import PublicProgramCard from "@/components/site/PublicProgramCard";
import { listPublicPrograms } from "@/lib/operations";
import {
  heroDecisionFacts,
  heroDecisionUnknowns,
  heroDecisionOptions,
  heroDecisionConsequence,
  concepts,
  learningLoop,
  tracks,
  homeEpisodes,
  pathways,
  formats,
  impact,
  faqs,
} from "@/lib/home";
import { getActiveTestimonials } from "@/lib/content";

/* ============================================================
 * Home.
 *
 * The page answers, in order: what is this → what does a student actually do
 * → what can I join → is it real → how do I get in → who teaches it.
 * Instructor recruitment used to be the third thing a first-time visitor
 * saw, before the page had explained what BOW is; it now sits after the
 * proof, where someone might plausibly want to volunteer.
 *
 * Two structural rules hold across every section here:
 *   - Grids declare their column counts (see `.bow-grid-*`). The previous
 *     `auto-fit` grids left visibly empty cells whenever the item count
 *     didn't divide into the resolved columns — 8 lesson beats across 5
 *     columns, 6 pathways across 4.
 *   - Blue is the accent. Orange appears exactly once on the page, on the
 *     open instructor call, because that is the only genuine signal.
 * ============================================================ */

export default async function HomePage() {
  // Testimonials are admin-editable and must be real. Only approved rows are
  // shown — no fabricated seed fallback. The section hides itself when empty.
  const dbTestimonials = await getActiveTestimonials();
  const upcomingPrograms = (await listPublicPrograms()).slice(0, 3);
  const hasOpenPrograms = upcomingPrograms.length > 0;
  const testimonials = dbTestimonials.map((t) => ({
    text: t.quote,
    who: [t.studentName, t.schoolName, t.trackCompleted ? `Track ${t.trackCompleted}` : ""].filter(Boolean).join(" · ").toUpperCase(),
  }));

  const joinPathways = pathways.filter((p) => p.group === "join");
  const hostPathways = pathways.filter((p) => p.group === "host");

  return (
    <div id="main">
      {/* ===== HERO =====
       * The right-hand column is a real front-office brief rendered in type
       * and data rather than a photo slot. The previous composition layered
       * an orange circle and a blue rectangle under an empty image
       * placeholder with `mix-blend-mode: color`, which resolved to a purple
       * gradient blob whenever no photograph was uploaded — i.e. always. */}
      <section style={{ position: "relative", background: "var(--bow-paper)", borderBottom: "1px solid var(--border-rule)", overflow: "clip" }}>
        <div className="bow-ghost bow-para-upbig" aria-hidden style={{ top: -40, right: -60, fontSize: "clamp(180px,30vw,460px)" }}>
          101
        </div>

        <div
          className="bow-container-wide bow-split bow-split-center"
          style={{
            padding: "clamp(40px,6vw,84px) var(--page-inset) clamp(48px,7vw,96px)",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 620 }}>
            <span className="bow-eyebrow-data" style={{ color: "var(--bow-blue)" }}>
              Sports is the hook. Economics is the lesson.
            </span>
            <h1
              style={{
                fontFamily: "var(--font-editorial)", fontWeight: "var(--fw-semibold)",
                fontSize: "var(--type-lead)", lineHeight: "var(--lh-lead)",
                letterSpacing: "var(--track-editorial)", textWrap: "balance",
              }}
            >
              Learn to make the decisions behind the game.
            </h1>
            <p className="bow-lead" style={{ maxWidth: "34ch" }}>
              BOW Sports Capital teaches middle and high school students economics, finance, and strategy by
              putting them in the chair where the calls actually get made.
            </p>
            <div className="bow-actions" style={{ marginTop: "var(--space-2)" }}>
              {hasOpenPrograms ? (
                <Button href="/programs" variant="primary" size="lg">Find a program</Button>
              ) : (
                <Button href="/sign-up" variant="primary" size="lg">Join the interest list</Button>
              )}
              <Button href="#how" variant="secondary" size="lg">See how it works</Button>
            </div>
          </div>

          {/* Front-office brief — the product, shown rather than described. */}
          <div style={{ position: "relative", maxWidth: 560, width: "100%", justifySelf: "end" }}>
            <div style={{ position: "relative", background: "var(--bow-ink)", color: "var(--bow-on-ink)", border: "1px solid var(--border-strong)", overflow: "hidden" }}>
              <div
                aria-hidden
                style={{
                  position: "absolute", inset: 0, pointerEvents: "none",
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                  backgroundSize: "34px 34px",
                }}
              />
              <div
                style={{
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: "var(--space-4)", padding: "14px 20px", borderBottom: "1px solid var(--bow-dark-border)",
                }}
              >
                <span className="bow-eyebrow-data" style={{ color: "var(--bow-on-ink-subtle)" }}>Front-Office Brief</span>
                <span className="bow-eyebrow-data" style={{ background: "var(--bow-blue)", color: "#fff", padding: "4px 9px" }}>
                  Round 03
                </span>
              </div>

              <div style={{ position: "relative", padding: "clamp(20px,2.4vw,28px) 20px" }}>
                <p
                  style={{
                    fontFamily: "var(--font-editorial)", fontWeight: "var(--fw-medium)",
                    fontSize: "var(--type-card)", lineHeight: 1.28, letterSpacing: "var(--track-editorial)",
                  }}
                >
                  Your franchise point guard wants a max extension. The cap says you can&rsquo;t afford it next
                  summer.
                </p>

                <div className="bow-grid bow-grid-2" style={{ gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)", marginTop: "var(--space-6)" }}>
                  {heroDecisionFacts.map((f) => (
                    <div key={f.label} style={{ background: "var(--bow-ink)", padding: "12px 14px" }}>
                      <div className="bow-eyebrow-data" style={{ color: "var(--bow-on-ink-subtle)", marginBottom: 6 }}>{f.label}</div>
                      <div
                        className="bow-stat"
                        style={{ fontSize: 22, color: f.tone === "negative" ? "var(--bow-negative)" : "var(--bow-on-ink)" }}
                      >
                        {f.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "var(--space-6)", display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                  {heroDecisionUnknowns.map((u) => (
                    <span
                      key={u}
                      className="bow-data"
                      style={{
                        fontSize: 10.5, letterSpacing: "0.1em", padding: "5px 9px",
                        border: "1px solid var(--bow-dark-border)", color: "var(--bow-on-ink-subtle)",
                      }}
                    >
                      {u}
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  position: "relative", padding: "14px 20px", borderTop: "1px solid var(--bow-dark-border)",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)",
                }}
              >
                <span className="bow-eyebrow-data" style={{ color: "var(--bow-on-ink-subtle)" }}>You&rsquo;re on the clock</span>
                <Link href="#decide" className="bow-cta-link" style={{ color: "#8fa4ff" }}>
                  Make the call
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DataRibbon />

      {/* ===== WHAT BOW IS + THE LOOP ===== */}
      <section id="how" className="bow-section bow-section-paper">
        <div className="bow-container">
          <div className="bow-section-intro bow-section-intro-wide bow-reveal">
            <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>Welcome to the front office</span>
            <h2 className="bow-headline">Sports are the entry point. Decision-making is the education.</h2>
            <p className="bow-lead">
              BOW doesn&rsquo;t teach sports trivia. Students run into the same constraints real front offices
              face — and defend the calls they make.
            </p>
          </div>

          <ul
            style={{
              display: "flex", flexWrap: "wrap", gap: "var(--space-2)",
              marginTop: "var(--space-8)", padding: 0, listStyle: "none",
            }}
          >
            {concepts.map((c) => (
              <li
                key={c}
                style={{
                  fontFamily: "var(--font-interface)", fontWeight: "var(--fw-medium)",
                  fontSize: "var(--type-body-sm)", padding: "7px 14px",
                  border: "1px solid var(--border-rule)", borderRadius: "var(--radius-pill)",
                  background: "var(--bow-white)", color: "var(--text-secondary)",
                }}
              >
                {c}
              </li>
            ))}
          </ul>

          {/* One loop, stated once. This was previously two four-up grids —
            * "The BOW Learning Model" and "How Each Lesson Works" — naming the
            * same four beats in different words. */}
          <div style={{ marginTop: "clamp(40px,5vw,64px)", borderTop: "1px solid var(--border-rule)", paddingTop: "var(--space-8)" }}>
            <div className="bow-eyebrow-data" style={{ color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
              Every lesson runs the same loop
            </div>
            <ol className="bow-grid bow-grid-4" style={{ padding: 0, margin: 0, listStyle: "none" }}>
              {learningLoop.map((m) => (
                <li key={m.n} className="bow-reveal-sm" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <span className="bow-data" style={{ fontSize: "var(--type-meta)", color: "var(--bow-blue)", fontWeight: "var(--fw-semibold)" }}>{m.n}</span>
                  <span className="bow-display" style={{ fontSize: "var(--type-section)" }}>{m.label}</span>
                  <div style={{ height: 4, background: "var(--bow-blue)", width: "100%" }} />
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", color: "var(--text-secondary)", lineHeight: "var(--lh-body)" }}>
                    {m.body}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ===== THE DECISION — the product demo ===== */}
      <section id="decide" className="bow-section bow-section-ink bow-front-office">
        <div className="bow-container bow-split bow-split-center">
          <div className="bow-section-intro">
            <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>Try the simulation</span>
            <h2 className="bow-display" style={{ fontSize: "var(--type-page)" }}>Don&rsquo;t just learn the decision. Make it.</h2>
            <p className="bow-lead">
              Every lesson ends in an interactive brief: take the role, weigh what you know against what you
              don&rsquo;t, and live with the result.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", marginTop: "var(--space-4)" }}>
              {[
                ["Role", "General Manager"],
                ["Runtime", "12–18 min"],
                ["Format", "Solo or group"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="bow-eyebrow-data" style={{ color: "var(--bow-on-ink-subtle)" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-interface)", fontWeight: "var(--fw-semibold)", fontSize: "var(--type-body)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <DecisionCard
              desk="Decision Desk"
              round="Round 03 · The Extension"
              prompt="Your franchise point guard wants a max extension. The cap says you can't afford it next summer. What do you do tonight?"
              facts={heroDecisionFacts}
              unknowns={heroDecisionUnknowns}
              options={heroDecisionOptions}
              consequence={heroDecisionConsequence}
              primaryLabel="Make the Call"
            />
          </div>
        </div>
      </section>

      {/* ===== TRACKS ===== */}
      <section id="tracks" className="bow-section bow-section-raised">
        <div className="bow-container">
          <div className="bow-section-intro bow-reveal" style={{ marginBottom: "clamp(28px,3.5vw,44px)" }}>
            <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>The programs</span>
            <h2 className="bow-display">Choose your path into sports business.</h2>
          </div>
          <div className="bow-grid bow-grid-2 bow-grid-ruled">
            {tracks.map((t) => (
              <div
                key={t.num}
                style={{
                  display: "flex", flexDirection: "column", gap: "var(--space-4)",
                  padding: "clamp(24px,3vw,36px)", position: "relative",
                  background: t.recommended ? "var(--bow-white)" : "var(--bow-paper)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minHeight: 22 }}>
                  <span className="bow-eyebrow-data" style={{ color: "var(--text-secondary)" }}>{t.kind}</span>
                  {t.recommended && (
                    <span className="bow-eyebrow-data" style={{ background: "var(--bow-blue)", color: "#fff", padding: "4px 9px" }}>
                      Start here
                    </span>
                  )}
                </div>
                <span
                  className="bow-display"
                  style={{ fontSize: "clamp(56px,7vw,92px)", lineHeight: 0.8, letterSpacing: "-0.03em" }}
                >
                  {t.num}
                </span>
                <div style={{ height: 4, background: "var(--bow-blue)", width: 64 }} />
                <h3 style={{ fontFamily: "var(--font-editorial)", fontWeight: "var(--fw-semibold)", fontSize: "var(--type-card)", lineHeight: "var(--lh-card)" }}>
                  {t.title}
                </h3>
                <p style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", lineHeight: "var(--lh-body)", color: "var(--text-secondary)" }}>
                  {t.desc}
                </p>
                <ul style={{ display: "flex", flexDirection: "column", gap: 6, margin: 0, padding: 0, listStyle: "none" }}>
                  {t.meta.map((row) => (
                    <li key={row} className="bow-data" style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "var(--type-meta)", color: "var(--text-secondary)" }}>
                      <span aria-hidden style={{ width: 4, height: 4, background: "var(--bow-blue)", display: "inline-block" }} />
                      {row}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: "auto", paddingTop: "var(--space-4)" }}>
                  <Button href={t.href} variant={t.recommended ? "primary" : "secondary"} size="md" full>
                    {t.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== UPCOMING PROGRAMS =====
       * Sits after the explanation now, not before it: the old order asked a
       * visitor to register for something the page hadn't described yet. */}
      {upcomingPrograms.length > 0 && (
        <section className="bow-section bow-section-paper">
          <div className="bow-container">
            <div className="bow-section-intro" style={{ marginBottom: "clamp(24px,3vw,36px)" }}>
              <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>Open now</span>
              <h2 className="bow-display">Upcoming programs</h2>
            </div>
            <div className="bow-grid bow-grid-3">
              {upcomingPrograms.map((program) => (
                <PublicProgramCard key={program.id} program={program} />
              ))}
            </div>
            <div style={{ marginTop: "var(--space-8)" }}>
              <Button href="/programs" variant="secondary" size="md">See all programs</Button>
            </div>
          </div>
        </section>
      )}

      {/* ===== PROOF ===== */}
      <section id="about" className="bow-section bow-section-ink bow-front-office">
        <div className="bow-container">
          <div className="bow-section-intro" style={{ marginBottom: "clamp(28px,3.5vw,44px)" }}>
            <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>Where BOW stands</span>
            <h2 className="bow-headline">Built and counted, not projected.</h2>
          </div>
          <div className="bow-grid bow-grid-ruled" style={{ gridTemplateColumns: `repeat(${Math.min(impact.length, 5)}, minmax(0, 1fr))` }}>
            {impact.map((i) => (
              <div key={i.label} style={{ background: "var(--bow-ink)", padding: "26px 20px", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <span className="bow-stat" style={{ fontSize: "clamp(28px,3.4vw,42px)", color: "var(--bow-on-ink)" }}>{i.value}</span>
                <span className="bow-eyebrow" style={{ color: "var(--bow-on-ink-subtle)" }}>{i.label}</span>
              </div>
            ))}
          </div>
          {testimonials.length > 0 && (
            <div className="bow-grid bow-grid-3" style={{ gap: "clamp(20px,3vw,40px)", marginTop: "clamp(32px,4vw,48px)" }}>
              {testimonials.map((q) => (
                <figure key={q.who} style={{ margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  <blockquote
                    style={{
                      fontFamily: "var(--font-editorial)", fontWeight: "var(--fw-medium)",
                      fontSize: "var(--type-card)", lineHeight: 1.35, color: "var(--bow-on-ink)",
                    }}
                  >
                    &ldquo;{q.text}&rdquo;
                  </blockquote>
                  <figcaption className="bow-data" style={{ fontSize: "var(--type-meta)", color: "var(--bow-on-ink-subtle)" }}>{q.who}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== WAYS IN =====
       * Six peers in two labelled groups, 3-up. The previous 4-column
       * auto-fit grid rendered them 4 + 2, leaving two empty cells, and gave
       * each card a different accent colour implying a taxonomy. */}
      <section className="bow-section bow-section-paper">
        <div className="bow-container">
          <div className="bow-section-intro bow-reveal" style={{ marginBottom: "clamp(28px,3.5vw,44px)" }}>
            <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>Find your way in</span>
            <h2 className="bow-display">However you got here, there&rsquo;s a door.</h2>
          </div>

          {[
            { head: "Join a program", items: joinPathways },
            { head: "Bring BOW to your group", items: hostPathways },
          ].map((band) => (
            <div key={band.head} style={{ marginBottom: "var(--space-12)" }}>
              <div className="bow-eyebrow-data" style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>{band.head}</div>
              <div className="bow-grid bow-grid-2" style={{ gridTemplateColumns: band.items.length >= 4 ? undefined : "repeat(2, minmax(0,1fr))" }}>
                {band.items.map((p) => (
                  <Link
                    key={p.title}
                    href={p.href}
                    className="bow-card"
                    style={{
                      background: "var(--bow-white)", border: "1px solid var(--border-rule)",
                      borderTop: "3px solid var(--bow-blue)", padding: "24px 22px",
                      display: "flex", flexDirection: "column", gap: "var(--space-3)",
                    }}
                  >
                    <span className="bow-display" style={{ fontSize: "var(--type-card)" }}>{p.title}</span>
                    <p style={{ fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", lineHeight: "var(--lh-body)", color: "var(--text-secondary)", flex: 1 }}>
                      {p.body}
                    </p>
                    <span className="bow-cta-link">{p.cta}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Formats read as a spec list, not six more cards. */}
          <div style={{ borderTop: "1px solid var(--border-rule)", paddingTop: "var(--space-8)" }}>
            <div className="bow-eyebrow-data" style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
              Formats we run
            </div>
            <dl style={{ margin: 0, border: "1px solid var(--border-rule)", background: "var(--bow-white)" }}>
              {formats.map((f, i) => (
                <div
                  key={f.n}
                  style={{
                    display: "flex", alignItems: "baseline", gap: "var(--space-4)", padding: "15px 20px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-rule)",
                  }}
                >
                  <span className="bow-data" style={{ fontSize: "var(--type-meta)", color: "var(--bow-blue)", flex: "0 0 26px" }}>{f.n}</span>
                  <dt className="bow-display" style={{ fontSize: "var(--type-card)", flex: 1 }}>{f.title}</dt>
                  <dd className="bow-data" style={{ margin: 0, fontSize: "var(--type-meta)", color: "var(--text-secondary)" }}>{f.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ===== PODCAST ===== */}
      <section id="podcast" className="bow-section bow-section-raised">
        <div className="bow-container bow-split">
          <div className="bow-section-intro">
            <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>The BOW Sports Capital podcast</span>
            <h2 className="bow-headline">The conversations behind the decisions.</h2>
            <p className="bow-lead">
              Each episode connects sports headlines, front-office strategy, and business concepts to the
              decisions students make throughout the curriculum.
            </p>
            <div style={{ marginTop: "var(--space-4)" }}>
              <Button href="/podcast" variant="ink" size="md">Explore the podcast</Button>
            </div>
          </div>
          <ul style={{ display: "flex", flexDirection: "column", margin: 0, padding: 0, listStyle: "none" }}>
            {homeEpisodes.map((e, i) => (
              <li key={e.num}>
                <Link
                  href="/podcast"
                  style={{
                    display: "flex", gap: "var(--space-4)", padding: "16px 0", alignItems: "baseline",
                    borderTop: i === 0 ? "none" : "1px solid var(--border-rule)", color: "var(--text-primary)",
                  }}
                >
                  <span className="bow-data" style={{ fontWeight: "var(--fw-semibold)", fontSize: "var(--type-meta)", color: "var(--text-secondary)", flex: "0 0 44px" }}>
                    {e.num}
                  </span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>{e.topic}</span>
                    <h3 style={{ fontFamily: "var(--font-editorial)", fontWeight: "var(--fw-semibold)", fontSize: 18, lineHeight: 1.25 }}>{e.title}</h3>
                    <span className="bow-data" style={{ fontSize: "var(--type-meta)", color: "var(--text-secondary)" }}>{e.meta}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===== TEACH WITH BOW =====
       * Moved from position three to here. Orange appears exactly once on
       * this page, and this is it: an open call is a real signal. */}
      <section className="bow-section bow-section-ink">
        <div className="bow-container bow-split">
          <div className="bow-section-intro">
            <span className="bow-eyebrow-data" style={{ color: "var(--bow-orange)" }}>Now recruiting volunteer instructors</span>
            <h2 className="bow-headline">Help us teach the next generation of sports decision-makers.</h2>
            <p className="bow-lead">
              Teaching with BOW is a volunteer role. We provide the curriculum and the training. You bring
              preparation, judgment, and the willingness to improve.
            </p>
            <div className="bow-actions" style={{ marginTop: "var(--space-4)" }}>
              <Button href="/teach" variant="primary" size="lg">Explore teaching at BOW</Button>
              <Button href="/join/sports-economics-instructor" variant="secondary" size="lg">View the opening</Button>
            </div>
          </div>
          <ol className="bow-grid bow-grid-ruled" style={{ gridTemplateColumns: "minmax(0,1fr)", margin: 0, padding: 0, listStyle: "none", alignSelf: "start" }}>
            {["Clear hiring process", "Training before assignment", "Real work with evidence", "Coaching and growth"].map((item, index) => (
              <li key={item} style={{ background: "var(--bow-dark-surface)", padding: "18px 22px", display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
                <span className="bow-data" style={{ color: "var(--bow-blue)" }}>{String(index + 1).padStart(2, "0")}</span>
                <span className="bow-display" style={{ fontSize: "var(--type-card)" }}>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="bow-section bow-section-paper">
        <div className="bow-container">
          <div className="bow-section-intro" style={{ marginBottom: "clamp(28px,3.5vw,44px)" }}>
            <span className="bow-eyebrow" style={{ color: "var(--bow-blue)" }}>FAQ</span>
            <h2 className="bow-display">What people want to know.</h2>
          </div>
          <FaqList items={faqs} />
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section
        style={{
          background: "var(--bow-blue)", color: "#fff",
          padding: "var(--section-y-loose) var(--page-inset)", position: "relative", overflow: "hidden",
        }}
      >
        <div className="bow-ghost bow-ghost-light bow-para-upbig" aria-hidden style={{ right: -40, bottom: -80, fontSize: "clamp(200px,28vw,460px)" }}>
          BOW
        </div>
        <div className="bow-container" style={{ position: "relative" }}>
          <h2 className="bow-display" style={{ fontSize: "var(--type-campaign)", lineHeight: "var(--lh-campaign)" }}>
            Step into the front office.
          </h2>
          <p className="bow-lead" style={{ color: "rgba(255,255,255,0.92)", marginTop: "var(--space-6)" }}>
            Explore the tracks, find the right starting point, and begin making the decisions behind the game.
          </p>
          <div className="bow-actions" style={{ marginTop: "var(--space-8)" }}>
            <Button href="/programs" variant="ink" size="lg">Explore programs</Button>
            <Button href="/sign-up" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}>
              Join the interest list
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
