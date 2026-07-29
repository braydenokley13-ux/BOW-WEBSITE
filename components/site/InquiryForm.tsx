"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ds";
import { submitPublicInquiry } from "@/app/actions/public-forms";
import {
  inquiryPaths,
  type InquiryPath,
  type InquiryField,
} from "@/lib/get-involved";

/* ============================================================
 * Get Involved inquiry funnel. The final review submits through the
 * durable public intake action and only shows success after the full
 * operational record commits.
 * ============================================================ */

type Step = 1 | 2 | 3;
type Status = "idle" | "editing" | "submitting" | "submitted" | "error";
type FormData = Record<string, string>;
type FormErrors = Record<string, string>;

const inputStyle: CSSProperties = {
  background: "var(--bow-ink)",
  border: "1px solid var(--bow-dark-border)",
  color: "#fff",
  padding: "12px 14px",
  fontFamily: "var(--font-interface)",
  fontSize: 15,
  width: "100%",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#9a9da6",
};

const ghostButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#6d7078",
};

function StepDot({ n, state }: { n: number; state: "active" | "done" | "todo" }) {
  const bg = state === "active" ? "var(--bow-blue)" : state === "done" ? "var(--bow-positive)" : "transparent";
  const border = state === "active" ? "var(--bow-blue)" : state === "done" ? "var(--bow-positive)" : "#3a3a42";
  const text = state === "todo" ? "#6d7078" : "#fff";
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        background: bg,
        border: `2px solid ${border}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-data)",
        fontSize: 12,
        fontWeight: 700,
        color: text,
      }}
    >
      {n}
    </span>
  );
}

/**
 * The default initial path can be preset by an audience page CTA
 * (e.g. the Schools page passes initialPathId="school").
 */
export default function InquiryForm({ initialPathId }: { initialPathId?: string }) {
  const presetPath = initialPathId ? inquiryPaths.find((p) => p.id === initialPathId) ?? null : null;
  const [path, setPath] = useState<InquiryPath | null>(presetPath);
  const [step, setStep] = useState<Step>(presetPath ? 2 : 1);
  const [data, setData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<Status>(presetPath ? "editing" : "idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);
  const submissionPendingRef = useRef(false);

  const choosePath = (p: InquiryPath) => {
    setPath(p);
    setStep(2);
    setData({});
    setErrors({});
    setSubmitError(null);
    setStatus("editing");
    requestKeyRef.current = null;
    submissionPendingRef.current = false;
  };

  const setField = (name: string, value: string) => {
    setData((d) => ({ ...d, [name]: value }));
    setErrors((e) => ({ ...e, [name]: "" }));
  };

  const validate = (): FormErrors => {
    if (!path) return {};
    const errs: FormErrors = {};
    path.fields.forEach((f) => {
      if (f.required) {
        const val = (data[f.name] || "").trim();
        if (!val) errs[f.name] = `${f.label} is required.`;
        else if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) errs[f.name] = "Enter a valid email address.";
      }
    });
    return errs;
  };

  const advance = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setStep(3);
  };

  const submit = async () => {
    if (!path) return;
    const currentErrors = validate();
    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      setStep(2);
      setStatus("editing");
      return;
    }
    if (submissionPendingRef.current) return;
    submissionPendingRef.current = true;
    setSubmitError(null);
    setStatus("submitting");
    const orgName =
      data.schoolName || data.campName || data.orgName || data.organization || data.publication || "";
    const identityFields = new Set([
      "contactName",
      "email",
      "schoolName",
      "campName",
      "orgName",
      "organization",
      "publication",
    ]);
    const detail = path.fields.flatMap((field) => {
      const value = (data[field.name] || "").trim();
      return value && !identityFields.has(field.name) ? [`${field.label}: ${value}.`] : [];
    });
    const summary = [`${path.label} inquiry.`, ...detail].join(" ");
    const requestKey = requestKeyRef.current
      ?? `involved-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    requestKeyRef.current = requestKey;

    try {
      const result = await submitPublicInquiry({
        requestKey,
        source: "get_involved",
        name: (data.contactName || "").trim(),
        email: (data.email || "").trim(),
        type: path.label,
        orgName,
        summary,
      });
      if (!result.ok) {
        setSubmitError(result.error ?? "We could not record the inquiry. Review the information and try again safely.");
        setStatus("error");
        return;
      }
      setStatus("submitted");
    } catch {
      setSubmitError("The inquiry could not be confirmed because the connection was interrupted. Please try again.");
      setStatus("error");
    } finally {
      submissionPendingRef.current = false;
    }
  };

  const goBack = () => {
    if (step === 3) {
      setStep(2);
      setStatus("editing");
      setSubmitError(null);
    } else if (step === 2) {
      setStep(1);
      setPath(null);
      setStatus("idle");
    }
  };

  const reset = () => {
    setPath(null);
    setStep(1);
    setData({});
    setErrors({});
    setSubmitError(null);
    setStatus("idle");
    requestKeyRef.current = null;
    submissionPendingRef.current = false;
  };

  const reviewItems =
    path?.fields
      .map((f) => ({ label: f.label, value: (data[f.name] || "").trim() }))
      .filter((i) => i.value.length > 0) ?? [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Get Involved</span>
        <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(40px,6vw,84px)", lineHeight: 0.86, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Step into the front office.</h1>

        {/* Progress indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StepDot n={1} state={step === 1 ? "active" : "done"} />
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff" }}>Choose Path</span>
          </div>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "#3a3a42" }}>—</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StepDot n={2} state={step === 2 ? "active" : step > 2 ? "done" : "todo"} />
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: step >= 2 ? "#fff" : "#6d7078" }}>Your Information</span>
          </div>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "#3a3a42" }}>—</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StepDot n={3} state={step === 3 ? "active" : "todo"} />
            <span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: step >= 3 ? "#fff" : "#6d7078" }}>Review &amp; Send</span>
          </div>
        </div>
      </div>

      {/* Step 1: Path selector */}
      {step === 1 && (
        <div>
          <p style={{ margin: "0 0 28px", fontFamily: "var(--font-interface)", fontSize: 19, lineHeight: 1.55, color: "#b9bcc4", maxWidth: 540 }}>What are you looking to do?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {inquiryPaths.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => choosePath(p)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "22px 24px", background: "var(--bow-dark-surface)", border: "1px solid var(--bow-dark-border)", cursor: "pointer", textAlign: "left", transition: "background 180ms" }}
              >
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(18px,2vw,22px)", textTransform: "uppercase", letterSpacing: "0.01em", color: "#fff" }}>{p.label}</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 20, color: "var(--bow-blue)", flexShrink: 0 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Form */}
      {step === 2 && path && (
        <div>
          <button type="button" onClick={goBack} style={{ ...ghostButtonStyle, fontFamily: "var(--font-data)", fontWeight: 400, fontSize: 12, letterSpacing: "0.08em", marginBottom: 24, padding: 0, display: "flex", alignItems: "center", gap: 8 }}>← Back</button>
          <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,52px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: "#fff" }}>{path.headline}</h2>
          <p style={{ margin: "0 0 32px", fontFamily: "var(--font-interface)", fontSize: 17, lineHeight: 1.55, color: "#b9bcc4" }}>{path.description}</p>
          <div style={{ background: "var(--bow-dark-surface)", border: "1px solid var(--bow-dark-border)", borderTop: "4px solid var(--bow-blue)", padding: "clamp(22px,3vw,36px)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {path.fields.map((field: InquiryField) => {
                const value = data[field.name] || "";
                const error = errors[field.name] || "";
                return (
                  <div key={field.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label htmlFor={`inq-${field.name}`} style={labelStyle}>
                      {field.label}
                      {field.required && (
                        <span style={{ color: "var(--bow-blue)", marginLeft: 4 }} aria-label="required"> *</span>
                      )}
                    </label>
                    {field.type === "text" && (
                      <input className="bow-field" id={`inq-${field.name}`} value={value} onChange={(e) => setField(field.name, e.target.value)} type="text" placeholder={field.placeholder} required={field.required} maxLength={200} aria-invalid={error ? true : undefined} aria-describedby={error ? `inq-${field.name}-error` : undefined} style={inputStyle} />
                    )}
                    {field.type === "email" && (
                      <input className="bow-field" id={`inq-${field.name}`} value={value} onChange={(e) => setField(field.name, e.target.value)} type="email" placeholder={field.placeholder} required={field.required} maxLength={200} autoComplete="email" aria-invalid={error ? true : undefined} aria-describedby={error ? `inq-${field.name}-error` : undefined} style={inputStyle} />
                    )}
                    {field.type === "select" && (
                      <select className="bow-field" id={`inq-${field.name}`} value={value} onChange={(e) => setField(field.name, e.target.value)} required={field.required} aria-invalid={error ? true : undefined} aria-describedby={error ? `inq-${field.name}-error` : undefined} style={inputStyle}>
                        <option value="">Select…</option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    {field.type === "textarea" && (
                      <textarea className="bow-field" id={`inq-${field.name}`} value={value} onChange={(e) => setField(field.name, e.target.value)} rows={4} placeholder={field.placeholder} required={field.required} maxLength={1200} aria-invalid={error ? true : undefined} aria-describedby={error ? `inq-${field.name}-error` : undefined} style={{ ...inputStyle, resize: "vertical" }} />
                    )}
                    {error && (
                      <span id={`inq-${field.name}-error`} role="alert" style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-negative)", letterSpacing: "0.02em" }}>{error}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <Button variant="primary" size="lg" onClick={advance}>Review Inquiry →</Button>
              <button type="button" onClick={goBack} style={ghostButtonStyle}>Back</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && path && (
        <div aria-busy={status === "submitting"}>
          <button type="button" disabled={status === "submitting"} onClick={goBack} style={{ ...ghostButtonStyle, fontFamily: "var(--font-data)", fontWeight: 400, fontSize: 12, letterSpacing: "0.08em", marginBottom: 24, padding: 0, display: "flex", alignItems: "center", gap: 8 }}>← Edit</button>
          <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,3.8vw,44px)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: "#fff" }}>Review your inquiry.</h2>
          <p style={{ margin: "0 0 28px", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.55, color: "#9a9da6" }}>Check your information and send when ready.</p>
          <div style={{ background: "var(--bow-dark-surface)", border: "1px solid var(--bow-dark-border)", marginBottom: 24 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--bow-dark-border)" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-orange)" }}>{path.label}</span>
            </div>
            {reviewItems.map((item) => (
              <div key={item.label} style={{ display: "grid", gridTemplateColumns: "minmax(0, 160px) minmax(0, 1fr)", gap: 12, padding: "14px clamp(12px,4vw,20px)", borderBottom: "1px solid var(--bow-dark-border)", alignItems: "start" }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6d7078" }}>{item.label}</span>
                <span style={{ minWidth: 0, fontFamily: "var(--font-interface)", fontSize: 15, color: "#fff", lineHeight: 1.4, overflowWrap: "anywhere" }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Success / thank-you state */}
          {status === "submitted" ? (
            <div style={{ border: "1px solid var(--bow-dark-border)", borderLeft: "4px solid var(--bow-positive)", padding: "22px 24px", marginBottom: 24 }} role="status">
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-positive)", display: "block", marginBottom: 10 }}>Inquiry received</span>
              <p style={{ margin: "0 0 14px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "#b9bcc4" }}>{path.successMessage}</p>
              <p style={{ margin: "0 0 14px", fontFamily: "var(--font-interface)", fontSize: 13, lineHeight: 1.6, color: "#6d7078" }}>Your inquiry has been sent to the BOW front office and will appear in the admin inbox.</p>
              <button type="button" onClick={reset} style={ghostButtonStyle}>Start Over</button>
            </div>
          ) : (
            <>
              {submitError && (
                <p role="alert" aria-live="assertive" style={{ margin: "0 0 14px", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: "var(--bow-negative)" }}>
                  {submitError}
                </p>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <Button variant="primary" size="lg" disabled={status === "submitting"} onClick={submit}>
                  {status === "submitting" ? "Sending…" : status === "error" ? "Try Again" : "Send Inquiry"}
                </Button>
                <button type="button" disabled={status === "submitting"} onClick={goBack} style={{ ...ghostButtonStyle, opacity: status === "submitting" ? 0.55 : 1 }}>Edit</button>
              </div>
              <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 12, lineHeight: 1.5, color: "#6d7078" }}>{path.nextStep}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
