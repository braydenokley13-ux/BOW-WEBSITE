"use client";

import { useActionState, useState } from "react";
import { respondToWaitlistOffer, type OfferActionState } from "@/app/actions/family-portal";

export default function OfferResponseForm({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState<OfferActionState, FormData>(respondToWaitlistOffer, {});
  const [confirmingDecline, setConfirmingDecline] = useState(false);

  if (state.status === "success") {
    return <p role="status" style={{ fontSize: 15, fontWeight: 600 }}>{state.message}</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <form action={action}>
          <input type="hidden" name="offerId" value={offerId} />
          <input type="hidden" name="response" value="accept" />
          <button type="submit" disabled={pending} style={acceptStyle}>
            {pending ? "Saving…" : "Accept seat"}
          </button>
        </form>

        {!confirmingDecline ? (
          <button type="button" onClick={() => setConfirmingDecline(true)} style={declineStyle}>
            Decline
          </button>
        ) : (
          <form action={action} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="hidden" name="offerId" value={offerId} />
            <input type="hidden" name="response" value="decline" />
            <span style={{ fontSize: 13 }}>Decline this seat? This can&apos;t be undone.</span>
            <button type="submit" disabled={pending} style={declineStyle}>Confirm decline</button>
            <button type="button" onClick={() => setConfirmingDecline(false)} style={{ ...declineStyle, border: "none", background: "none" }}>
              Cancel
            </button>
          </form>
        )}
      </div>
      {state.status === "error" && <p role="alert" style={{ marginTop: 10, fontSize: 13, color: "#8a3820" }}>{state.message}</p>}
    </div>
  );
}

const acceptStyle: React.CSSProperties = {
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
const declineStyle: React.CSSProperties = {
  padding: "12px 18px",
  fontSize: 14,
  fontWeight: 600,
  border: "1px solid #c7c9cf",
  borderRadius: 6,
  background: "#fff",
  color: "var(--bow-slate, #3f4147)",
  cursor: "pointer",
  minHeight: 46,
};
