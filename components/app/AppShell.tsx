"use client";

import "@/styles/portal.css";
import AuthHeader from "./AuthHeader";
import PortalTopBarConnected from "./PortalTopBarConnected";
import Toast from "./Toast";
import ConfirmModal from "./ConfirmModal";

/**
 * Authenticated app chrome: a left sidebar (desktop) / top bar + overlay
 * sheet (mobile) — see AuthHeader — plus the content column. By the time
 * this renders, app/app/layout.tsx has verified the session and the nested
 * admin/instructor/student layout.tsx has verified the role, so there is no
 * gate or mount flash to manage here.
 *
 * cutoverEnabled is still accepted for the app/app/layout.tsx prop contract
 * but is threaded through as a no-op — the learn cutover is a permanent
 * product decision (Stage 1), not a runtime nav branch.
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
    <div className="bow-portal">
      <AuthHeader instructorCanDeliver={instructorCanDeliver} cutoverEnabled={cutoverEnabled} />
      <div className="bow-portal-main">
        <PortalTopBarConnected instructorCanDeliver={instructorCanDeliver} cutoverEnabled={cutoverEnabled} />
        <div className="bow-portal-content">{children}</div>
      </div>
      <Toast />
      <ConfirmModal />
    </div>
  );
}
