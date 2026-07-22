"use client";

import AuthHeader from "./AuthHeader";
import Toast from "./Toast";
import ConfirmModal from "./ConfirmModal";

/**
 * Authenticated app chrome. By the time this renders, app/app/layout.tsx
 * has verified the session and the nested admin/instructor/student
 * layout.tsx has verified the role, so there is no gate or mount flash
 * to manage here.
 */
export default function AppShell({
  children,
  instructorCanDeliver = true,
  cutoverEnabled = true,
}: {
  children: React.ReactNode;
  instructorCanDeliver?: boolean;
  cutoverEnabled?: boolean;
}) {
  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh" }}>
      <AuthHeader instructorCanDeliver={instructorCanDeliver} cutoverEnabled={cutoverEnabled} />
      <div className="bow-app-main">{children}</div>
      <Toast />
      <ConfirmModal />
    </div>
  );
}
