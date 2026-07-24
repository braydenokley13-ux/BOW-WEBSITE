import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { SectionHeader } from "@/components/ds";
import { getOpenDocket } from "@/lib/questions";
import { getLedgerEventsSync } from "@/lib/ledger-store";
import { summarizeLastWeek, LEDGER_EVENT_LABELS } from "@/lib/ledger";
import { getPublishedArticles } from "@/lib/articles";
import { QUESTION_KIND_LABELS } from "@/lib/research-types";
import {
  CONTENT_FORMATS,
  DESK_ASSIGNMENTS,
  STATUS_LABELS,
  STATUS_ORDER,
  URGENCY_LABELS,
  RESIDUE_KIND_LABELS,
  getFormat,
  groupByStatus,
  deskCounts,
  signalKindLabel,
  resolveSignalQuestion,
  type DeskAssignment,
} from "@/lib/desk";

const TITLE = "The Research Desk";
const DESCRIPTION =
  "Bow's editorial command center: the model flags signals, signals become assignments, assignments become published research, and every piece deposits residue that makes the machine smarter.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics/desk" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Signals come from the live docket + ledger; render per-request.
export const dynamic = "force-dynamic";

/* ---------- shared type snippets (inline-style convention) ---------- */

const kicker: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bow-orange)",
};

const chip: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  padding: "3px 8px",
  borderRadius: 3,
  whiteSpace: "nowrap",
};

const bodyText: CSSProperties = {
  fontFamily: "var(--font-interface)",
  fontSize: 13.5,
  lineHeight: 1.55,
  color: "var(--bow-slate)",
};

const mono: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11.5,
  letterSpacing: "0.03em",
  color: "var(--bow-slate)",
};

function AssignmentCard({ assignment, liveQuestionId }: { assignment: DeskAssignment; liveQuestionId: string | null }) {
  const a = assignment;
  const format = getFormat(a.format);
  const killed = a.status === "killed";
  return (
    <article
      style={{
        border: "1px solid var(--border-rule)",
        borderLeft: `3px solid ${killed ? "var(--bow-slate)" : "var(--bow-orange)"}`,
        background: "#fff",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: killed ? 0.75 : 1,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ ...chip, background: "var(--bow-ink)", color: "#fff" }}>{format.name}</span>
        <span style={{ ...chip, background: "var(--bow-paper)", color: "var(--bow-ink)", border: "1px solid var(--border-rule)" }}>
          {STATUS_LABELS[a.status]}
        </span>
        {!killed && a.status !== "published" && (
          <span style={{ ...chip, background: a.urgency === "now" || a.urgency === "this-week" ? "var(--bow-orange)" : "var(--bow-paper)", color: a.urgency === "now" || a.urgency === "this-week" ? "#fff" : "var(--bow-slate)", border: "1px solid var(--border-rule)" }}>
            {URGENCY_LABELS[a.urgency]}
          </span>
        )}
        <span style={{ ...mono, marginLeft: "auto" }}>{a.owner} · opened {a.openedAt}</span>
      </div>

      <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 18, lineHeight: 1.3, color: "var(--bow-ink)", textWrap: "pretty" }}>
        {a.articleSlug ? (
          <Link href={`/analytics/articles/${a.articleSlug}`} className="bow-link" style={{ color: "var(--bow-ink)", textDecoration: "none" }}>
            {a.title}
          </Link>
        ) : (
          a.title
        )}
      </h3>

      {/* Signal → the file's origin, joined live where possible */}
      <p style={{ ...bodyText, margin: 0 }}>
        <strong style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          Signal · {signalKindLabel(a.signal.kind, QUESTION_KIND_LABELS)}
        </strong>{" "}
        — {a.signal.summary}{" "}
        {liveQuestionId && (
          <Link href={`/analytics/questions/${encodeURIComponent(liveQuestionId)}`} className="bow-link" style={{ color: "var(--bow-blue)" }}>
            live on the docket →
          </Link>
        )}
      </p>

      <p style={{ ...bodyText, margin: 0 }}>
        <strong style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          Lens angle
        </strong>{" "}
        — {a.lensAngle}
      </p>

      {a.dataNeeds.length > 0 && (
        <p style={{ ...bodyText, margin: 0 }}>
          <strong style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            Needs data
          </strong>{" "}
          — {a.dataNeeds.join("; ")}
        </p>
      )}

      {a.residue.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {a.residue.map((r, i) => (
            <span
              key={i}
              title={r.description}
              style={{ ...chip, background: r.delivered ? "var(--bow-ink)" : "transparent", color: r.delivered ? "#fff" : "var(--bow-slate)", border: "1px dashed var(--border-rule)" }}
            >
              {r.delivered ? "✓ " : "◌ "}
              {RESIDUE_KIND_LABELS[r.kind]}
            </span>
          ))}
        </div>
      )}

      <p style={{ ...bodyText, margin: 0, paddingTop: 8, borderTop: "1px solid var(--border-rule)" }}>
        <strong style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", color: killed ? "var(--bow-slate)" : "var(--bow-orange)" }}>
          {killed ? "Killed because" : "Next action"}
        </strong>{" "}
        — {killed ? a.killedBecause : a.nextAction}
      </p>
    </article>
  );
}

