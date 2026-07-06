import type { Metadata } from "next";
import Link from "next/link";
import { getLedgerEvents, getLedgerDepth } from "@/lib/ledger-store";
import { LEDGER_EVENT_LABELS, summarizeLastWeek, type LedgerEvent, type LedgerEventKind } from "@/lib/ledger";
import ClipButton from "@/components/research/ClipButton";

const TITLE = "The Open Ledger — BOW Sports Capital Analytics";
const DESCRIPTION =
  "A dated public record of the model changing its mind — verdicts that flipped, questions that opened and settled — as real league data moves underneath it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/analytics/ledger" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// The ledger turns its own page on the first read of the day, so this
// must run on every request — same reasoning as the docket board.
export const dynamic = "force-dynamic";

/** Kind accents, same palette discipline as the docket chips. */
const KIND_COLORS: Record<LedgerEventKind, string> = {
  "verdict-flip": "var(--bow-orange)",
  "contested-change": "var(--bow-negative)",
  "question-opened": "var(--bow-blue)",
  "question-reopened": "var(--bow-blue)",
  "question-settled": "var(--bow-positive)",
};

function KindChip({ kind }: { kind: LedgerEventKind }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-data)",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: KIND_COLORS[kind],
        border: `1px solid ${KIND_COLORS[kind]}`,
        borderRadius: 2,
        padding: "3px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {LEDGER_EVENT_LABELS[kind]}
    </span>
  );
}

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Group the stream into UTC days, newest first (stream is already sorted). */
function groupByDay(events: LedgerEvent[]): { day: string; events: LedgerEvent[] }[] {
  const groups: { day: string; events: LedgerEvent[] }[] = [];
  for (const e of events) {
    const day = new Date(e.at).toISOString().slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.events.push(e);
    else groups.push({ day, events: [e] });
  }
  return groups;
}

function EventRow({ event }: { event: LedgerEvent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "18px 6px", borderBottom: "1px solid var(--border-rule)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <KindChip kind={event.kind} />
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          heat {event.heat}
        </span>
      </div>
      <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(17px,2vw,21px)", lineHeight: 1.3, color: "var(--bow-ink)", textWrap: "pretty" }}>
        {event.headline}
      </h3>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.55, color: "var(--bow-slate)", maxWidth: 760 }}>
        {event.detail}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 2 }}>
        {event.refs
          .filter((r) => r.kind === "player" && r.slugs[0])
          .map((r) => (
            <Link
              key={r.slugs[0]}
              href={`/analytics/players/${r.slugs[0]}`}
              style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)" }}
            >
              {r.label} &rarr;
            </Link>
          ))}
        {event.questionId && (
          <Link
            href={`/analytics/questions/${encodeURIComponent(event.questionId)}`}
            style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)" }}
          >
            Case file &rarr;
          </Link>
        )}
        <ClipButton
          kind="ledger"
          title={event.headline}
          detail={`${LEDGER_EVENT_LABELS[event.kind]}, ${new Date(event.at).toISOString().slice(0, 10)} — ${event.detail}`}
          refs={event.refs}
          {...(event.questionId ? { questionId: event.questionId } : {})}
        />
      </div>
    </div>
  );
}

export default async function LedgerPage() {
  const events = await getLedgerEvents();
  const depth = getLedgerDepth();
  const week = summarizeLastWeek(events);
  const days = groupByDay(events);

  return (
    <div data-screen-label="Open Ledger">
      {/* HERO — front-office mode */}
      <section
        className="bow-front-office"
        style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(44px,6vw,88px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--bow-dark-border)" }}
      >
        <div className="bow-container-wide">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            BOW Analytics &middot; The Open Ledger
          </span>
          <h1
            style={{
              margin: "14px 0 0",
              fontFamily: "var(--font-editorial)",
              fontWeight: 600,
              fontSize: "clamp(32px,5vw,58px)",
              lineHeight: 1.04,
              letterSpacing: "-0.018em",
              maxWidth: "20ch",
              color: "#fff",
              textWrap: "pretty",
            }}
          >
            The model, on the record.
          </h1>
          <p style={{ margin: "18px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.6, color: "#c8cad0", maxWidth: 680 }}>
            Every day the model re-reads the league and this page keeps the receipts: verdicts that flipped (and under
            which worldviews), questions that opened, questions the data settled. A model that never admits it changed
            its mind is a take. This one signs the ledger.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 22, alignItems: "center" }}>
            <Link href="/analytics/questions" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6f8bff" }}>
              The open docket &rarr;
            </Link>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", color: "#6d7078" }}>
              this week: {week.flips} flip{week.flips === 1 ? "" : "s"} &middot; {week.opened + week.reopened} opened &middot; {week.settled} settled
              &middot; day {depth} of the record
            </span>
          </div>
        </div>
      </section>

      {/* THE RECORD — grouped by day, newest first */}
      <section style={{ background: "#fff", padding: "clamp(28px,4vw,48px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container-wide">
          {days.length === 0 ? (
            <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(20px,2.6vw,26px)", color: "var(--bow-ink)" }}>
                The ledger opened today.
              </h2>
              <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>
                Day one of the record is the baseline: today&rsquo;s snapshot of every verdict under every worldview is
                frozen, and from tomorrow forward, anything that moves — a tier that flips, a question that opens or
                settles — gets a dated entry here. Come back after the next ingest.
              </p>
              <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>
                Until then, the <Link href="/analytics/questions" style={{ color: "var(--bow-blue)" }}>docket</Link> already has open questions to work.
              </p>
            </div>
          ) : (
            days.map(({ day, events: dayEvents }) => (
              <div key={day} style={{ marginBottom: "clamp(24px,3vw,36px)" }}>
                <h2
                  style={{
                    margin: 0,
                    padding: "0 6px 10px",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--bow-slate)",
                    borderBottom: "2px solid var(--bow-ink)",
                  }}
                >
                  {fmtDay(day)}
                </h2>
                {dayEvents.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
