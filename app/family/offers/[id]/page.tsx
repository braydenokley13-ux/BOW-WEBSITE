import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { guardianPersonForUser } from "@/lib/parent-activation";
import { loadOfferForGuardian } from "@/lib/family-portal";
import OfferResponseForm from "@/components/family/OfferResponseForm";

export const metadata: Metadata = { title: "Waitlist offer" };

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireRole("parent");
  const personId = await guardianPersonForUser(me.id);
  if (!personId) notFound();

  const offer = await loadOfferForGuardian(id, personId);
  if (!offer) notFound();

  const expired = offer.expired;

  return (
    <div style={{ maxWidth: 560 }}>
      <p style={{ margin: "0 0 4px", fontFamily: "var(--font-data)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bow-slate, #6b6e75)" }}>
        {offer.studentName}
      </p>
      <h1 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26 }}>
        Seat offer — {offer.programName}
      </h1>

      {offer.status === "accepted" && <StatusBanner tone="success">This offer was already accepted.</StatusBanner>}
      {offer.status === "declined" && <StatusBanner tone="info">This offer was declined.</StatusBanner>}
      {offer.status === "revoked" && <StatusBanner tone="info">This offer was withdrawn by BOW staff. Contact support for details.</StatusBanner>}
      {expired && offer.status === "sent" && (
        <StatusBanner tone="info">
          This offer window closed on {new Date(offer.expiresAt).toLocaleString()}. Your family stays on the waitlist —
          no action is needed, and you&apos;ll be notified if another seat opens.
        </StatusBanner>
      )}

      {offer.status === "sent" && !expired && (
        <>
          <p style={{ margin: "0 0 16px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate, #55585f)" }}>
            Respond by <strong>{new Date(offer.expiresAt).toLocaleString()}</strong> to keep this seat.
          </p>
          {offer.requirementsPreview.length > 0 && (
            <div style={{ marginBottom: 20, background: "#f2f3f5", border: "1px solid #d8dae0", borderRadius: 8, padding: "12px 16px" }}>
              <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 13 }}>Accepting will ask you to complete:</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                {offer.requirementsPreview.map((r) => (
                  <li key={r.prompt}>{r.prompt}</li>
                ))}
              </ul>
            </div>
          )}
          <OfferResponseForm offerId={offer.id} />
        </>
      )}

      {offer.supportContact && (
        <p style={{ marginTop: 24, fontSize: 13, color: "var(--bow-slate, #6b6e75)" }}>
          Questions? Contact {offer.supportContact}.
        </p>
      )}
    </div>
  );
}

function StatusBanner({ tone, children }: { tone: "success" | "info"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      style={{
        padding: "14px 16px",
        marginBottom: 18,
        borderRadius: 8,
        background: tone === "success" ? "#eef6ee" : "#f2f3f5",
        border: `1px solid ${tone === "success" ? "#b9d8b9" : "#d8dae0"}`,
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}
