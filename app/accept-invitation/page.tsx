"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type InviteState = "valid" | "expired" | "revoked" | "accepted" | "wrongemail" | "notfound";
type InviteRole = "student" | "instructor";

interface InviteData {
  email: string;
  role: string;
  org: string;
  cohort: string;
  track: string;
  expires: string;
}

interface InvalidCopy {
  title: string;
  body: string;
  cta: string;
}

const INVITE_BY_ROLE: Record<InviteRole, InviteData> = {
  instructor: {
    email: "priya@eastsideyouth.org",
    role: "Instructor",
    org: "Eastside Youth Alliance",
    cohort: "Eastside — Track 201",
    track: "Track 201",
    expires: "Jun 20, 2026",
  },
  student: {
    email: "aisha.o@lincolnhs.edu",
    role: "Student",
    org: "Lincoln High School",
    cohort: "Lincoln Fall — Track 101",
    track: "Track 101",
    expires: "Jun 24, 2026",
  },
};

const INVALID_COPY: Record<Exclude<InviteState, "valid">, InvalidCopy> = {
  expired: {
    title: "This invitation has expired",
    body: "Invitations are valid for 14 days. Ask your BOW administrator or instructor to send a fresh one.",
    cta: "Request a new invitation",
  },
  revoked: {
    title: "This invitation was revoked",
    body: "A BOW administrator cancelled this invitation. If you think this is a mistake, reach out to the person who invited you.",
    cta: "Contact BOW",
  },
  accepted: {
    title: "This invitation was already used",
    body: "It looks like you’ve already joined. Try signing in instead.",
    cta: "Go to sign in",
  },
  wrongemail: {
    title: "This invitation is for a different email",
    body: "You’re signed in with an email that doesn’t match this invitation. Sign out and use the invited address.",
    cta: "Go to sign in",
  },
  notfound: {
    title: "We couldn’t find this invitation",
    body: "The link may be incomplete or out of date. Check the most recent message you received.",
    cta: "Go to sign in",
  },
};