export default async function ResearchDeskPage() {
  const docket = (await getOpenDocket());
  const signals = [...docket].sort((a, b) => b.heat - a.heat).slice(0, 5);
  const ledgerEvents = (await getLedgerEventsSync());
  const recentEvents = [...ledgerEvents].sort((a, b) => b.at - a.at).slice(0, 4);
  const week = (await summarizeLastWeek(ledgerEvents));
  const published = (await getPublishedArticles()).slice(0, 4);
  const grouped = groupByStatus(DESK_ASSIGNMENTS);
  const counts = deskCounts(DESK_ASSIGNMENTS);
  const resolved = new Map(DESK_ASSIGNMENTS.map((a) => [a.id, resolveSignalQuestion(a, docket)?.id ?? null]));

  return (
    <div data-screen-label="Research Desk">
      {/* MASTHEAD — front-office mode */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(40px,5.5vw,76px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <span style={{ ...kicker, fontSize: 12, letterSpacing: "0.12em" }}>BOW Analytics · The Research Desk</span>
          <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(30px,4.6vw,54px)", lineHeight: 1.05, letterSpacing: "-0.018em", maxWidth: "20ch", color: "#fff", textWrap: "pretty" }}>
            The machine flags it. The desk assigns it. The piece pays it back.
          </h1>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(14px,1.5vw,17px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 660 }}>
            Bow doesn&rsquo;t keep a content calendar. The model mines its own output for tensions it can&rsquo;t settle,
            the desk triages those signals into assignments, and every published piece must deposit{" "}
            <strong style={{ color: "#fff" }}>residue</strong> — a detector, an embed, a data column — that widens what
            the machine can see next. Articles here aren&rsquo;t posts. They&rsquo;re moves in a research program.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 26px", marginTop: 24, fontFamily: "var(--font-data)", fontSize: 12.5, letterSpacing: "0.04em", color: "#c8cad0" }}>
            <span><strong style={{ color: "#fff" }}>{docket.length}</strong> open questions on the docket</span>
            <span><strong style={{ color: "#fff" }}>{counts.active}</strong> active desk files</span>
            <span><strong style={{ color: "#fff" }}>{counts.residueDelivered}/{counts.residuePlanned}</strong> residue artifacts delivered</span>
            <span>
              this week on the ledger: <strong style={{ color: "#fff" }}>{week.flips}</strong> flips ·{" "}
              <strong style={{ color: "#fff" }}>{week.opened + week.reopened}</strong> opened ·{" "}
              <strong style={{ color: "#fff" }}>{week.settled}</strong> settled
            </span>
          </div>
        </div>
      </section>

      {/* THE FLYWHEEL, IN ONE LINE */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(14px,2vw,20px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 10px", fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          {["Detector fires", "Signal triaged", "Assignment scoped", "Investigated in the notebook", "Published with live embeds", "Residue deposited", "Detectors see more"].map((step, i, arr) => (
            <span key={step} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: i === arr.length - 1 ? "var(--bow-orange)" : "var(--bow-ink)", fontWeight: 600 }}>{step}</span>
              {i < arr.length - 1 && <span aria-hidden style={{ color: "var(--bow-orange)" }}>→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* SIGNALS — what the machine flagged */}
      <section style={{ background: "#fff", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <SectionHeader
            kicker="Live from the machine"
            title="Signals"
            action={{ label: `Full docket (${docket.length}) →`, href: "/analytics/questions" }}
            style={{ marginBottom: 8 }}
          />
          <p style={{ ...bodyText, margin: "0 0 22px", maxWidth: 640 }}>
            Nothing below was written by a person. These are the hottest tensions the detectors mined from the live
            model tonight, plus the most recent entries the ledger put on the record. Signals become assignments —
            or they get killed, on the record.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "clamp(18px,3vw,36px)" }}>
            <div>
              <h3 style={{ ...kicker, margin: "0 0 12px" }}>Hottest open questions</h3>
              {signals.map((q) => (
                <div key={q.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border-rule)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
                      {QUESTION_KIND_LABELS[q.kind]}
                    </span>
                    <span style={{ ...mono, marginLeft: "auto" }} title="Deterministic interestingness ranking">heat {q.heat}</span>
                  </div>
                  <Link href={`/analytics/questions/${encodeURIComponent(q.id)}`} className="bow-link" style={{ fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 15.5, lineHeight: 1.35, color: "var(--bow-ink)", textDecoration: "none", textWrap: "pretty" }}>
                    {q.question}
                  </Link>
                </div>
              ))}
              {signals.length === 0 && <p style={bodyText}>No open questions on the current slate.</p>}
            </div>
            <div>
              <h3 style={{ ...kicker, margin: "0 0 12px" }}>The model on the record</h3>
              {recentEvents.map((e) => (
                <div key={e.id} style={{ padding: "12px 0", borderTop: "1px solid var(--border-rule)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
                      {LEDGER_EVENT_LABELS[e.kind]}
                    </span>
                    <span style={{ ...mono, marginLeft: "auto" }}>{new Date(e.at).toISOString().slice(0, 10)}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 15.5, lineHeight: 1.35, color: "var(--bow-ink)", textWrap: "pretty" }}>{e.headline}</span>
                </div>
              ))}
              {recentEvents.length === 0 && (
                <p style={bodyText}>
                  No ledger history on this instance yet — the nightly snapshot writes the first entry.{" "}
                  <Link href="/analytics/ledger" className="bow-link" style={{ color: "var(--bow-blue)" }}>How the ledger works →</Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* THE PIPELINE — desk assignments */}
      <section style={{ background: "var(--bow-paper)", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <SectionHeader kicker="The board" title="Desk assignments" style={{ marginBottom: 8 }} />
          <p style={{ ...bodyText, margin: "0 0 26px", maxWidth: 680 }}>
            Every file names its source signal, its lens angle, its format, its next physical action — and the residue
            it owes the machine before it counts as done. Killed files stay on the board: what the desk refuses to
            write is part of the record. The board is a typed file (<code style={{ fontFamily: "var(--font-data)", fontSize: 12 }}>lib/desk.ts</code>) edited
            on triage, until the database migration lands.
          </p>
          {STATUS_ORDER.map((status) => {
            const items = grouped.get(status)!;
            if (items.length === 0) return null;
            return (
              <div key={status} style={{ marginBottom: 28 }}>
                <h3 style={{ ...kicker, margin: "0 0 12px" }}>
                  {STATUS_LABELS[status]} · {items.length}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                  {items.map((a) => (
                    <AssignmentCard key={a.id} assignment={a} liveQuestionId={resolved.get(a.id) ?? null} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FORMATS — the portfolio */}
      <section style={{ background: "#fff", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container-wide">
          <SectionHeader kicker="The portfolio" title="What the desk publishes" style={{ marginBottom: 8 }} />
          <p style={{ ...bodyText, margin: "0 0 24px", maxWidth: 680 }}>
            Seven formats, chosen so one editor can run all of them (research/09 §7). A format that requires{" "}
            <strong>residue</strong> cannot ship as prose alone — it must leave a detector, embed, data column, or model
            revision behind.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {CONTENT_FORMATS.map((f) => (
              <article key={f.id} style={{ border: "1px solid var(--border-rule)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, background: "var(--bow-paper)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-ink)" }}>{f.name}</h3>
                  {f.residueRequired && <span style={{ ...chip, background: "var(--bow-orange)", color: "#fff" }}>residue required</span>}
                </div>
                <p style={{ ...bodyText, margin: 0 }}>{f.purpose}</p>
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 10px", ...mono, fontSize: 11.5 }}>
                  <dt style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Audience</dt><dd style={{ margin: 0 }}>{f.audience}</dd>
                  <dt style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Time</dt><dd style={{ margin: 0 }}>{f.timeCost}</dd>
                  <dt style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Cadence</dt><dd style={{ margin: 0 }}>{f.cadence}</dd>
                  <dt style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Rigor bar</dt><dd style={{ margin: 0 }}>{f.rigor}</dd>
                  <dt style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Model tie</dt><dd style={{ margin: 0 }}>{f.modelConnection}</dd>
                </dl>
                <p style={{ ...mono, margin: 0, fontStyle: "italic" }}>e.g. {f.examples.join(" · ")}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ARTICLE → PRODUCT */}
      <section className="bow-front-office" style={{ background: "var(--bow-ink)", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}>
        <div className="bow-container-wide">
          <SectionHeader kicker="Nothing ships as prose alone" title="What a piece leaves behind" style={{ marginBottom: 8 }} />
          <p style={{ margin: "0 0 24px", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.6, color: "#c8cad0", maxWidth: 680 }}>
            A desk file doesn&rsquo;t end when the article publishes. Its embeds stay live (they re-run the real engines
            on every read), its interactive core can be promoted to a permanent tool, its findings can revise the model
            itself, and its leftovers become detectors and teaching artifacts. One investigation, six exits:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              { label: "Article", desc: "Published with live data embeds — numbers never rot.", href: "/analytics/articles" },
              { label: "Interactive embed", desc: "The piece's chart becomes a shortcode every later piece reuses.", href: "/analytics/methods" },
              { label: "Model update", desc: "A finding that breaks the model becomes a versioned revision + Method Memo.", href: "/analytics/methods" },
              { label: "New detector", desc: "The tension class the piece exposed gets mined automatically forever.", href: "/analytics/questions" },
              { label: "Teaching artifact", desc: "The finding, rewritten for Track 101/201 with re-runnable numbers.", href: "/programs" },
              { label: "Partner memo", desc: "The same evidence, compiled in front-office memo discipline.", href: "/get-involved/partners" },
            ].map((x) => (
              <Link key={x.label} href={x.href} style={{ textDecoration: "none", border: "1px solid var(--bow-dark-border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-orange)" }}>{x.label} →</span>
                <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.5, color: "#c8cad0" }}>{x.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PUBLISHED RESEARCH + PATHWAYS */}
      <section style={{ background: "#fff", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          <SectionHeader
            kicker="On the record"
            title="Published research"
            action={{ label: "All articles →", href: "/analytics/articles" }}
            style={{ marginBottom: 18 }}
          />
          {published.length > 0 ? (
            <div style={{ marginBottom: 30 }}>
              {published.map((a, i) => (
                <div key={a.id} style={{ display: "flex", gap: 14, alignItems: "baseline", padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid var(--border-rule)" }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--bow-orange)", flex: "0 0 auto" }}>{a.category}</span>
                  <Link href={`/analytics/articles/${a.slug}`} className="bow-link" style={{ fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 16.5, color: "var(--bow-ink)", textDecoration: "none", textWrap: "pretty" }}>
                    {a.title}
                  </Link>
                  <span style={{ ...mono, marginLeft: "auto", flex: "0 0 auto" }}>{a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 10) : ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ ...bodyText, marginBottom: 30 }}>Nothing published on this instance yet — the board above shows what&rsquo;s coming.</p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", paddingTop: 18, borderTop: "1px solid var(--border-rule)" }}>
            {[
              ["Open the docket", "/analytics/questions"],
              ["Read the ledger", "/analytics/ledger"],
              ["Your notebook", "/analytics/notebook"],
              ["How the model works", "/analytics/methods"],
              ["Run the numbers", "/analytics"],
              ["Trade machine", "/analytics/trade"],
            ].map(([label, href]) => (
              <Link key={href} href={href} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)", textDecoration: "none" }}>
                {label} →
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
