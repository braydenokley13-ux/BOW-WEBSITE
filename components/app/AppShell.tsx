"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppState } from "./AppState";
import AuthHeader from "./AuthHeader";
import RolePreview from "./RolePreview";
import Toast from "./Toast";
import ConfirmModal from "./ConfirmModal";

/** Full-screen neutral surface shown before client hydration / when gated. */
function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(24px,6vw,80px)" }}>
      {children}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { role } = useAppState();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isLauncher = pathname === "/app";

  // The launcher (/app) is role-independent and always reachable; render it
  // immediately (no mount-gate flash) — it sets the role.
  if (isLauncher) {
    return (
      <>
        {children}
        <Toast />
        <ConfirmModal />
      </>
    );
  }

  // Avoid a hydration mismatch on role-dependent screens: render a neutral
  // surface until the persisted session has been read on the client.
  if (!mounted) return <Surface><span style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6d7078" }}>Loading…</span></Surface>;

  // Gate dashboard routes behind a selected role (prototype stand-in for auth).
  if (!role) {
    return (
      <Surface>
        <div style={{ maxWidth: 420, textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>Front Office</span>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,6vw,52px)", lineHeight: 0.95, letterSpacing: "-0.01em", textTransform: "uppercase" }}>Choose a role to enter.</h1>
          <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.55, color: "#b9bcc4" }}>
            This is a prototype of the BOW front office. Pick a role to preview the experience — real sign-in is coming.
          </p>
          <Link href="/app" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
            Go to the role launcher →
          </Link>
        </div>
      </Surface>
    );
  }

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh" }}>
      <AuthHeader />
      {children}
      <RolePreview />
      <Toast />
      <ConfirmModal />
    </div>
  );
}