const STATE_CHIPS: { id: InviteState; label: string }[] = [
  { id: "valid", label: "Valid" },
  { id: "expired", label: "Expired" },
  { id: "revoked", label: "Revoked" },
  { id: "accepted", label: "Already accepted" },
  { id: "wrongemail", label: "Wrong email" },
  { id: "notfound", label: "Not found" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bow-ink)",
  border: "1px solid var(--bow-dark-border)",
  color: "#fff",
  padding: 12,
  borderRadius: 4,
  fontFamily: "var(--font-interface)",
  fontSize: 14,
};
const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#9a9da6",
  display: "block",
  marginBottom: 6,
};
const eyebrowBlue: React.CSSProperties = {
  fontFamily: "var(--font-data)",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--bow-blue)",
};
const primaryBtn: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  border: "none",
  background: "var(--bow-blue)",
  color: "#fff",
  borderRadius: 4,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "13px 20px",
  border: "1px solid var(--bow-dark-border)",
  background: "transparent",
  color: "#fff",
  borderRadius: 4,
  cursor: "pointer",
};

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [inviteState, setInviteState] = useState<InviteState>("valid");
  const [inviteRole, setInviteRole] = useState<InviteRole>("student");
  const [acceptStep, setAcceptStep] = useState(1);
  const [acceptData, setAcceptData] = useState<Record<string, string>>({});

  const inv = INVITE_BY_ROLE[inviteRole];
  const invInvalid = inviteState === "valid" ? null : INVALID_COPY[inviteState];
  const inviteValid = inviteState === "valid";
  const isStudent = inviteRole === "student";

  const goState = (s: InviteState) => {
    setInviteState(s);
    setAcceptStep(1);
    setAcceptData({});
  };
  const goRole = (r: InviteRole) => {
    setInviteRole(r);
    setAcceptStep(1);
    setAcceptData({});
  };
  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAcceptData((d) => ({ ...d, [k]: e.target.value }));
  const advance = () => setAcceptStep((s) => Math.min(s + 1, 4));
  const back = () => setAcceptStep((s) => Math.max(s - 1, 1));

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
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 9,
              letterSpacing: "0.32em",
              color: "#9a9da6",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
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
          {/* prototype preview controls */}
          <div style={{ border: "1px dashed var(--bow-dark-border)", borderRadius: 6, padding: "14px 16px", marginBottom: 26 }}>
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--bow-warning)",
                display: "block",
                marginBottom: 10,
              }}
            >
              ● Prototype Invitation Preview
            </span>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {(["student", "instructor"] as InviteRole[]).map((r) => {
                const active = inviteRole === r;
                return (
                  <button
                    key={r}
                    onClick={() => goRole(r)}
                    style={{
                      flex: 1,
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      padding: 7,
                      borderRadius: 4,
                      cursor: "pointer",
                      border: "1px solid var(--bow-dark-border)",
                      background: active ? "var(--bow-blue)" : "transparent",
                      color: active ? "#fff" : "#c8cad0",
                    }}
                  >
                    {r === "student" ? "Student invite" : "Instructor invite"}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {STATE_CHIPS.map((s) => {
                const active = inviteState === s.id;
                return (
                  <span
                    key={s.id}
                    onClick={() => goState(s.id)}
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 10,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      padding: "5px 9px",
                      borderRadius: 3,
                      cursor: "pointer",
                      border: `1px solid ${active ? "var(--bow-blue)" : "var(--bow-dark-border)"}`,
                      color: active ? "#fff" : "#9a9da6",
                      background: active ? "var(--bow-blue)" : "transparent",
                    }}
                  >
                    {s.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* INVALID states */}
          {invInvalid && (
            <div
              style={{
                background: "var(--bow-dark-surface)",
                border: "1px solid var(--bow-dark-border)",
                borderTop: "4px solid var(--bow-warning)",
                borderRadius: 6,
                padding: 32,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--bow-warning)",
                }}
              >
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
                {invInvalid.title}
              </h1>
              <p style={{ margin: "16px 0 26px", fontFamily: "var(--font-interface)", fontSize: 15.5, lineHeight: 1.65, color: "#b9bcc4" }}>
                {invInvalid.body}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/sign-in" style={{ ...primaryBtn, fontSize: 13, padding: "12px 22px", textDecoration: "none" }}>
                  {invInvalid.cta}
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
                    cursor: "pointer",
                    textDecoration: "none",
                  }}
                >
                  Public site
                </Link>
              </div>
            </div>
          )}

          {/* VALID invitation */}
          {inviteValid && (
            <div
              style={{
                background: "var(--bow-dark-surface)",
                border: "1px solid var(--bow-dark-border)",
                borderTop: "4px solid var(--bow-blue)",
                borderRadius: 6,
                padding: "clamp(24px,4vw,36px)",
              }}
            >
              {/* Step 1: summary */}
              {acceptStep === 1 && (
                <>
                  <span style={eyebrowBlue}>You’re invited</span>
                  <h1
                    style={{
                      margin: "12px 0 4px",
                      fontFamily: "var(--font-display)",
                      fontWeight: 900,
                      fontSize: "clamp(30px,4vw,44px)",
                      lineHeight: 0.95,
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                    }}
                  >
                    Join {inv.org}
                  </h1>
                  <p style={{ margin: "0 0 24px", fontFamily: "var(--font-interface)", fontSize: 15, color: "#b9bcc4" }}>
                    You’ve been invited as a <strong style={{ color: "#fff" }}>{inv.role}</strong>. Confirm the details below
                    to get started.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 1,
                      background: "var(--bow-dark-border)",
                      border: "1px solid var(--bow-dark-border)",
                      marginBottom: 26,
                    }}
                  >
                    {[
                      { label: "Invited email", value: inv.email },
                      { label: "Role", value: inv.role },
                      { label: "Cohort", value: inv.cohort },
                      { label: "Track · Expires", value: `${inv.track} · ${inv.expires}` },
                    ].map((cell) => (
                      <div key={cell.label} style={{ background: "var(--bow-dark-surface)", padding: "14px 16px" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-data)",
                            fontSize: 10,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#6d7078",
                            display: "block",
                            marginBottom: 4,
                          }}
                        >
                          {cell.label}
                        </span>
                        <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>{cell.value}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={advance} style={{ ...primaryBtn, width: "100%", fontSize: 15, padding: 15 }}>
                    Accept Invitation
                  </button>
                </>
              )}

              {/* Step 2: short profile */}
              {acceptStep === 2 && (
                <>
                  <span style={eyebrowBlue}>Step 2 of 3 · About you</span>
                  <h1
                    style={{
                      margin: "12px 0 22px",
                      fontFamily: "var(--font-display)",
                      fontWeight: 900,
                      fontSize: "clamp(26px,3.4vw,36px)",
                      lineHeight: 1.0,
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                    }}
                  >
                    Tell us who you are
                  </h1>
                  {isStudent && (
                    <>
                      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1 }}>
                          <label style={labelStyle}>First name</label>
                          <input
                            value={acceptData.first ?? ""}
                            onChange={setField("first")}
                            placeholder="First name"
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ width: 130 }}>
                          <label style={labelStyle}>Last initial</label>
                          <input value={acceptData.last ?? ""} onChange={setField("last")} placeholder="B." style={inputStyle} />
                        </div>
                      </div>
                      <label style={labelStyle}>Grade band</label>
                      <input
                        value={acceptData.grade ?? ""}
                        onChange={setField("grade")}
                        placeholder="e.g. 8th grade"
                        style={{ ...inputStyle, marginBottom: 24 }}
                      />
                    </>
                  )}
                  {!isStudent && (
                    <>
                      <label style={labelStyle}>Full name</label>
                      <input
                        value={acceptData.first ?? ""}
                        onChange={setField("first")}
                        placeholder="Your name"
                        style={{ ...inputStyle, marginBottom: 16 }}
                      />
                      <label style={labelStyle}>Teaching role</label>
                      <input
                        value={acceptData.teachRole ?? ""}
                        onChange={setField("teachRole")}
                        placeholder="e.g. Lead instructor"
                        style={{ ...inputStyle, marginBottom: 12 }}
                      />
                      <div
                        style={{
                          background: "var(--bow-ink)",
                          border: "1px solid var(--bow-dark-border)",
                          padding: "12px 14px",
                          borderRadius: 4,
                          marginBottom: 24,
                        }}
                      >
                        <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "#b9bcc4" }}>
                          Organization: <strong style={{ color: "#fff" }}>{inv.org}</strong> — confirmed by BOW.
                        </span>
                      </div>
                    </>
                  )}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={back} style={ghostBtn}>
                      Back
                    </button>
                    <button onClick={advance} style={{ ...primaryBtn, flex: 1, fontSize: 14, padding: 13 }}>
                      Continue
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: sign-in setup + confirm */}
              {acceptStep === 3 && (
                <>
                  <span style={eyebrowBlue}>Step 3 of 3 · Set up sign-in</span>
                  <h1
                    style={{
                      margin: "12px 0 20px",
                      fontFamily: "var(--font-display)",
                      fontWeight: 900,
                      fontSize: "clamp(26px,3.4vw,36px)",
                      lineHeight: 1.0,
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                    }}
                  >
                    Create your password
                  </h1>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password"
                    value={acceptData.password ?? ""}
                    onChange={setField("password")}
                    placeholder="••••••••"
                    style={{ ...inputStyle, marginBottom: 20 }}
                  />
                  <div
                    style={{
                      background: "var(--bow-ink)",
                      border: "1px solid var(--bow-dark-border)",
                      borderLeft: "3px solid var(--bow-positive)",
                      padding: "14px 16px",
                      borderRadius: 4,
                      marginBottom: 24,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-data)",
                        fontSize: 10,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--bow-positive)",
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Confirm your cohort
                    </span>
                    <span style={{ fontFamily: "var(--font-interface)", fontSize: 14, color: "#fff" }}>
                      {inv.cohort} · {inv.track}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={back} style={ghostBtn}>
                      Back
                    </button>
                    <button
                      onClick={advance}
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 14,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        flex: 1,
                        padding: 13,
                        border: "none",
                        background: "var(--bow-positive)",
                        color: "#fff",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Join &amp; Continue
                    </button>
                  </div>
                  <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 11.5, color: "#6d7078", lineHeight: 1.5 }}>
                    Prototype: no account is created and no password is stored. “Join” signs you in to the demo experience.
                  </p>
                </>
              )}

              {/* Step 4: success */}
              {acceptStep === 4 && (
                <>
                  <span
                    style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 11,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--bow-positive)",
                    }}
                  >
                    You’re in
                  </span>
                  <h1
                    style={{
                      margin: "12px 0 4px",
                      fontFamily: "var(--font-display)",
                      fontWeight: 900,
                      fontSize: "clamp(30px,4vw,44px)",
                      lineHeight: 0.95,
                      letterSpacing: "-0.01em",
                      textTransform: "uppercase",
                    }}
                  >
                    Welcome to {inv.org}
                  </h1>
                  <p style={{ margin: "0 0 24px", fontFamily: "var(--font-interface)", fontSize: 15, color: "#b9bcc4" }}>
                    Your spot in <strong style={{ color: "#fff" }}>{inv.cohort}</strong> is confirmed as a{" "}
                    <strong style={{ color: "#fff" }}>{inv.role}</strong>. You can jump in now or sign in any time.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => router.push("/app")}
                      style={{ ...primaryBtn, fontSize: 14, padding: "13px 22px", background: "var(--bow-positive)" }}
                    >
                      Enter the platform
                    </button>
                    <Link href="/sign-in" style={{ ...ghostBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                      Go to sign in
                    </Link>
                  </div>
                  <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 11.5, color: "#6d7078", lineHeight: 1.5 }}>
                    Prototype: no account was created. This is a preview of the post-acceptance experience.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
