"use client";

/* ============================================================
 * Multi-child, multi-program family registration — four short steps plus a
 * definitive result. One `requestKey`, generated once per form session and
 * held in state, makes a refresh or a double submit replay the original
 * result instead of creating a second registration (see
 * app/actions/family-registration.ts).
 * ============================================================ */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import { checkEligibility, outcomeHeading, registrationLabel, type ChildSelectionResult } from "@/lib/enrollment-shared";
import { submitFamilyRegistration } from "@/app/actions/family-registration";
import type { RegisterableProgram } from "@/lib/program-discovery";

interface ChildForm {
  key: string;
  existingStudentId?: string;
  firstName: string;
  lastName: string;
  grade: string;
  school: string;
  programIds: string[];
}

type Step = "children" | "guardian" | "selections" | "review" | "result";

const fieldStyle: React.CSSProperties = {
  minHeight: 46,
  fontSize: 16,
  padding: "10px 12px",
  border: "1px solid var(--border-rule)",
  borderRadius: "var(--radius-control)",
  width: "100%",
  fontFamily: "var(--font-interface)",
};
const labelStyle: React.CSSProperties = { fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 14 };
const fieldWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };

function newChild(preselectedProgramId: string | null): ChildForm {
  return {
    key: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    firstName: "",
    lastName: "",
    grade: "",
    school: "",
    programIds: preselectedProgramId ? [preselectedProgramId] : [],
  };
}

function needsSchool(programs: RegisterableProgram[], programIds: string[]): boolean {
  // No program in this build requires a school field, but the hook exists so
  // a future program flagged that way doesn't need a new step — only the
  // condition here changes.
  void programs;
  void programIds;
  return false;
}

