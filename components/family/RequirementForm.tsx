"use client";

import { useActionState } from "react";
import { submitRequirement, type ActionState } from "@/app/actions/family-portal";
import type { RequirementRow } from "@/lib/family-portal";

/**
 * Renders by `kind`, never as raw JSON/columns. `file_upload` has no storage
 * backend wired up yet, so it renders as an explicit "unavailable" state
 * (with a support contact) instead of a fake form that would silently drop
 * whatever the parent submitted.
 */
export default function RequirementForm({ requirement }: { requirement: RequirementRow }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitRequirement, {});
  const alreadyDone = requirement.status === "approved" || requirement.status === "waived";
  const awaitingReview = requirement.status === "submitted";

  if (requirement.kind === "file_upload") {
    return (
      <div role="status" style={infoStyle}>
        Document upload isn&apos;t available in the family dashboard yet. Email your document to{" "}
        <a href="mailto:support@bowsportscapital.com">support@bowsportscapital.com</a> and reference {requirement.studentName}&apos;s
        registration.
      </div>
    );
  }

  if (alreadyDone) {
    return <div role="status" style={infoStyle}>Completed. {requirement.response ? `Your answer: "${requirement.response}"` : ""}</div>;
  }

  if (state.status === "success") {
    return <div role="status" style={successStyle}>{state.message}</div>;
  }

  const choices = parseChoices(requirement.choices);

  return (
    <form action={action}>
      <input type="hidden" name="requirementRowId" value={requirement.id} />

      {awaitingReview && (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--bow-slate, #6b6e75)" }}>
          Already submitted and awaiting staff review. You can update your answer below.
        </p>
      )}

      {requirement.kind === "choice" && choices.length > 0 ? (
        <select name="response" defaultValue={requirement.response ?? ""} required style={inputStyle} aria-label={requirement.prompt}>
          <option value="" disabled>Choose one…</option>
          {choices.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      ) : requirement.kind === "photo_consent" || requirement.kind === "agreement" || requirement.kind === "waiver" || requirement.kind === "logistics_ack" ? (
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14 }}>
          <input type="checkbox" name="response" value="acknowledged" required style={{ marginTop: 3 }} />
          <span>I acknowledge and agree.</span>
        </label>
      ) : (
        <textarea
          name="response"
          required
          maxLength={8000}
          rows={4}
          defaultValue={requirement.response ?? ""}
          style={{ ...inputStyle, resize: "vertical" }}
          aria-label={requirement.prompt}
        />
      )}

      {state.status === "error" && <p role="alert" style={{ margin: "10px 0 0", fontSize: 13, color: "#8a3820" }}>{state.message}</p>}

      <button type="submit" disabled={pending} style={submitStyle}>
        {pending ? "Saving…" : "Submit"}
      </button>
    </form>
  );
}

function parseChoices(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  fontSize: 15,
  border: "1px solid #cfd1d6",
  borderRadius: 6,
  fontFamily: "var(--font-interface)",
};
const infoStyle: React.CSSProperties = { padding: "14px 16px", background: "#f2f3f5", border: "1px solid #d8dae0", borderRadius: 8, fontSize: 14, lineHeight: 1.6 };
const successStyle: React.CSSProperties = { padding: "14px 16px", background: "#eef6ee", border: "1px solid #b9d8b9", borderRadius: 8, fontSize: 14 };
const submitStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "12px 22px",
  fontSize: 15,
  fontWeight: 700,
  border: "none",
  borderRadius: 6,
  background: "var(--bow-orange, #d4531f)",
  color: "#fff",
  cursor: "pointer",
  minHeight: 46,
};
