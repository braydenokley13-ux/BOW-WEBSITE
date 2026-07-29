import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, SectionHeader } from "@/components/ds";
import { getPublicProgramDetail } from "@/lib/program-discovery";

// getPublicProgramDetail() reads from the database; must not run at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getPublicProgramDetail(id);
  return {
    title: program ? `${program.name} — BOW Sports Capital` : "Program",
    description: program?.shortDescription ?? "A BOW Sports Capital program.",
  };
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const [hourStr, minuteStr] = value.split(":");
  const hour = Number(hourStr);
  if (!Number.isFinite(hour)) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${minuteStr && minuteStr !== "00" ? `:${minuteStr}` : ""} ${suffix}`;
}

function deliveryLabel(format: string | null): string {
  if (format === "online") return "Live online";
  if (format === "in_person") return "In person";
  if (format === "hybrid") return "In person and online";
  return "Format to be announced";
}

const NEXT_STEPS: Record<string, string[]> = {
  immediate: [
    "Submit the registration form for your student.",
    "If a seat is open, it's confirmed right away — no separate approval step.",
    "You'll get an email confirming the registration and, if any forms are still needed, what to complete before the start date.",
    "An account activation email follows so you can check status and complete any remaining steps online.",
  ],
  approval: [
    "Submit the registration form for your student.",
    "BOW's team reviews the registration — this is normal for this program and not a sign of a problem.",
    "You'll get an email with the result: confirmed, waitlisted, or a request for more information.",
    "An account activation email follows so you can check status online.",
  ],
};

export default async function PublicProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getPublicProgramDetail(id);
  if (!program) notFound();

  const badgeStatus = program.availability === "registration_open" || program.availability === "limited_seats"
    ? "positive"
    : program.availability === "registration_closed"
      ? "neutral"
      : "info";

  const canRegister = program.availability !== "coming_soon" && program.availability !== "registration_closed";
  const scheduleDayLabel = program.scheduleDay != null ? WEEKDAYS[program.scheduleDay] : null;
  const scheduleTime = program.scheduleStartTime ? formatTime(program.scheduleStartTime) : null;
  const scheduleEndTime = program.scheduleEndTime ? formatTime(program.scheduleEndTime) : null;

  return (
    <div data-screen-label="Public Program Detail">
      <section style={{ background: "var(--bow-ink)", color: "#fff", padding: "clamp(40px,6vw,72px) clamp(18px,4vw,40px) clamp(28px,4vw,44px)" }}>
        <div className="bow-container" style={{ maxWidth: 760 }}>
          <Link href="/programs/find" style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#b9bcc4" }}>
            ← Find a Program
          </Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
            <Badge status={badgeStatus}>{program.availabilityLabel}</Badge>
            {program.availability === "limited_seats" && program.seatsRemaining != null && (
              <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-orange)" }}>
                {program.seatsRemaining} {program.seatsRemaining === 1 ? "spot" : "spots"} left
              </span>
            )}
          </div>
          <h1 style={{ margin: "12px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,5vw,52px)", lineHeight: 0.98, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
            {program.name}
          </h1>
          {program.shortDescription && (
            <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: "clamp(15px,1.3vw,19px)", lineHeight: 1.6, color: "#b9bcc4", maxWidth: 620 }}>
              {program.shortDescription}
            </p>
          )}
          {canRegister ? (
            <div style={{ marginTop: 24 }}>
              <Button href={`/programs/register?program=${program.id}`} variant="primary" size="lg">Register now</Button>
            </div>
          ) : program.availability === "coming_soon" ? (
            <div style={{ marginTop: 24 }}>
              <Button href="/sign-up" variant="secondary" size="lg">Join the interest list</Button>
            </div>
          ) : null}
        </div>
      </section>

      <section style={{ background: "var(--bow-paper)", padding: "clamp(32px,5vw,56px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container" style={{ maxWidth: 760, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          <Fact label="Grades" value={program.gradeRangeLabel} />
          <Fact label="Format" value={deliveryLabel(program.deliveryFormat)} />
          <Fact label="Location" value={program.location ?? (program.deliveryFormat === "online" ? "Online" : "To be announced")} />
          <Fact label="Starts" value={formatDate(program.startDate) ?? "To be announced"} />
          <Fact label="Timezone" value={program.scheduleTimezone ?? "Not yet set"} />
        </div>
      </section>

      <section style={{ background: "#fff", padding: "clamp(32px,5vw,56px) clamp(18px,4vw,40px)", borderBottom: "1px solid var(--border-rule)" }}>
        <div className="bow-container" style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 40 }}>
          <div>
            <SectionHeader kicker="Overview" title="What students do" style={{ marginBottom: 14 }} />
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.7, color: "var(--text-primary)" }}>
              {program.longDescription ?? program.shortDescription ?? "Details for this program are still being finalized — check back soon or contact BOW directly."}
            </p>
          </div>

          <div>
            <SectionHeader kicker="Outcomes" title="What students learn" style={{ marginBottom: 14 }} />
            <ul style={{ margin: 0, paddingLeft: 20, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.8, color: "var(--text-primary)" }}>
              <li>Core concepts from the BOW curriculum applied to real sports-business scenarios.</li>
              <li>Direct practice through the program&apos;s sessions, not just lecture.</li>
              <li>A concrete outcome to show for the program — a project, a decision, or a completed track.</li>
            </ul>
          </div>

          <div>
            <SectionHeader kicker="Fit" title="Who this is for" style={{ marginBottom: 14 }} />
            <ul style={{ margin: 0, paddingLeft: 20, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.8, color: "var(--text-primary)" }}>
              <li>Grades: {program.gradeRangeLabel}</li>
              <li>Experience level: {program.experienceLevel ?? "No prior experience required"}</li>
              <li>Commitment: {program.scheduleLabel ?? "See the schedule below"}</li>
              <li>New to BOW is welcome — no assumed background beyond the stated grade range.</li>
            </ul>
          </div>

          <div>
            <SectionHeader kicker="Schedule" title="When it meets" style={{ marginBottom: 14 }} />
            {scheduleDayLabel || scheduleTime ? (
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-primary)" }}>
                {scheduleDayLabel ?? "Recurring"}{scheduleTime ? `, ${scheduleTime}${scheduleEndTime ? `–${scheduleEndTime}` : ""}` : ""}
                {program.scheduleTimezone ? ` (${program.scheduleTimezone})` : ""}
              </p>
            ) : (
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
                A weekly schedule hasn&apos;t been published yet.
              </p>
            )}
            {program.upcomingSessions.length > 0 && (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {program.upcomingSessions.map((session) => (
                  <li key={session.date} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)", display: "flex", gap: 10 }}>
                    <span>{formatDate(session.date)}</span>
                    {session.title && <span>— {session.title}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {program.instructors.length > 0 && (
            <div>
              <SectionHeader kicker="Staff" title="Who's teaching" style={{ marginBottom: 14 }} />
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {program.instructors.map((instructor) => (
                  <li key={`${instructor.name}-${instructor.role}`} style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-primary)" }}>
                    <strong>{instructor.name}</strong> — {instructor.role}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {program.requirements.length > 0 && (
            <div>
              <SectionHeader kicker="Before You Start" title="What we'll ask for" style={{ marginBottom: 14 }} />
              <ul style={{ margin: 0, paddingLeft: 20, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.8, color: "var(--text-primary)" }}>
                {program.requirements.map((req) => (
                  <li key={req.prompt}>
                    {req.prompt}{req.required ? "" : " (optional)"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <SectionHeader kicker="Process" title="What happens next" style={{ marginBottom: 14 }} />
            <ol style={{ margin: 0, paddingLeft: 20, fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.9, color: "var(--text-primary)" }}>
              {(NEXT_STEPS[program.registrationMode] ?? NEXT_STEPS.immediate).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          {canRegister && (
            <div>
              <Button href={`/programs/register?program=${program.id}`} variant="primary" size="lg">Register now</Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-slate)" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-interface)", fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>{value}</div>
    </div>
  );
}