export default function FamilyRegistrationWizard({
  programs,
  preselectedProgramId,
}: {
  programs: RegisterableProgram[];
  preselectedProgramId: string | null;
}) {
  const [step, setStep] = useState<Step>("children");
  const [children, setChildren] = useState<ChildForm[]>([newChild(preselectedProgramId)]);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [relationship, setRelationship] = useState("Parent");
  const [wantsPhone, setWantsPhone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ChildSelectionResult[] | null>(null);
  const [activationEmail, setActivationEmail] = useState<string | null>(null);

  const [requestKey] = useState(
    () => `freg-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
  );
  const submittingRef = useRef(false);

  const programById = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const showSchool = children.some((c) => needsSchool(programs, c.programIds));

  const updateChild = (key: string, patch: Partial<ChildForm>) => {
    setChildren((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };
  const addChild = () => setChildren((prev) => [...prev, newChild(null)]);
  const removeChild = (key: string) => setChildren((prev) => (prev.length > 1 ? prev.filter((c) => c.key !== key) : prev));

  const toggleProgram = (childKey: string, programId: string) => {
    setChildren((prev) =>
      prev.map((c) =>
        c.key === childKey
          ? { ...c, programIds: c.programIds.includes(programId) ? c.programIds.filter((id) => id !== programId) : [...c.programIds, programId] }
          : c,
      ),
    );
  };

  const validateChildren = (): string | null => {
    for (const child of children) {
      if (!child.firstName.trim() || !child.lastName.trim()) return "Add a first and last name for every child.";
    }
    return null;
  };

  const validateGuardian = (): string | null => {
    if (!parentName.trim()) return "Add your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) return "Add a valid email address.";
    return null;
  };

  const validateSelections = (): string | null => {
    for (const child of children) {
      if (child.programIds.length === 0) return `Choose at least one program for ${child.firstName || "each child"}.`;
    }
    return null;
  };

  const goNext = () => {
    setError("");
    if (step === "children") {
      const err = validateChildren();
      if (err) return setError(err);
      setStep("guardian");
    } else if (step === "guardian") {
      const err = validateGuardian();
      if (err) return setError(err);
      setStep("selections");
    } else if (step === "selections") {
      const err = validateSelections();
      if (err) return setError(err);
      setStep("review");
    }
  };

  const goBack = () => {
    setError("");
    if (step === "guardian") setStep("children");
    else if (step === "selections") setStep("guardian");
    else if (step === "review") setStep("selections");
  };

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setError("");
    try {
      const outcome = await submitFamilyRegistration({
        requestKey,
        children: children.map((c) => ({
          studentId: c.existingStudentId,
          firstName: c.firstName.trim(),
          lastName: c.lastName.trim(),
          grade: c.grade.trim() || undefined,
          school: c.school.trim() || undefined,
          programIds: c.programIds,
        })),
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim(),
        parentPhone: wantsPhone ? parentPhone.trim() || undefined : undefined,
        relationship: relationship.trim() || undefined,
      });
      if (!outcome.ok) {
        // Recoverable: keep every field exactly as entered so a conflict or a
        // validation error never reads back as an empty form.
        setError(outcome.error ?? "Registration could not be saved. Please try again.");
        submittingRef.current = false;
        setPending(false);
        return;
      }
      setResults(outcome.results ?? []);
      setActivationEmail(outcome.activationEmail ?? null);
      setStep("result");
    } catch {
      setError("The connection was interrupted before we could save this. Nothing was lost — try submitting again.");
      submittingRef.current = false;
      setPending(false);
    }
  };

  const stepIndex = { children: 1, guardian: 2, selections: 3, review: 4, result: 5 }[step];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {step !== "result" && (
        <ol style={{ display: "flex", gap: 8, margin: 0, padding: 0, listStyle: "none", flexWrap: "wrap" }} aria-label="Registration steps">
          {["Children", "Guardian", "Programs", "Review"].map((label, i) => (
            <li
              key={label}
              aria-current={stepIndex === i + 1 ? "step" : undefined}
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 12,
                letterSpacing: "0.04em",
                padding: "6px 12px",
                borderRadius: "var(--radius-control)",
                background: stepIndex === i + 1 ? "var(--bow-blue)" : stepIndex > i + 1 ? "var(--bow-blue-tint)" : "transparent",
                color: stepIndex === i + 1 ? "#fff" : stepIndex > i + 1 ? "var(--bow-blue)" : "var(--bow-slate)",
                border: "1px solid var(--border-rule)",
              }}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <p role="alert" style={{ margin: 0, padding: "12px 14px", background: "var(--bow-negative-tint,#fdecea)", border: "1px solid var(--bow-negative)", borderRadius: "var(--radius-control)", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-negative)" }}>
          {error}
        </p>
      )}

      {step === "children" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {children.map((child, index) => (
            <div key={child.key} style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "20px 18px", background: "#fff", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 17 }}>Child {index + 1}</h3>
                {children.length > 1 && (
                  <button type="button" onClick={() => removeChild(child.key)} style={{ background: "none", border: "none", color: "var(--bow-slate)", fontFamily: "var(--font-data)", fontSize: 12, cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                <div style={fieldWrap}>
                  <label style={labelStyle} htmlFor={`first-${child.key}`}>First name *</label>
                  <input id={`first-${child.key}`} style={fieldStyle} value={child.firstName} onChange={(e) => updateChild(child.key, { firstName: e.target.value })} autoComplete="given-name" required />
                </div>
                <div style={fieldWrap}>
                  <label style={labelStyle} htmlFor={`last-${child.key}`}>Last name *</label>
                  <input id={`last-${child.key}`} style={fieldStyle} value={child.lastName} onChange={(e) => updateChild(child.key, { lastName: e.target.value })} autoComplete="family-name" required />
                </div>
                <div style={fieldWrap}>
                  <label style={labelStyle} htmlFor={`grade-${child.key}`}>Grade</label>
                  <input id={`grade-${child.key}`} style={fieldStyle} value={child.grade} onChange={(e) => updateChild(child.key, { grade: e.target.value })} placeholder="e.g. 6th grade" />
                </div>
              </div>
              {showSchool && (
                <div style={fieldWrap}>
                  <label style={labelStyle} htmlFor={`school-${child.key}`}>School</label>
                  <input id={`school-${child.key}`} style={fieldStyle} value={child.school} onChange={(e) => updateChild(child.key, { school: e.target.value })} />
                </div>
              )}
            </div>
          ))}
          <Button type="button" variant="secondary" size="md" onClick={addChild}>+ Add another child</Button>
          <Button type="button" variant="primary" size="lg" onClick={goNext}>Continue</Button>
        </div>
      )}

      {step === "guardian" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "20px 18px", background: "#fff" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
            Collected once, for every child on this registration.
          </p>
          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="guardian-name">Full name *</label>
            <input id="guardian-name" style={fieldStyle} value={parentName} onChange={(e) => setParentName(e.target.value)} autoComplete="name" required />
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="guardian-email">Email *</label>
            <input id="guardian-email" type="email" style={fieldStyle} value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle} htmlFor="guardian-relationship">Relationship to the child(ren)</label>
            <select id="guardian-relationship" style={fieldStyle} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
              {["Parent", "Guardian", "Grandparent", "Other family member"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-interface)", fontSize: 14 }}>
            <input type="checkbox" checked={wantsPhone} onChange={(e) => setWantsPhone(e.target.checked)} />
            Add a phone number
          </label>
          {wantsPhone && (
            <div style={fieldWrap}>
              <label style={labelStyle} htmlFor="guardian-phone">Phone</label>
              <input id="guardian-phone" type="tel" style={fieldStyle} value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} autoComplete="tel" />
            </div>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <Button type="button" variant="ghost" size="md" onClick={goBack}>Back</Button>
            <Button type="button" variant="primary" size="lg" onClick={goNext}>Continue</Button>
          </div>
        </div>
      )}

      {step === "selections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {programs.length === 0 && (
            <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
              No programs are open for registration right now. <Link href="/programs/find">Find a program</Link> to get notified.
            </p>
          )}
          {children.map((child) => (
            <div key={child.key} style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "20px 18px", background: "#fff" }}>
              <h3 style={{ margin: "0 0 12px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 17 }}>
                {child.firstName || "This child"} {child.lastName}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {programs.map((program) => {
                  const eligibility = checkEligibility({ grade_min: program.gradeMin, grade_max: program.gradeMax }, child.grade || null);
                  const checked = child.programIds.includes(program.id);
                  return (
                    <label
                      key={program.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 12px",
                        border: `1px solid ${checked ? "var(--bow-blue)" : "var(--border-rule)"}`,
                        borderRadius: "var(--radius-control)",
                        opacity: eligibility.eligible ? 1 : 0.7,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!eligibility.eligible}
                        onChange={() => toggleProgram(child.key, program.id)}
                        style={{ marginTop: 4 }}
                      />
                      <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15 }}>{program.name}</span>
                        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                          Grades {program.gradeRangeLabel} · {program.availabilityLabel}
                        </span>
                        {!eligibility.eligible && (
                          <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-negative)" }}>{eligibility.reason}</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 12 }}>
            <Button type="button" variant="ghost" size="md" onClick={goBack}>Back</Button>
            <Button type="button" variant="primary" size="lg" onClick={goNext}>Continue to review</Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {children.map((child) => (
            <div key={child.key} style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "20px 18px", background: "#fff" }}>
              <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 17 }}>
                {child.firstName} {child.lastName} {child.grade && `— grade ${child.grade}`}
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {child.programIds.map((id) => {
                  const program = programById.get(id);
                  if (!program) return null;
                  return (
                    <li key={id} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 12px", background: "var(--bow-paper)", borderRadius: "var(--radius-control)" }}>
                      <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15 }}>{program.name}</span>
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-slate)" }}>
                        {program.startDate ?? "Date TBA"} · {program.availabilityLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "18px", background: "#fff" }}>
            <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 16 }}>Guardian</h3>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--text-primary)" }}>
              {parentName} · {parentEmail} · {relationship}
            </p>
          </div>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
            Submitting sends one registration. Anything a program still needs — forms, waivers, deadlines — is
            shown on the result and emailed to {parentEmail || "your email"}.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <Button type="button" variant="ghost" size="md" onClick={goBack} disabled={pending}>Back</Button>
            <Button type="button" variant="primary" size="lg" onClick={submit} disabled={pending}>
              {pending ? "Submitting…" : "Submit registration"}
            </Button>
          </div>
        </div>
      )}

      {step === "result" && results && (
        <ResultView results={results} activationEmail={activationEmail} />
      )}
    </div>
  );
}

function outcomeBadgeStatus(outcome: ChildSelectionResult["outcome"]): "positive" | "warning" | "negative" | "info" | "neutral" {
  switch (outcome) {
    case "confirmed":
    case "already_registered":
      return "positive";
    case "seat_reserved":
    case "under_review":
      return "warning";
    case "waitlisted":
    case "interest_recorded":
      return "info";
    case "ineligible":
    case "unavailable":
      return "negative";
    default:
      return "neutral";
  }
}

function ResultView({ results, activationEmail }: { results: ChildSelectionResult[]; activationEmail: string | null }) {
  const byChild = new Map<string, ChildSelectionResult[]>();
  for (const result of results) {
    const key = result.studentId ?? result.studentName;
    byChild.set(key, [...(byChild.get(key) ?? []), result]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <h2 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 24 }}>Your registration</h2>
        <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)" }}>
          Here is the result for every child and program you submitted.
        </p>
      </div>

      {Array.from(byChild.entries()).map(([key, childResults]) => (
        <div key={key} style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "20px 18px", background: "#fff" }}>
          <h3 style={{ margin: "0 0 14px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 17 }}>{childResults[0].studentName}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {childResults.map((result) => (
              <div key={`${result.programId}-${result.registrationId ?? "none"}`} style={{ padding: "12px 14px", background: "var(--bow-paper)", borderRadius: "var(--radius-control)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Badge status={outcomeBadgeStatus(result.outcome)}>{outcomeHeading(result.outcome)}</Badge>
                  <span style={{ fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 15 }}>{result.programName}</span>
                </div>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)" }}>{result.message}</p>
                {result.status && (
                  <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Status: {registrationLabel(result.status)}
                  </p>
                )}
                {result.outcome === "seat_reserved" && result.reservationExpiresAt && (
                  <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-orange)" }}>
                    Complete the required steps by {new Date(result.reservationExpiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })} to keep this seat.
                  </p>
                )}
                {result.outcome === "waitlisted" && (
                  <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
                    We can&apos;t promise a place or a date — we&apos;ll email you if a seat opens.
                  </p>
                )}
                {result.outcome === "interest_recorded" && (
                  <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-slate)" }}>
                    This is not a registration — no seat has been held.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {activationEmail && (
        <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--text-primary)", padding: "14px 16px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", background: "#fff" }}>
          We&apos;re sending an account activation email to <strong>{activationEmail}</strong> so you can check on
          these registrations and complete anything still needed.
        </p>
      )}

      <Button href="/programs" variant="secondary" size="md">Back to Programs</Button>
    </div>
  );
}
