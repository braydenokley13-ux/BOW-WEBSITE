"use client";

import { useActionState } from "react";
import { resendActivation, type ResendState } from "@/app/actions/parent-activation";

export default function ResendActivationForm({ activationId }: { activationId: string }) {
  const [state, action, pending] = useActionState<ResendState, FormData>(resendActivation, {});

  if (state.sent) {
    return (
      <p role="status" style={{ marginTop: 12, fontSize: 14, color: "var(--bow-slate, #55585f)" }}>
        If that link is still eligible for a resend, a fresh one is on its way to the same email.
      </p>
    );
  }

  return (
    <form action={action} style={{ marginTop: 12 }}>
      <input type="hidden" name="activationId" value={activationId} />
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "10px 16px",
          fontSize: 14,
          fontWeight: 700,
          border: "1px solid var(--bow-orange, #d4531f)",
          borderRadius: 6,
          background: "transparent",
          color: "var(--bow-orange, #d4531f)",
          cursor: "pointer",
          minHeight: 44,
        }}
      >
        {pending ? "Sending…" : "Send a new activation link"}
      </button>
      {state.error && (
        <p role="alert" style={{ marginTop: 8, fontSize: 13, color: "#8a3820" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
