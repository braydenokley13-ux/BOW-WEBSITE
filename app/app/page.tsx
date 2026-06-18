"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app/AppState";
import { roleHomePath, type Role } from "@/lib/account";

const ROLES: { role: Role; title: string; accent: string; body: string }[] = [
  { role: "student", title: "Student", accent: "var(--bow-blue)", body: "Continue your track, see your next session and progress." },
  { role: "instructor", title: "Instructor", accent: "var(--bow-positive)", body: "Run today’s session, take attendance, manage cohorts." },
  { role: "admin", title: "Administrator", accent: "var(--bow-orange)", body: "Keep every program moving: cohorts, people, invitations." },
];

export default function RoleLauncher() {
  const { signInAs } = useAppState();
  const router = useRouter();

  const enter = (role: Role) => {
    signInAs(role);
    router.push(roleHomePath(role));
  };

  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(24px,5vw,64px) clamp(18px,4vw,32px)" }}>
      <div style={{ maxWidth: 640, width: "100%", textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bow-warning)" }}>● Prototype Role Preview</span>
        <h1 style={{ margin: "14px 0 12px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(34px,5vw,60px)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase" }}>Preview the BOW platform</h1>
        <p style={{ margin: "0 auto 36px", maxWidth: 460, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "#b9bcc4" }}>
          Choose a role to step into. This is a design prototype — no real authentication, accounts, or data are involved yet.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, textAlign: "left" }}>
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => enter(r.role)}
              style={{ background: "var(--bow-dark-surface)", border: "1px solid var(--bow-dark-border)", borderTop: `4px solid ${r.accent}`, borderRadius: 6, padding: 22, cursor: "pointer", textAlign: "left", color: "#fff" }}
            >
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", letterSpacing: "-0.01em", display: "block" }}>{r.title}</span>
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "#9a9da6", lineHeight: 1.5 }}>{r.body}</span>
            </button>
          ))}
        </div>
        <Link href="/" style={{ display: "inline-block", marginTop: 30, fontFamily: "var(--font-interface)", fontSize: 13, color: "#9a9da6" }}>
          Return to public site
        </Link>
      </div>
    </div>
  );
}
