"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { registerForProgram } from "@/app/actions/public-registration";

interface Props {
  programId: string;
  programName: string;
}

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--bow-slate)",
};

const fieldStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid var(--border-rule)",
  borderRadius: "var(--radius-control)",
  padding: "12px 14px",
  fontSize: 15,
  fontFamily: "var(--font-interface)",
  width: "100%",
};

const fieldWrap: CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };

export default function ProgramRegistrationForm({ programId, programName }: Props) {
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [grade, setGrade] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [school, setSchool] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ status: "confirmed" | "pending" | "waitlisted" } | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const submissionPendingRef = useRef(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submissionPendingRef.current) return;
    if (!studentFirstName.trim() || !studentLastName.trim()) {
      setError("Add the student's first and last name.");
      return;
    }
    if (!parentName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())) {
      setError("Add a parent or guardian name and a valid email.");
      return;
    }
    submissionPendingRef.current = true;
    setPending(true);
    setError("");
    const requestKey = requestKeyRef.current
      ?? `preg-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    requestKeyRef.current = requestKey;
    try {
      const outcome = await registerForProgram({
        requestKey,
        programId,
        studentFirstName: studentFirstName.trim(),
        studentLastName: studentLastName.trim(),
        grade: grade.trim() || undefined,
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim(),
        parentPhone: parentPhone.trim() || undefined,
        school: school.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        referralSource: referralSource.trim() || undefined,
      });
      if (!outcome.ok || !outcome.status) {
        setError(outcome.error ?? "Registration could not be saved. Please try again.");
        submissionPendingRef.current = false;
        setPending(false);
        return;
      }
      setResult({ status: outcome.status });
    } catch {
      setError("Registration could not be saved because the connection was interrupted. It's safe to try again.");
      submissionPendingRef.current = false;
      setPending(false);
    }
  };

  if (result) {
    const heading =
      result.status === "confirmed" ? "You're registered." : result.status === "pending" ? "Registration submitted." : "You're on the waitlist.";
    const body =
      result.status === "confirmed"
        ? `${studentFirstName} is registered for ${programName}. A confirmation email is on its way to ${parentEmail}.`
        : result.status === "pending"
          ? `Thanks — BOW will confirm ${studentFirstName}'s spot in ${programName} by email shortly.`
          : `${programName} is full right now. We'll email ${parentEmail} the moment a spot opens.`;
    return (
      <div style={{ border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "32px 28px", background: "#fff" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: 26 }}>{heading}</h2>
        <p style={{ margin: "14px 0 0", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>{body}</p>
        <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button href="/programs" variant="secondary" size="md">Back to Programs</Button>
          <Button href="/sign-in" variant="ghost" size="md">Sign In / Create an Account</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18, border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "28px 26px", background: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="reg-first">Student first name *</label>
          <input id="reg-first" style={fieldStyle} value={studentFirstName} onChange={(e) => setStudentFirstName(e.target.value)} autoComplete="given-name" required />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="reg-last">Student last name *</label>
          <input id="reg-last" style={fieldStyle} value={studentLastName} onChange={(e) => setStudentLastName(e.target.value)} autoComplete="family-name" required />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="reg-grade">Grade</label>
          <input id="reg-grade" style={fieldStyle} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="6th grade" />
        </div>
      </div>

      <div style={{ height: 1, background: "var(--border-rule)" }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="reg-parent-name">Parent / guardian name *</label>
          <input id="reg-parent-name" style={fieldStyle} value={parentName} onChange={(e) => setParentName(e.target.value)} autoComplete="name" required />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="reg-parent-email">Parent / guardian email *</label>
          <input id="reg-parent-email" type="email" style={fieldStyle} value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="reg-parent-phone">Parent / guardian phone</label>
          <input id="reg-parent-phone" style={fieldStyle} value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} autoComplete="tel" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="reg-school">School</label>
          <input id="reg-school" style={fieldStyle} value={school} onChange={(e) => setSchool(e.target.value)} />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="reg-city">City</label>
          <input id="reg-city" style={fieldStyle} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div style={fieldWrap}>
          <label style={labelStyle} htmlFor="reg-state">State</label>
          <input id="reg-state" style={fieldStyle} value={state} onChange={(e) => setState(e.target.value)} />
        </div>
      </div>

      <div style={fieldWrap}>
        <label style={labelStyle} htmlFor="reg-referral">How did you hear about BOW?</label>
        <input id="reg-referral" style={fieldStyle} value={referralSource} onChange={(e) => setReferralSource(e.target.value)} />
      </div>

      {error && <p role="alert" style={{ margin: 0, color: "var(--bow-negative)", fontFamily: "var(--font-interface)", fontSize: 14 }}>{error}</p>}

      <Button type="submit" variant="emphasis" size="lg" disabled={pending} full>
        {pending ? "Submitting…" : "Register"}
      </Button>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 12.5, color: "var(--bow-slate)" }}>
        No account required. We only use this information to run {programName} and contact you about it.
      </p>
    </form>
  );
}
