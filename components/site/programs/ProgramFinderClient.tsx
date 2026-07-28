"use client";

/* ============================================================
 * Guided finder — a short set of questions, then a rule-based match against
 * every public program. Every result carries plain-language reasons so a
 * parent can see exactly why a program is suggested; nothing here is a
 * model, a score a family can't verify, or a black box.
 * ============================================================ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ds";
import { checkEligibility, parseGrade } from "@/lib/enrollment-shared";
import { submitPublicInquiry } from "@/app/actions/public-forms";
import type { DiscoveryProgram } from "@/lib/program-discovery";

const INTERESTS = [
  "Sports business fundamentals",
  "Analytics & data",
  "Deals & negotiation",
  "Marketing & media",
  "Leadership",
  "Entrepreneurship",
] as const;

// A heuristic keyword map, not a taxonomy stored anywhere — programs have no
// interest tags in the schema, so a chosen interest is matched against the
// program's own name and description text. Rule-based and disclosed as such.
const INTEREST_KEYWORDS: Record<(typeof INTERESTS)[number], string[]> = {
  "Sports business fundamentals": ["business", "front office", "franchise", "operations"],
  "Analytics & data": ["analytics", "data", "stats", "statistics", "metrics"],
  "Deals & negotiation": ["negotiat", "contract", "deal", "trade"],
  "Marketing & media": ["marketing", "media", "brand", "sponsorship"],
  Leadership: ["leadership", "captain", "team-building", "management"],
  Entrepreneurship: ["entrepreneur", "founder", "startup", "ownership"],
};

type Format = "either" | "online" | "in_person";
type Availability = "either" | "weekday_evenings" | "weekends";

interface FormState {
  grade: string;
  interests: string[];
  format: Format;
  location: string;
  availability: Availability;
}

interface MatchGroup {
  key: "best" | "other" | "upcoming" | "none";
  title: string;
  blurb: string;
  items: { program: DiscoveryProgram; reasons: string[] }[];
}

function isWeekdayEvening(day: number | null, startTime: string | null): boolean {
  if (day == null) return false;
  const hour = startTime ? Number(startTime.slice(0, 2)) : null;
  return day >= 1 && day <= 5 && (hour == null || hour >= 15);
}

function isWeekend(day: number | null): boolean {
  return day === 0 || day === 6;
}

function matchInterests(program: DiscoveryProgram, interests: string[]): string[] {
  if (interests.length === 0) return [];
  const text = `${program.name} ${program.shortDescription ?? ""} ${program.longDescription ?? ""}`.toLowerCase();
  return interests.filter((interest) => {
    const keywords = INTEREST_KEYWORDS[interest as (typeof INTERESTS)[number]] ?? [];
    return keywords.some((word) => text.includes(word));
  });
}

function formatMatches(program: DiscoveryProgram, format: Format): boolean {
  if (format === "either") return true;
  if (!program.deliveryFormat) return true; // unknown format never excludes a program
  if (format === "online") return program.deliveryFormat === "online" || program.deliveryFormat === "hybrid";
  return program.deliveryFormat === "in_person" || program.deliveryFormat === "hybrid";
}

function availabilityMatches(program: DiscoveryProgram, availability: Availability): boolean {
  if (availability === "either") return true;
  if (program.scheduleDay == null) return true; // unscheduled programs aren't excluded
  if (availability === "weekday_evenings") return isWeekdayEvening(program.scheduleDay, program.scheduleStartTime);
  return isWeekend(program.scheduleDay);
}

function formatLabel(format: string | null): string {
  if (format === "online") return "Live online";
  if (format === "in_person") return "In person";
  if (format === "hybrid") return "In person and online";
  return "Format to be announced";
}

export default function ProgramFinderClient({ programs }: { programs: DiscoveryProgram[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    grade: "",
    interests: [],
    format: "either",
    location: "",
    availability: "either",
  });
  const [submitted, setSubmitted] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [interestPending, setInterestPending] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const groups = useMemo<MatchGroup[] | null>(() => {
    if (!submitted) return null;
    const numericGrade = parseGrade(form.grade);

    const best: MatchGroup["items"] = [];
    const other: MatchGroup["items"] = [];
    const upcoming: MatchGroup["items"] = [];

    for (const program of programs) {
      const eligibility = checkEligibility({ grade_min: program.gradeMin, grade_max: program.gradeMax }, form.grade || null);
      const reasons: string[] = [];
      if (numericGrade != null && eligibility.eligible) {
        reasons.push(`Matches grade ${form.grade.trim()}`);
      }
      const matchedInterests = matchInterests(program, form.interests);
      for (const interest of matchedInterests) reasons.push(interest);
      const formatOk = formatMatches(program, form.format);
      if (formatOk && form.format !== "either") reasons.push(formatLabel(program.deliveryFormat));
      const availabilityOk = availabilityMatches(program, form.availability);
      if (availabilityOk && form.availability !== "either" && program.scheduleDay != null) {
        reasons.push(form.availability === "weekends" ? "Weekend schedule" : "Weekday evening schedule");
      }
      if (form.location.trim() && program.location && program.location.toLowerCase().includes(form.location.trim().toLowerCase())) {
        reasons.push(`Near ${form.location.trim()}`);
      }

      if (program.availability === "coming_soon") {
        upcoming.push({ program, reasons });
        continue;
      }
      if (!eligibility.eligible) continue;
      if (!formatOk || !availabilityOk) continue;

      const strongMatch = reasons.length >= 2 || (numericGrade != null && matchedInterests.length > 0);
      if (strongMatch) best.push({ program, reasons });
      else other.push({ program, reasons });
    }

    return [
      {
        key: "best",
        title: "Best matches",
        blurb: "Programs that fit everything you told us.",
        items: best,
      },
      {
        key: "other",
        title: "Other eligible programs",
        blurb: `${form.grade.trim() ? `Open to grade ${form.grade.trim()}, ` : ""}but fewer of your preferences line up.`,
        items: other,
      },
      {
        key: "upcoming",
        title: "Upcoming programs",
        blurb: "Not open for registration yet — you can ask to be notified.",
        items: upcoming,
      },
    ];
  }, [submitted, form, programs]);

  const nothingFound = groups != null && groups.every((g) => g.items.length === 0);

  const toggleInterest = (interest: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const submitInterest = async () => {
    if (!contactName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return;
    setInterestPending(true);
    const requestKey = `finder-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const summary = [
      form.grade.trim() ? `Grade: ${form.grade.trim()}.` : null,
      form.interests.length ? `Interested in: ${form.interests.join(", ")}.` : null,
      form.format !== "either" ? `Prefers ${formatLabel(form.format === "online" ? "online" : "in_person").toLowerCase()}.` : null,
      form.location.trim() ? `Location: ${form.location.trim()}.` : null,
      form.availability !== "either" ? `Availability: ${form.availability.replace("_", " ")}.` : null,
    ]
      .filter(Boolean)
      .join(" ") || "No specific preferences collected.";
    const result = await submitPublicInquiry({
      requestKey,
      source: "sign_up",
      name: contactName.trim(),
      email: contactEmail.trim(),
      type: "parent",
      summary: `Program finder found no current match. ${summary}`,
    });
    setInterestPending(false);
    if (result.ok) setInterestSent(true);
  };

  if (!submitted) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 24, background: "#fff", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "28px 26px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="finder-grade" style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15 }}>
            What grade is your student in?
          </label>
          <input
            id="finder-grade"
            value={form.grade}
            onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
            placeholder="e.g. 6th grade, or K"
            style={{ maxWidth: 260, minHeight: 46, fontSize: 16, padding: "10px 12px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)" }}
          />
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>
            What are they interested in? (choose any)
          </legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {INTERESTS.map((interest) => {
              const active = form.interests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  aria-pressed={active}
                  style={{
                    minHeight: 44,
                    padding: "9px 14px",
                    borderRadius: "var(--radius-control)",
                    border: `1px solid ${active ? "var(--bow-blue)" : "var(--border-rule)"}`,
                    background: active ? "var(--bow-blue-tint)" : "#fff",
                    color: active ? "var(--bow-blue)" : "var(--text-primary)",
                    fontFamily: "var(--font-interface)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Preferred format</legend>
          <div role="radiogroup" aria-label="Preferred format" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {([
              ["either", "Either"],
              ["online", "Live online"],
              ["in_person", "In person"],
            ] as [Format, string][]).map(([value, label]) => (
              <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "9px 14px", minHeight: 44, cursor: "pointer" }}>
                <input type="radio" name="format" checked={form.format === value} onChange={() => setForm((f) => ({ ...f, format: value }))} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="finder-location" style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15 }}>
            Location preference (optional)
          </label>
          <input
            id="finder-location"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="City or neighborhood"
            style={{ maxWidth: 320, minHeight: 46, fontSize: 16, padding: "10px 12px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)" }}
          />
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>When are they usually free?</legend>
          <div role="radiogroup" aria-label="Availability" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {([
              ["either", "Either"],
              ["weekday_evenings", "Weekday evenings"],
              ["weekends", "Weekends"],
            ] as [Availability, string][]).map(([value, label]) => (
              <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "9px 14px", minHeight: 44, cursor: "pointer" }}>
                <input type="radio" name="availability" checked={form.availability === value} onChange={() => setForm((f) => ({ ...f, availability: value }))} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" variant="primary" size="lg" full>
          Show matching programs
        </Button>
      </form>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
          Matched using a simple rule-based comparison of your answers to each program — not a recommendation algorithm.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setSubmitted(false)}>
          Change answers
        </Button>
      </div>

      {nothingFound && (
        <div style={{ border: "1px dashed var(--border-rule)", borderRadius: "var(--radius-control)", padding: "28px 24px", background: "#fff" }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 22 }}>No current match</h2>
          <p style={{ margin: "10px 0 20px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>
            Nothing open right now fits what you told us. Leave your email and we&apos;ll reach out when a program matches — this
            is not a registration.
          </p>
          {interestSent ? (
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-positive)" }}>
              Thanks — we recorded your interest and will follow up by email.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="finder-contact-name" style={{ fontFamily: "var(--font-interface)", fontSize: 14, fontWeight: 600 }}>Your name</label>
                <input id="finder-contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ minHeight: 46, fontSize: 16, padding: "10px 12px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="finder-contact-email" style={{ fontFamily: "var(--font-interface)", fontSize: 14, fontWeight: 600 }}>Your email</label>
                <input id="finder-contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={{ minHeight: 46, fontSize: 16, padding: "10px 12px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)" }} />
              </div>
              <Button variant="primary" size="md" onClick={submitInterest} disabled={interestPending}>
                {interestPending ? "Sending…" : "Notify me"}
              </Button>
            </div>
          )}
        </div>
      )}

      {groups?.map((group) =>
        group.items.length === 0 ? null : (
          <section key={group.key}>
            <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 22 }}>{group.title}</h2>
            <p style={{ margin: "0 0 18px", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>{group.blurb}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {group.items.map(({ program, reasons }) => (
                <div key={program.id} className="bow-card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "22px 20px", background: "#fff", border: "1px solid var(--border-rule)" }}>
                  <Badge status={group.key === "upcoming" ? "info" : "positive"}>{program.availabilityLabel}</Badge>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 18 }}>{program.name}</h3>
                  {program.shortDescription && (
                    <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--text-secondary)" }}>{program.shortDescription}</p>
                  )}
                  {reasons.length > 0 && (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {reasons.map((reason) => (
                        <li key={reason} style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.03em", color: "var(--bow-blue)", border: "1px solid var(--bow-blue)", borderRadius: "var(--radius-control)", padding: "2px 8px" }}>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: "auto", flexWrap: "wrap" }}>
                    <Link href={`/programs/p/${program.id}`} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--bow-slate)" }}>
                      View details →
                    </Link>
                    {group.key !== "upcoming" && (
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/programs/register?program=${program.id}`)}>
                        Start registration
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
