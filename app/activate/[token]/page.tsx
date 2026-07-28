import type { Metadata } from "next";
import Link from "next/link";
import { inspectActivation } from "@/lib/parent-activation";
import ActivationForm from "@/components/family/ActivationForm";
import ResendActivationForm from "@/components/family/ResendActivationForm";

export const metadata: Metadata = {
  title: "Activate your BOW family account",
  description: "Set a password to finish setting up your BOW Sports Capital parent account.",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Renders the right state before ever asking for a password — inspecting
 * the token never consumes it, so a link can be reloaded safely. The five
 * states this must distinguish (valid / expired / used / failed /
 * support-required) all have distinct copy; none of them may claim success.
 */
export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await inspectActivation(token);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bow-paper, #f7f6f3)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px clamp(18px,4vw,40px)", borderBottom: "1px solid #e4e2dc" }}>
        <Link href="/" style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 20, textDecoration: "none", color: "var(--bow-ink, #16181d)", textTransform: "uppercase" }}>
          BOW Sports Capital
        </Link>
      </div>
      <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "clamp(28px,5vw,64px) 18px" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(24px,4vw,32px)", margin: "0 0 8px" }}>
            Activate your family account
          </h1>

          {!lookup && (
            <StatusPanel
              tone="error"
              title="We couldn't find this activation link"
              body="The link may be mistyped or already used. If you registered a child recently, check your email for the original invitation, or contact support."
            />
          )}

          {lookup?.state === "complete" && (
            <StatusPanel tone="info" title="This account is already active" body="You can sign in with the password you already set.">
              <Link href="/sign-in" style={linkButtonStyle}>Go to sign in</Link>
            </StatusPanel>
          )}

          {lookup?.state === "expired" && (
            <StatusPanel tone="error" title="This link has expired" body="Activation links last 14 days. Request a fresh one below and we'll send it to the same email.">
              <ResendActivationForm activationId={lookup.id} />
            </StatusPanel>
          )}

          {lookup?.state === "failed" && (
            <StatusPanel tone="error" title="Your account was not created" body="A previous attempt on this link did not finish, so nothing was activated. Request a fresh link below, or contact support if this keeps happening.">
              <ResendActivationForm activationId={lookup.id} />
            </StatusPanel>
          )}

          {lookup?.state === "support_required" && (
            <StatusPanel tone="error" title="We need to sort this out with you directly" body="This email is already tied to a BOW staff account, so it can't be claimed through a family activation link. Contact support and we'll help.">
              <a href="mailto:support@bowsportscapital.com" style={linkButtonStyle}>Email support</a>
            </StatusPanel>
          )}

          {(lookup?.state === "invitation_pending" || lookup?.state === "identity_created" || lookup?.state === "family_linked") && (
            <>
              <p style={{ fontFamily: "var(--font-interface)", color: "var(--bow-slate, #55585f)", lineHeight: 1.6, margin: "0 0 20px" }}>
                Set a password for <strong>{lookup.email}</strong> to finish setting up your family dashboard.
              </p>
              <ActivationForm token={token} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const linkButtonStyle: React.CSSProperties = {
  display: "inline-block",
  marginTop: 12,
  fontFamily: "var(--font-interface)",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--bow-orange, #d4531f)",
  textDecoration: "none",
};

function StatusPanel({
  tone,
  title,
  body,
  children,
}: {
  tone: "error" | "info";
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        border: `1px solid ${tone === "error" ? "#e2b4a5" : "#d8dae0"}`,
        background: tone === "error" ? "#fbf1ee" : "#f2f3f5",
        borderRadius: 8,
        padding: "16px 18px",
      }}
    >
      <p style={{ margin: "0 0 6px", fontFamily: "var(--font-interface)", fontWeight: 700, fontSize: 15 }}>{title}</p>
      <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.6, color: "var(--bow-slate, #55585f)" }}>{body}</p>
      {children}
    </div>
  );
}
