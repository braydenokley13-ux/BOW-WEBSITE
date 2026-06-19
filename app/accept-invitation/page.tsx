import Link from "next/link";
import { getDb } from "@/lib/db";
import AcceptInvitationForm, { type InviteView } from "@/components/site/AcceptInvitationForm";

type InviteProblem = "expired" | "revoked" | "accepted" | "notfound";

const INVALID_COPY: Record<InviteProblem, { title: string; body: string; cta: string; href: string }> = {
  expired: {
    title: "This invitation has expired",
    body: "Invitations are valid for 14 days. Ask your BOW administrator or instructor to send a fresh one.",
    cta: "Go to sign in",
    href: "/sign-in",
  },
  revoked: {
    title: "This invitation was revoked",
    body: "A BOW administrator cancelled this invitation. If you think this is a mistake, reach out to the person who invited you.",
    cta: "Contact BOW",
    href: "/get-involved",
  },
  accepted: {
    title: "This invitation was already used",
    body: "It looks like you’ve already joined. Try signing in instead.",
    cta: "Go to sign in",
    href: "/sign-in",
  },
  notfound: {
    title: "We couldn’t find this invitation",
    body: "The link may be incomplete or out of date. Check the most recent message you received.",
    cta: "Go to sign in",
    href: "/sign-in",
  },
};

const TRACK_LABEL = (track: string | null | undefined) => (track ? `Track ${track}` : "—");

function loadInvite(token: string):
  | { ok: true; view: InviteView }
  | { ok: false; problem: InviteProblem } {
  const db = getDb();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const inv = db.prepare("SELECT * FROM invitations WHERE token = ?").get(token) as any;
  if (!inv) return { ok: false, problem: "notfound" };
  if (inv.status === "revoked") return { ok: false, problem: "revoked" };
  if (inv.status === "accepted") return { ok: false, problem: "accepted" };
  if (inv.status === "expired") return { ok: false, problem: "expired" };

  const org = db.prepare("SELECT name FROM organizations WHERE id = ?").get(inv.org_id) as any;
  const cohort = inv.cohort_id
    ? (db.prepare("SELECT name, track FROM cohorts WHERE id = ?").get(inv.cohort_id) as any)
    : null;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return {
    ok: true,
    view: {
      token: inv.token,
      email: inv.email,
      role: inv.role,
      roleLabel: inv.role === "instructor" ? "Instructor" : "Student",
      org: org?.name ?? "BOW Sports Capital",
      cohort: cohort?.name ?? "—",
      track: TRACK_LABEL(cohort?.track),
      expires: inv.expires,
    },
  };
}

export const metadata = {
  title: "Accept your invitation — BOW Sports Capital",
};

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? loadInvite(token) : ({ ok: false, problem: "notfound" } as const);

  return (
    <div
      className="bow-front-office"
      style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px clamp(18px,4vw,40px)",
          borderBottom: "1px solid var(--bow-dark-border)",
        }}
      >
        <Link href="/" style={{ display: "flex", flexDirection: "column", lineHeight: 0.8, textDecoration: "none", color: "#fff" }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 24, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
            BOW
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 9, letterSpacing: "0.32em", color: "#9a9da6", textTransform: "uppercase", marginTop: 2 }}>
            Sports Capital
          </span>
        </Link>
        <Link href="/sign-in" style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "#9a9da6", textDecoration: "none" }}>
          Already have an account? Sign in
        </Link>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "clamp(28px,4vw,56px) clamp(18px,4vw,32px)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 540 }}>
          {result.ok ? (
            <AcceptInvitationForm invite={result.view} />
          ) : (
            <div
              style={{
                background: "var(--bow-dark-surface)",
                border: "1px solid var(--bow-dark-border)",
                borderTop: "4px solid var(--bow-warning)",
                borderRadius: 6,
                padding: 32,
              }}
            >
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-warning)" }}>
                Invitation
              </span>
              <h1
                style={{
                  margin: "12px 0 0",
                  fontFamily: "var(--font-display)",
                  fontWeight: 900,
                  fontSize: "clamp(28px,4vw,40px)",
                  lineHeight: 1.0,
                  letterSpacing: "-0.01em",
                  textTransform: "uppercase",
                }}
              >
                {INVALID_COPY[result.problem].title}
              </h1>
              <p style={{ margin: "16px 0 26px", fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.65, color: "#b9bcc4" }}>
                {INVALID_COPY[result.problem].body}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link
                  href={INVALID_COPY[result.problem].href}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    background: "var(--bow-blue)",
                    color: "#fff",
                    borderRadius: 4,
                    padding: "12px 22px",
                    textDecoration: "none",
                  }}
                >
                  {INVALID_COPY[result.problem].cta}
                </Link>
                <Link
                  href="/"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    padding: "12px 22px",
                    border: "1px solid var(--bow-dark-border)",
                    background: "transparent",
                    color: "#fff",
                    borderRadius: 4,
                    textDecoration: "none",
                  }}
                >
                  Public site
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
