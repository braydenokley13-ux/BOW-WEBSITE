import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import type { PublicProgram } from "@/lib/cms/offerings";
import { REGISTRATION_STATUS_LABELS } from "@/lib/cms/status";

/**
 * The public program card.
 *
 * Every word and every button on it comes from the program record: the title,
 * the description, the badge (derived from registration status), and the call
 * to action (derived by `deriveCta`, with the founder's wording override
 * applied). Nothing about what a visitor can do here is decided in this file —
 * it only lays the answer out.
 */

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatDateRange(start: string | null, end: string | null): string | null {
  const first = formatDate(start);
  const last = formatDate(end);
  if (!first) return last;
  if (!last || last === first) return first;
  return `${first} to ${last}`;
}

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${minuteText && minuteText !== "00" ? `:${minuteText}` : ""} ${suffix}`;
}

export function formatDeliveryFormat(format: string): string {
  if (format === "in_person") return "In-Person";
  if (format === "online") return "Online";
  if (format === "hybrid") return "Hybrid";
  return format.replace(/_/g, " ");
}

const chip = {
  fontFamily: "var(--font-data)",
  fontSize: 12,
  color: "var(--bow-slate)",
  border: "1px solid var(--border-rule)",
  borderRadius: "var(--radius-control)",
  padding: "3px 9px",
} as const;

export default function OfferingCard({ program }: { program: PublicProgram }) {
  const dates = formatDateRange(program.startDate, program.endDate);
  const startTime = formatTime(program.startTime);
  const endTime = formatTime(program.endTime);
  const schedule = [
    program.scheduleLabel,
    startTime ? [endTime ? `${startTime} to ${endTime}` : startTime, program.timezone].filter(Boolean).join(" ") : "",
  ].filter(Boolean).join(" · ");
  const { cta } = program;
  const badgeStatus =
    program.registrationStatus === "registration_open"
      ? "positive"
      : program.registrationStatus === "full"
        ? "warning"
        : "info";

  return (
    <div
      className="bow-card"
      style={{ display: "flex", flexDirection: "column", gap: 14, padding: "26px 24px", background: "#fff", border: "1px solid var(--border-rule)" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Badge status={badgeStatus}>{REGISTRATION_STATUS_LABELS[program.registrationStatus]}</Badge>
        {dates ? (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>{dates}</span>
        ) : null}
      </div>

      <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "var(--type-card)", lineHeight: "var(--lh-card)" }}>
        <Link href={`/programs/p/${program.slug}`} style={{ color: "inherit" }}>
          {program.title}
        </Link>
      </h3>

      {program.shortDescription ? (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: "var(--type-body-sm)", lineHeight: "var(--lh-body)", color: "var(--text-secondary)", flex: 1 }}>
          {program.shortDescription}
        </p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {program.gradeRange ? <span style={chip}>Grades {program.gradeRange}</span> : null}
        {program.deliveryFormat ? <span style={chip}>{formatDeliveryFormat(program.deliveryFormat)}</span> : null}
        {schedule ? <span style={chip}>{schedule}</span> : null}
        {program.sessionCount ? <span style={chip}>{program.sessionCount} sessions</span> : null}
        {program.isFree ? <span style={chip}>Free</span> : program.priceLabel ? <span style={chip}>{program.priceLabel}</span> : null}
        {program.registrationStatus === "registration_open" && program.seatsRemaining !== null && program.seatsRemaining <= 10 ? (
          <span style={{ ...chip, color: "var(--bow-orange)", borderColor: "var(--bow-orange)" }}>
            {program.seatsRemaining === 0 ? "Last spots" : `${program.seatsRemaining} spots left`}
          </span>
        ) : null}
      </div>

      {cta.behavior === "disabled" ? (
        <Button variant="secondary" size="md" full disabled>
          {cta.label}
        </Button>
      ) : cta.href ? (
        <Button href={cta.href} variant={cta.behavior === "register" ? "primary" : "secondary"} size="md" full>
          {cta.label}
        </Button>
      ) : null}

      {cta.secondary ? (
        <Button href={cta.secondary.href} variant="secondary" size="md" full>
          {cta.secondary.label}
        </Button>
      ) : null}

      {cta.behavior === "none" && !cta.secondary ? (
        <Link href={`/programs/p/${program.slug}`} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)" }}>
          See the details →
        </Link>
      ) : null}
    </div>
  );
}
