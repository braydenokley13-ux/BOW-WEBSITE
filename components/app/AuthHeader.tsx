"use client";

import Link from "next/link";
import { useState } from "react";
import { initials } from "@/lib/account";
import { usePortalNav } from "./usePortalNav";
import PortalSidebar from "./PortalSidebar";
import PortalMobileNav from "./PortalMobileNav";

/**
 * Portal navigation chrome: a left sidebar (desktop, ~240px) with the
 * primary destinations plus a visually de-emphasized Admin group, and an
 * account block at the bottom. Below 768px the sidebar collapses to a top
 * bar with a menu button that opens an overlay sheet carrying the same
 * navigation (see PortalMobileNav). The content top bar itself lives in
 * AppShell (PortalTopBar) so it can sit in the content column.
 */
export default function AuthHeader({
  instructorCanDeliver = true,
  cutoverEnabled = true,
}: {
  instructorCanDeliver?: boolean;
  cutoverEnabled?: boolean;
}) {
  const { role, me, signOut, navigation, activeId, roleLabel, accent } = usePortalNav({
    instructorCanDeliver,
    cutoverEnabled,
  });
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <PortalSidebar
        role={role}
        navigation={navigation}
        activeId={activeId}
        accountName={me.name}
        accountRoleLabel={roleLabel}
        accountAccent={accent}
        accountInitials={initials(me.name)}
        onSignOut={signOut}
      />

      <div className="bow-portal-mobile-bar">
        <Link href="/app" className="bow-portal-mobile-bar__brand" aria-label="BOW home">
          BOW
        </Link>
        <button
          type="button"
          className="bow-portal-mobile-menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="bow-portal-mobile-sheet"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <PortalMobileNav
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        activeId={activeId}
        accountName={me.name}
        onSignOut={signOut}
      />
    </>
  );
}
