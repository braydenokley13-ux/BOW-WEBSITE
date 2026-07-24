import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import type { PublicProgramCard as ProgramCardData } from "@/lib/operations";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatLabel(format: string): string {
  if (format === "in_person") return "In-Person";
  if (format === "online") return "Online";
  if (format === "hybrid") return "Hybrid";
  return format;
}

export default function PublicProgramCard({ program }: { program: ProgramCardData }) {
  const nextDate = formatDate(program.nextSessionDate ?? program.startDate);
  const spotsLeft =
    program.capacity != null ? Math.max(0, program.capacity - program.registeredCount) : null;

  let cta: { label: string; href: string; disabled?: boolean } | null = null;
  if (program.status === "coming_soon") {
    cta = { label: "Join Interest List", href: "/sign-up" };
  } else if (program.status === "open") {
    cta = { label: "Register", href: `/programs/register/${program.id}` };
  } else if (program.status === "full") {
    // "continue" (keep accepting past capacity) still creates a confirmed
    // enrollment on submit — it is NOT a waitlist — so the CTA must read
    // "Register", not "Join Waitlist". Only "waitlist" actually waitlists.
    if (program.fullCapacityBehavior === "close") {
      cta = { label: "Registration Closed", href: "#", disabled: true };
    } else if (program.fullCapacityBehavior === "continue") {
      cta = { label: "Register", href: `/programs/register/${program.id}` };
    } else {
      cta = { label: "Join Waitlist", href: `/programs/register/${program.id}` };
    }
  }

  return (
    <div
      className="bow-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "26px 24px",
        background: "#fff",
        border: "1px solid var(--border-rule)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Badge status={program.status === "open" ? "positive" : program.status === "full" ? "warning" : "info"}>
          {program.status === "coming_soon" ? "Coming Soon" : program.status === "open" ? "Open" : "Full"}
        </Badge>
        {nextDate && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>
            {nextDate}
          </span>
        )}
      </div>
      <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 22, lineHeight: 1.15 }}>
        {program.name}
      </h3>
      {program.shortDescription && (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, color: "var(--bow-slate)", flex: 1 }}>
          {program.shortDescription}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {program.gradeRange && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "3px 9px" }}>
            Grades {program.gradeRange}
          </span>
        )}
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "3px 9px" }}>
          {formatLabel(program.deliveryFormat)}
        </span>
        {program.status === "open" && spotsLeft != null && spotsLeft <= 10 && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-orange)", border: "1px solid var(--bow-orange)", borderRadius: "var(--radius-control)", padding: "3px 9px" }}>
            {spotsLeft === 0 ? "Last spots" : `${spotsLeft} spots left`}
          </span>
        )}
      </div>
      {cta && (
        cta.disabled ? (
          <Button variant="secondary" size="md" full disabled>{cta.label}</Button>
        ) : (
          <Button href={cta.href} variant={program.status === "open" ? "emphasis" : "secondary"} size="md" full>
            {cta.label}
          </Button>
        )
      )}
      {!cta && (
        <Link href="/contact" style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)" }}>
          Contact BOW for details →
        </Link>
      )}
    </div>
  );
}
