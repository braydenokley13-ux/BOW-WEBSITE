import Link from "next/link";
import { Button, CapLine, SectionHeader, DecisionCard } from "@/components/ds";
import ImageSlot from "@/components/site/ImageSlot";
import DataRibbon from "@/components/site/DataRibbon";
import FaqList from "@/components/site/FaqList";
import {
  heroDecisionFacts,
  heroDecisionUnknowns,
  heroDecisionOptions,
  heroDecisionConsequence,
  concepts,
  modelSteps,
  lessonFlow,
  tracks,
  featuredLessons,
  lessonSteps,
  homeEpisodes,
  destinations,
  pathways,
  formats,
  impact,
  quotes,
  faqs,
} from "@/lib/home";
import { getActiveTestimonials } from "@/lib/content";

const SECTION_PAD = "clamp(56px,8vw,120px) clamp(18px,4vw,40px)";

export default function HomePage() {
  // Testimonials are admin-editable (Feature 8); fall back to the static
  // seed quotes if none are active. revalidatePath("/") refreshes this after edits.
  const dbTestimonials = getActiveTestimonials();
  const testimonials = dbTestimonials.length
    ? dbTestimonials.map((t) => ({
        text: t.quote,
        who: [t.studentName, t.schoolName, t.trackCompleted ? `Track ${t.trackCompleted}` : ""].filter(Boolean).join(" · ").toUpperCase(),
      }))
    : quotes;

  return (
    <div>
      {/* ===== HERO A — DRAFT BOARD ===== */}
      <section style={{ position: "relative", background: "var(--bow-paper)", borderBottom: "1px solid var(--border-rule)", overflow: "clip" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", top: -40, right: -60, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(180px,30vw,460px)", lineHeight: 0.8, color: "rgba(10,10,11,0.04)", letterSpacing: "-0.04em", pointerEvents: "none" }}>101</div>
        <div className="bow-para-far" aria-hidden style={{ position: "absolute", left: "-4%", bottom: "-8%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(120px,18vw,260px)", lineHeight: 0.8, color: "rgba(49,87,255,0.05)", letterSpacing: "-0.03em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>Draft</div>
        <div className="bow-drift-l" aria-hidden style={{ position: "absolute", left: 0, top: "30%", width: "60%", height: 8, background: "rgba(49,87,255,0.10)", pointerEvents: "none", zIndex: 0 }} />
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", right: "6%", bottom: "12%", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(10,10,11,0.16)", pointerEvents: "none", zIndex: 0 }}>ON THE CLOCK</div>

        <div className="bow-container-wide" style={{ padding: "clamp(40px,6vw,80px) clamp(18px,4vw,40px) clamp(48px,7vw,96px)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "clamp(32px,5vw,64px)", alignItems: "center", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 640 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Sports Business, Built to Be Played</span>
            <h1 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(40px,6.4vw,82px)", lineHeight: 0.96, letterSpacing: "-0.015em", textWrap: "balance" }}>
              The next great sports minds have to start somewhere.
            </h1>
            <CapLine weight={7} step={18} stepAt={0.4} style={{ maxWidth: 320 }} />
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.5vw,21px)", lineHeight: 1.55, color: "var(--bow-slate)", maxWidth: 540 }}>
              BOW Sports Capital helps middle and high school students learn economics, finance, leadership, and strategy by making the same decisions that shape teams, leagues, and the business of sports.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
              <Button href="/programs" variant="primary" size="lg">Explore the Programs</Button>
              <Button href="/#howitworks" variant="secondary" size="lg">See How BOW Works</Button>
            </div>
            <Link href="/podcast" className="bow-link" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)", marginTop: 2 }}>
              Listen to the Podcast →
            </Link>
          </div>

          {/* Scouting-report collage card */}
          <div style={{ position: "relative" }}>
            <div style={{ position: "relative", aspectRatio: "4/5", background: "var(--bow-ink)", overflow: "hidden", border: "1px solid var(--border-strong)" }}>
              <div style={{ position: "absolute", left: "-18%", top: "14%", width: "78%", aspectRatio: "1", borderRadius: 999, background: "var(--bow-orange)" }} />
              <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "42%", backgroundImage: "repeating-linear-gradient(120deg, rgba(255,255,255,0.16) 0 1.5px, transparent 1.5px 13px)" }} />
              <div style={{ position: "absolute", right: -22, top: -44, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(190px,30vw,300px)", lineHeight: 0.7, color: "rgba(255,255,255,0.12)", letterSpacing: "-0.04em", zIndex: 2 }}>03</div>
              <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", width: "84%", height: "80%", zIndex: 3 }}>
                <ImageSlot placeholder="Drop a player cutout" fit="cover" position="50% 12%" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: "grayscale(1) contrast(1.08) brightness(1.04)" }} />
                <div style={{ position: "absolute", inset: 0, background: "var(--bow-blue)", mixBlendMode: "color", opacity: 0.42, pointerEvents: "none" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,10,11,0.5), transparent 45%)", pointerEvents: "none" }} />
              </div>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.14)", zIndex: 4 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#fff" }}>Scouting Report</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", background: "var(--bow-blue)", padding: "2px 8px" }}>Grade · A−</span>
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 18, background: "linear-gradient(to top, rgba(10,10,11,0.94), transparent)", zIndex: 4 }}>
                <div style={{ height: 5, width: 64, background: "var(--bow-blue)", marginBottom: 12 }} />
                <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a9da6" }}>War Room · Round 03</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, textTransform: "uppercase", color: "#fff", letterSpacing: "0.01em" }}>You&apos;re on the clock.</div>
              </div>
            </div>
            <div className="bow-para-down" style={{ position: "absolute", top: -18, left: -18, background: "var(--bow-blue)", color: "#fff", padding: "10px 14px", zIndex: 5 }}>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.8 }}>Cap Space</div>
              <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 22 }}>-$8.4M</div>
            </div>
            <div className="bow-para-up" style={{ position: "absolute", bottom: 40, right: -18, background: "#fff", border: "1px solid var(--border-strong)", padding: "10px 14px", zIndex: 5 }}>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Title Odds</div>
              <div style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 22, color: "var(--bow-ink)" }}>14%</div>
            </div>
          </div>
        </div>
      </section>

      <DataRibbon />

      {/* ===== WHAT BOW IS ===== */}
      <section id="howitworks" style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-far" aria-hidden style={{ position: "absolute", right: "-6%", top: "4%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(120px,20vw,340px)", lineHeight: 0.78, color: "rgba(10,10,11,0.035)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>Decide</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <div className="bow-reveal" style={{ maxWidth: 860 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Welcome to the Front Office</span>
            <h2 className="bow-wipe" style={{ margin: "12px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.4vw,56px)", lineHeight: 1.02, letterSpacing: "-0.01em", textWrap: "balance" }}>
              Sports are the entry point. Decision-making is the education.
            </h2>
            <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.4vw,21px)", lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 680 }}>
              BOW doesn&apos;t teach sports trivia. Students learn by running into the same constraints real front offices face — and defending the calls they make.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 36 }}>
            {concepts.map((c) => (
              <span key={c} style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14, padding: "8px 16px", border: "1px solid var(--border-rule)", borderRadius: 999, background: "#fff" }}>{c}</span>
            ))}
          </div>

          <div style={{ marginTop: 52, borderTop: "1px solid var(--border-rule)", borderBottom: "1px solid var(--border-rule)", padding: "36px 0" }}>
            <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bow-slate)", marginBottom: 22 }}>The BOW Learning Model</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18 }}>
              {modelSteps.map((m) => (
                <div key={m.n} className="bow-reveal-sm" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-blue)", fontWeight: 600 }}>{m.n}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(22px,2.4vw,30px)", textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 0.96 }}>{m.label}</span>
                  <div style={{ height: 5, background: "var(--bow-blue)", width: "100%" }} />
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)", lineHeight: 1.5 }}>{m.body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== CHOOSE YOUR TRACK ===== */}
      <section id="tracks" style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", left: "-3%", top: "8%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(120px,18vw,300px)", lineHeight: 0.8, color: "rgba(10,10,11,0.035)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>Path</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <div className="bow-reveal" style={{ marginBottom: 44 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>The Programs</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(34px,5vw,64px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase", maxWidth: "16ch" }}>Choose your path into sports business.</h2>
          </div>
          <div className="bow-track-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", border: "1px solid var(--border-rule)" }}>
            {tracks.map((t) => (
              <div key={t.num} style={{ display: "flex", flexDirection: "column", gap: 18, padding: "clamp(24px,3vw,36px)", borderRight: "1px solid var(--border-rule)", background: t.bg, color: t.fg, position: "relative", minHeight: "100%" }}>
                {t.recommended && (
                  <div style={{ position: "absolute", top: 0, left: 0, background: "var(--bow-blue)", color: "#fff", fontFamily: "var(--font-data)", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 10px" }}>Recommended Start</div>
                )}
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: t.topPad }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(56px,7vw,92px)", lineHeight: 0.8, letterSpacing: "-0.03em" }}>{t.num}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: t.kindColor }}>{t.kind}</span>
                </div>
                <div style={{ height: 5, background: t.line, width: 64 }} />
                <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 24, lineHeight: 1.1 }}>{t.title}</h3>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, color: t.muted }}>{t.desc}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
                  {t.meta.map((row) => (
                    <div key={row} style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.02em", color: t.muted }}>
                      <span style={{ width: 4, height: 4, background: t.line, display: "inline-block" }} />
                      {row}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "auto", paddingTop: 18 }}>
                  <Button href={t.href} variant={t.btnVariant} size="md" full>{t.cta}</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW EACH LESSON WORKS (dark) ===== */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-far" aria-hidden style={{ position: "absolute", right: "-2%", top: "-10%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(180px,30vw,520px)", lineHeight: 0.7, color: "rgba(255,255,255,0.04)", letterSpacing: "-0.04em", pointerEvents: "none", zIndex: 0 }}>04</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <div style={{ marginBottom: 48, maxWidth: 760 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>How Each Lesson Works</span>
            <h2 className="bow-wipe" style={{ margin: "12px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.4vw,54px)", lineHeight: 1.02, letterSpacing: "-0.01em", textWrap: "balance" }}>
              Not a simulation library. A structured way to make decisions.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)" }}>
            {lessonFlow.map((s) => (
              <div key={s.n} className="bow-reveal-sm" style={{ background: "var(--bow-ink)", padding: "clamp(24px,2.6vw,34px)", display: "flex", flexDirection: "column", gap: 14 }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 30, color: "var(--bow-blue)" }}>{s.n}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1 }}>{s.label}</span>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "#b9bcc4" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED LESSONS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-far" aria-hidden style={{ position: "absolute", right: "-5%", bottom: "-6%", fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 600, fontSize: "clamp(110px,16vw,260px)", lineHeight: 0.8, color: "rgba(10,10,11,0.04)", letterSpacing: "-0.02em", pointerEvents: "none", zIndex: 0 }}>Decisions</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <SectionHeader kicker="Featured Lessons" title="Front-office decisions, built for students." style={{ marginBottom: 40 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "clamp(20px,2.5vw,32px)" }}>
            {featuredLessons.map((l) => (
              <Link key={l.bigNum} href={l.href} className="bow-reveal-sm bow-card" style={{ background: "#fff", border: "1px solid var(--border-rule)", display: "flex", flexDirection: "column", color: "var(--bow-ink)" }}>
                <div style={{ aspectRatio: "16/10", background: "var(--bow-ink)", position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end", padding: 16 }}>
                  <div style={{ position: "absolute", top: 14, right: 16, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 64, lineHeight: 0.8, color: "rgba(255,255,255,0.08)" }}>{l.bigNum}</div>
                  <div style={{ position: "relative" }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>{l.category}</span>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, textTransform: "uppercase", color: "#fff", lineHeight: 0.95, marginTop: 4 }}>{l.hook}</div>
                  </div>
                </div>
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", color: "var(--bow-slate)" }}>{l.trackmod}</span>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 21, lineHeight: 1.15 }}>{l.title}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", borderTop: "1px solid var(--border-rule)", paddingTop: 12, marginTop: 2 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>DECISION</span><span style={{ color: "var(--bow-ink)", textAlign: "right" }}>{l.decision}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>CONCEPT</span><span style={{ color: "var(--bow-ink)", textAlign: "right" }}>{l.concept}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>RUNTIME</span><span style={{ color: "var(--bow-ink)" }}>{l.runtime}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>PODCAST</span><span style={{ color: "var(--bow-blue)" }}>{l.podcast}</span></div>
                  </div>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)", marginTop: 4 }}>View the Lesson →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== LESSON ARCHITECTURE ===== */}
      <section id="lessons" style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", left: "-3%", top: "8%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(120px,18vw,300px)", lineHeight: 0.8, color: "rgba(10,10,11,0.03)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>Case</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "clamp(24px,4vw,52px)", alignItems: "start", marginBottom: 52 }}>
            <div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Lesson Architecture</span>
              <h2 className="bow-wipe" style={{ margin: "12px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.4vw,54px)", lineHeight: 1.02, letterSpacing: "-0.01em", textWrap: "balance" }}>Every lesson is a front-office case file.</h2>
              <p style={{ margin: "20px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,19px)", lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 480 }}>The lesson isn’t the information delivered. The lesson is the decision the content forces you to make.</p>
            </div>
            <div style={{ border: "1px solid var(--border-rule)", borderLeft: "5px solid var(--bow-blue)", padding: "clamp(20px,2.4vw,28px)", background: "var(--bow-paper)" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>Example · Track 101 · M1 · L2</span>
              <h3 style={{ margin: "10px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 0.95 }}>Opportunity Cost, in Trades</h3>
              <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)", lineHeight: 1.5 }}>You’re the GM. A title contender wants your franchise player. Win sooner, or keep the asset everyone wants? Every yes is a no somewhere else on the roster.</p>
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, padding: "4px 10px", border: "1px solid var(--border-rule)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>14 MIN</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, padding: "4px 10px", border: "1px solid var(--bow-blue)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)" }}>SIM READY</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, padding: "4px 10px", border: "1px solid var(--bow-orange)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-orange)" }}>EP 04</span>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, background: "var(--border-rule)", border: "1px solid var(--border-rule)" }}>
            {lessonSteps.map((s) => (
              <div key={s.n} className="bow-reveal-sm" style={{ background: s.bg, color: s.fg, padding: "clamp(20px,2.2vw,26px)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-data)", fontWeight: 700, fontSize: 26, color: s.numColor, lineHeight: 0.9 }}>{s.n}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: s.tagColor, border: `1px solid ${s.tagColor}`, padding: "2px 7px" }}>{s.tag}</span>
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 17, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1 }}>{s.label}</span>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.55, color: s.muted }}>{s.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 36, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Button href="/lessons" variant="primary" size="lg">Open a Lesson</Button>
            <Button href="/lessons" variant="secondary" size="lg">View All Lessons</Button>
          </div>
        </div>
      </section>

      {/* ===== SIMULATION SPOTLIGHT ===== */}
      <section id="simulations" className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", inset: "-20% 0", backgroundImage: "linear-gradient(rgba(49,87,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(49,87,255,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none", zIndex: 0 }} />
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", left: "-3%", top: "-8%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,26vw,460px)", lineHeight: 0.7, color: "rgba(255,255,255,0.035)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>Make It</div>
        <div className="bow-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "center", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Simulation Spotlight</span>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(34px,5vw,68px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Don&apos;t just learn the decision. Make it.</h2>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.6, color: "#b9bcc4", maxWidth: 520 }}>
              Every lesson ends in a standalone interactive experience where you take the role, weigh what you know against what you don&apos;t, and live with the result. Here&apos;s a brief from the war room.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 6 }}>
              {[
                ["Role", "General Manager"],
                ["Runtime", "12–18 min"],
                ["Format", "Solo or group"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6d7078" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <Button href="/simulation" variant="primary" size="lg">Open the Simulation</Button>
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
              secondaryLabel="Review the Cap Sheet"
            />
          </div>
        </div>
      </section>

      {/* ===== PODCAST ===== */}
      <section id="podcast" style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-far" aria-hidden style={{ position: "absolute", right: "-4%", top: "2%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(110px,17vw,280px)", lineHeight: 0.8, color: "rgba(10,10,11,0.035)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>On Air</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>The BOW Sports Capital Podcast</span>
              <h2 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.2vw,52px)", lineHeight: 1.02, letterSpacing: "-0.01em", textWrap: "balance" }}>The conversations behind the decisions.</h2>
              <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 520 }}>Each episode connects sports headlines, front-office strategy, and business concepts to the decisions students make throughout the curriculum.</p>
              <div style={{ marginTop: 6 }}>
                <Button href="/podcast" variant="ink" size="md">Explore the Podcast</Button>
              </div>
              <div style={{ marginTop: 12, border: "1px solid var(--border-rule)", display: "flex", alignItems: "stretch" }}>
                <div style={{ flex: "0 0 128px", background: "var(--bow-ink)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 999, background: "var(--bow-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 18, marginLeft: 3 }}>▶</span></div>
                  <span style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", color: "#9a9da6" }}>EP 07</span>
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Latest · Salary Cap</span>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 19, lineHeight: 1.15 }}>The Apron Era: How One Rule Rewired the League</h3>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>38 MIN · CONNECTS TO TRACK 101 · M3 L2</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {homeEpisodes.map((e) => (
                <Link key={e.num} href="/podcast" style={{ display: "flex", gap: 16, padding: "18px 0", borderBottom: "1px solid var(--border-rule)", alignItems: "center", color: "var(--bow-ink)" }}>
                  <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: 13, color: "var(--bow-slate)", flex: "0 0 42px" }}>{e.num}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>{e.topic}</span>
                    <h4 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 18, lineHeight: 1.2 }}>{e.title}</h4>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{e.meta}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== HIGHWAY WORLD ===== */}
      <section id="highway" className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(64px,9vw,140px) clamp(18px,4vw,40px)", position: "relative", overflow: "hidden", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div aria-hidden style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 2, background: "repeating-linear-gradient(to bottom, var(--bow-orange) 0 22px, transparent 22px 44px)", opacity: 0.5 }} />
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", left: "50%", top: "18%", marginLeft: "-0.5em", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(160px,28vw,520px)", lineHeight: 0.7, color: "rgba(255,255,255,0.03)", letterSpacing: "-0.05em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>GM</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <div style={{ textAlign: "center", maxWidth: 900, margin: "0 auto" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>The BOW Universe Is Expanding</span>
            <h2 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(38px,6vw,86px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", textWrap: "balance" }}>The road to the front office is about to become a world.</h2>
            <p style={{ margin: "22px auto 0", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.4vw,20px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 620 }}>Drive through a connected sports city, enter the buildings where decisions are made, and confront the economic forces shaping every franchise.</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 18, border: "1px solid var(--bow-dark-border)", padding: "6px 14px", borderRadius: 999 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--bow-warning)", display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b9bcc4" }}>Currently in Development</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)", marginTop: 56 }}>
            {destinations.map((d) => (
              <div key={d.code} className="bow-reveal-sm" style={{ background: "var(--bow-dark-surface)", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 10, minHeight: 150 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", color: "var(--bow-blue)" }}>{d.code}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, textTransform: "uppercase", lineHeight: 0.95, letterSpacing: "-0.01em" }}>{d.title}</span>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "#9a9da6", lineHeight: 1.45, marginTop: "auto" }}>{d.body}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 44 }}>
            <Button href="/highway-world" variant="primary" size="lg">Discover Highway World</Button>
            <Button href="/sign-up" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "var(--bow-dark-border)" }}>Get Launch Updates</Button>
          </div>
        </div>
      </section>

      {/* ===== AUDIENCE PATHWAYS ===== */}
      <section style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-far" aria-hidden style={{ position: "absolute", left: "-4%", bottom: "-8%", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(120px,18vw,320px)", lineHeight: 0.8, color: "rgba(10,10,11,0.035)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>Enter</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <div className="bow-reveal" style={{ marginBottom: 44, maxWidth: 760 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>Find Your Way In</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.8vw,60px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Find your way into the front office.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "clamp(16px,2vw,24px)" }}>
            {pathways.map((p) => (
              <div key={p.title} className="bow-reveal-sm" style={{ background: "#fff", border: "1px solid var(--border-rule)", borderTop: `4px solid ${p.accent}`, padding: "26px 22px", display: "flex", flexDirection: "column", gap: 12, minHeight: "100%" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, textTransform: "uppercase", letterSpacing: "-0.01em" }}>{p.title}</span>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "var(--bow-slate)", flex: 1 }}>{p.body}</p>
                <Link href={p.href} className="bow-link" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)" }}>{p.cta} →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PARTNERSHIPS ===== */}
      <section style={{ background: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-sink" aria-hidden style={{ position: "absolute", right: "-3%", top: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(110px,17vw,300px)", lineHeight: 0.8, color: "rgba(10,10,11,0.035)", letterSpacing: "-0.04em", textTransform: "uppercase", pointerEvents: "none", zIndex: 0 }}>Campus</div>
        <div className="bow-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "center", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>For Schools &amp; Camps</span>
            <h2 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.2vw,52px)", lineHeight: 1.02, letterSpacing: "-0.01em", textWrap: "balance" }}>Bring the front office to your students.</h2>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 480 }}>BOW works with schools, camps, and enrichment programs to put students in the room where sports-business decisions get made — for an afternoon or a full season.</p>
            <div style={{ marginTop: 6 }}>
              <Button href="/get-involved/schools" variant="primary" size="md">Explore Partnerships</Button>
            </div>
          </div>
          <div style={{ border: "1px solid var(--border-rule)" }}>
            {formats.map((f) => (
              <div key={f.n} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 22px", borderBottom: "1px solid var(--border-rule)" }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, color: "var(--bow-blue)", flex: "0 0 28px" }}>{f.n}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.01em", flex: 1 }}>{f.title}</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>{f.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== IMPACT / CREDIBILITY ===== */}
      <section id="about" className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: SECTION_PAD, borderBottom: "1px solid var(--bow-dark-border)", position: "relative", overflow: "clip" }}>
        <div className="bow-para-far" aria-hidden style={{ position: "absolute", right: "-4%", top: "-6%", fontFamily: "var(--font-editorial)", fontStyle: "italic", fontWeight: 600, fontSize: "clamp(120px,20vw,360px)", lineHeight: 0.78, color: "rgba(255,255,255,0.035)", letterSpacing: "-0.02em", pointerEvents: "none", zIndex: 0 }}>Proof</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 1, background: "var(--bow-dark-border)", border: "1px solid var(--bow-dark-border)" }}>
            {impact.map((i) => (
              <div key={i.label} style={{ background: "var(--bow-ink)", padding: "28px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-data)", fontWeight: 600, fontSize: "clamp(30px,4vw,46px)", letterSpacing: "-0.01em", color: "#fff" }}>{i.value}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9da6" }}>{i.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "clamp(20px,3vw,40px)", marginTop: 40 }}>
            {testimonials.map((q) => (
              <figure key={q.who} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                <blockquote style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 500, fontSize: 22, lineHeight: 1.3, color: "#fff" }}>&ldquo;{q.text}&rdquo;</blockquote>
                <figcaption style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "#9a9da6" }}>{q.who}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" style={{ background: "var(--bow-paper)", padding: SECTION_PAD, borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container">
          <div style={{ marginBottom: 44, maxWidth: 640 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-blue)" }}>FAQ</span>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(34px,5vw,64px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase", maxWidth: "14ch" }}>What people want to know.</h2>
          </div>
          <FaqList items={faqs} />
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section style={{ background: "var(--bow-blue)", color: "#fff", padding: "clamp(64px,10vw,150px) clamp(18px,4vw,40px)", position: "relative", overflow: "hidden" }}>
        <div className="bow-para-upbig" aria-hidden style={{ position: "absolute", right: -40, bottom: -80, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(200px,28vw,460px)", lineHeight: 0.7, color: "rgba(255,255,255,0.08)", pointerEvents: "none" }}>BOW</div>
        <div className="bow-container" style={{ position: "relative" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Your Seat Is Open</span>
          <h2 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(44px,8vw,120px)", lineHeight: 0.86, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Step into the front office.</h2>
          <p style={{ margin: "22px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(17px,1.5vw,21px)", lineHeight: 1.55, color: "rgba(255,255,255,0.9)", maxWidth: 560 }}>Explore the tracks, find the right starting point, and begin making the decisions behind the game.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
            <Button href="/programs" variant="ink" size="lg">Explore Programs</Button>
            <Button href="/sign-up" variant="secondary" size="lg" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.6)" }}>Sign Up</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
