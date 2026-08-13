import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { roleHomePath } from "@/lib/account";
import { Button } from "@/components/ds";
import { getDb } from "@/lib/db";
import { getHqHomeData } from "@/lib/hq-home";
import { homeSummarySentence, relativeLabel } from "@/lib/hq-home-shared";
import TodayRail from "@/components/app/home/TodayRail";
import NeedsYouQueue from "@/components/app/home/NeedsYouQueue";
import ResumeDraftRow from "@/components/app/home/ResumeDraftRow";
import { getClassDraftSummary } from "@/lib/class-draft";

export const metadata = { title: "BOW HQ" };

/**
 * HQ Home — an operating surface, not an analytics dashboard.
 *
 * It answers three questions in one screen: what is happening today, what
 * needs me, what is new. Anything that is healthy stays quiet, and the only
 * amber on the page belongs to the queue — because amber that appears when
 * nothing is wrong stops meaning anything.
 */
export default async function AppHome() {
  const me = await requireUser();
  if (me.role !== "admin" && me.role !== "growth") redirect(roleHomePath(me.role));

  const [data, draft, everPublished] = await Promise.all([
    getHqHomeData(),
    getClassDraftSummary(me.id),
    getDb().prepare("SELECT 1 AS present FROM classes LIMIT 1").get() as Promise<{ present: number } | undefined>,
  ]);

  const now = data.now;
  const firstName = (me.name ?? "").trim().split(/\s+/)[0] || null;
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now);
  const hour = new Date(now).getHours();
  const partOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  /* First ever use: one invitation, not four empty zones. */
  if (!everPublished && !draft) {
    return (
      <div style={{ maxWidth: 640, paddingTop: 24 }}>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--bow-slate)",
          }}
        >
          Welcome to BOW HQ
        </p>
        <h1
          style={{
            margin: "14px 0 0",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(38px, 6vw, 56px)",
            lineHeight: 0.98,
            textTransform: "uppercase",
            color: "var(--bow-ink)",
          }}
        >
          Post your
          <br />
          first class
        </h1>
        <p style={{ margin: "18px 0 26px", fontSize: 15.5, lineHeight: 1.65, color: "var(--bow-ink)" }}>
          Pick a course, accept the defaults, publish. Most classes go live in under three minutes —
          registrations run themselves after that.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button href="/app/post-class" variant="primary">
            Post a Class
          </Button>
          <Button href="/app/partners" variant="secondary">
            Add a partner
          </Button>
        </div>
      </div>
    );
  }

  const { today: todaySessions, nextSession, queue, ticker, digest } = data;

  return (
    <div style={{ maxWidth: 1120 }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 30,
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--bow-slate)",
            }}
          >
            {today}
          </p>
          <h1
            style={{
              margin: "9px 0 0",
              fontFamily: "var(--font-interface)",
              fontWeight: 600,
              fontSize: "clamp(19px, 2.6vw, 24px)",
              lineHeight: 1.3,
              color: "var(--bow-ink)",
            }}
          >
            {partOfDay}
            {firstName ? `, ${firstName}` : ""}. {homeSummarySentence(todaySessions.length, queue.length)}
          </h1>
        </div>
        <Button href="/app/post-class" variant="primary">
          Post a Class
        </Button>
      </header>

      {draft ? <ResumeDraftRow draft={draft} /> : null}

      <TodayRail sessions={todaySessions} nextSession={nextSession} />

      <NeedsYouQueue items={queue} />

      {/* The week, kept to one strip. Decision-relevant, never a KPI wall. */}
      <p
        style={{
          margin: "30px 0 0",
          paddingTop: 14,
          borderTop: "1px solid var(--border-rule)",
          fontSize: 13,
          lineHeight: 1.7,
          color: "var(--bow-slate)",
        }}
      >
        This week —{" "}
        <strong style={{ fontFamily: "var(--font-data)", color: "var(--bow-ink)", fontWeight: 600 }}>
          {digest.classesRunning}
        </strong>{" "}
        {digest.classesRunning === 1 ? "class" : "classes"} running
        {digest.seatsCapacity > 0 ? (
          <>
            {" · "}
            <strong style={{ fontFamily: "var(--font-data)", color: "var(--bow-ink)", fontWeight: 600 }}>
              {digest.seatsTaken}/{digest.seatsCapacity}
            </strong>{" "}
            seats filled
          </>
        ) : null}
        {" · "}
        <strong style={{ fontFamily: "var(--font-data)", color: "var(--bow-ink)", fontWeight: 600 }}>
          {digest.sessionsThisWeek}
        </strong>{" "}
        {digest.sessionsThisWeek === 1 ? "session" : "sessions"}
        {digest.inboxWaiting > 0 ? (
          <>
            {" · "}
            <Link href="/app/partners" style={{ color: "var(--bow-blue)" }}>
              <strong style={{ fontFamily: "var(--font-data)", fontWeight: 600 }}>{digest.inboxWaiting}</strong> waiting
              in the inbox
            </Link>
          </>
        ) : null}
      </p>

      <section aria-labelledby="new-heading" style={{ marginTop: 34 }}>
        <h2
          id="new-heading"
          style={{
            margin: "0 0 4px",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--bow-ink)",
          }}
        >
          New
        </h2>
        {ticker.length === 0 ? (
          <p
            style={{
              margin: 0,
              paddingTop: 14,
              borderTop: "1px solid var(--border-rule)",
              fontSize: 14,
              color: "var(--bow-slate)",
            }}
          >
            No new registrations or inquiries in the last two weeks.
          </p>
        ) : (
          <div>
            {ticker.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 14,
                  padding: "11px 0",
                  borderTop: "1px solid var(--border-rule)",
                  textDecoration: "none",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ flex: "1 1 240px", minWidth: 0, fontSize: 14, color: "var(--bow-ink)" }}>
                  {item.title}
                  <span style={{ color: "var(--bow-slate)" }}> — {item.context}</span>
                </span>
                <span
                  style={{
                    flex: "none",
                    fontFamily: "var(--font-data)",
                    fontSize: 10.5,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--bow-slate)",
                  }}
                >
                  {relativeLabel(item.at, now)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
