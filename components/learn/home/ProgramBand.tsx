import type { StudentProgram } from "@/lib/student-program";

/**
 * "You're in this program, you meet next at this time, here's where."
 *
 * Sits above the Playbook content on the student home so the real-world
 * commitment reads first. Deliberately plain: no stats grid, no status
 * chips, no operations vocabulary — one fact per line.
 */
export default function ProgramBand({ program }: { program: StudentProgram }) {
  const { next } = program;

  const dayLabel = next
    ? next.isToday
      ? "Today"
      : new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(next.startsAt)
    : null;
  const timeLabel = next
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(next.startsAt)
    : null;

  const place = next?.location ?? program.locationName;

  return (
    <section
      aria-labelledby="bow-program-band-heading"
      style={{
        background: "var(--bow-ink)",
        color: "var(--bow-paper)",
        borderRadius: 16,
        padding: "clamp(18px,3vw,26px) clamp(18px,3vw,28px)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.62,
        }}
      >
        Your program
      </span>
      <h2
        id="bow-program-band-heading"
        style={{
          margin: "6px 0 0",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(20px,3vw,30px)",
          lineHeight: 1.04,
          textTransform: "uppercase",
        }}
      >
        {program.programName ?? program.classTitle}
      </h2>

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: "clamp(16px,4vw,44px)" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.62 }}>
            {next?.isToday ? "Meeting today" : "Next session"}
          </span>
          <p style={{ margin: "4px 0 0", fontSize: "clamp(15px,2vw,18px)", fontWeight: 600 }}>
            {next ? `${dayLabel} · ${timeLabel}` : "No session scheduled yet — your instructor will add the next one."}
          </p>
          {next && place ? (
            <p style={{ margin: "2px 0 0", fontSize: 14, opacity: 0.72 }}>{place}</p>
          ) : null}
        </div>

        {program.sessionsSoFar > 0 ? (
          <div style={{ minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.62 }}>
              Sessions attended
            </span>
            <p style={{ margin: "4px 0 0", fontSize: "clamp(15px,2vw,18px)", fontWeight: 600 }}>
              {program.sessionsAttended} of {program.sessionsSoFar}
            </p>
          </div>
        ) : null}
      </div>

      {program.upcoming.length > 0 ? (
        <p style={{ margin: "14px 0 0", fontSize: 13, opacity: 0.66 }}>
          Then{" "}
          {program.upcoming
            .map((s) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(s.startsAt))
            .join(" · ")}
        </p>
      ) : null}
    </section>
  );
}
