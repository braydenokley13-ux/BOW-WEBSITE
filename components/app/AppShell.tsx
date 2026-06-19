"use client";

import AuthHeader from "./AuthHeader";
import Toast from "./Toast";
import ConfirmModal from "./ConfirmModal";

/**
 * Authenticated app chrome. By the time this renders the server
 * layout has already verified the session (`requireUser`), so there
 * is no role gate or mount flash to manage here.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh" }}>
      <AuthHeader />
      {children}
      <Toast />
      <ConfirmModal />
    </div>
  );
}
